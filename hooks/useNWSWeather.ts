import { useState, useEffect, useCallback } from 'react';
import type {
  WeatherData,
  ProcessedWeatherData,
  HourlySnowData,
} from '@/lib/nwsTypes';
import {
  mmToInches,
  celsiusToFahrenheit,
  kmhToMph,
  parseWindSpeed,
  calculateWindChill,
} from '@/lib/unitConversion';
import {
  determineSnowQuality,
  isPowderAlert,
  isBluebirdDay,
  hasFrostbiteRisk,
  hasWindHoldRisk,
} from '@/lib/snowLogic';
import type { SnowQuality } from '@/lib/snowLogic';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  sumAccumulationForward,
  getMaxForward,
  getAverageForward,
  getRangeForward,
  getValueAt,
  getSnowWeightedTempC,
  buildHourlyBuckets,
} from '@/lib/nwsProcessing';

const CACHE_TTL_MS = 3_600_000; // 1 hour
const NWS_API_BASE = 'https://api.weather.gov';

// Note: browsers refuse to let fetch set User-Agent, so this header is dropped
// in the client. It is kept for the Node-based test harness, which can send it,
// and documents who we are for NWS's benefit.
const USER_AGENT = 'PowderCast/1.1 (contact@powdercast.app)';
const NWS_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/geo+json',
};

const debug = process.env.NODE_ENV !== 'production';
function log(...args: unknown[]) {
  if (debug) console.log(...args);
}

export function useNWSWeather(lat: number | null, lon: number | null) {
  const [weatherData, setWeatherData] = useState<ProcessedWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  const fetchWeather = useCallback(async () => {
    if (!lat || !lon) return;

    setLoading(true);
    setError(null);

    const cacheKey = `weather_${lat}_${lon}`;

    try {
      // Step 1: resolve the coordinate to an NWS grid cell.
      const pointResponse = await fetchWithRetry(
        `${NWS_API_BASE}/points/${lat},${lon}`,
        { headers: NWS_HEADERS }
      );
      if (!pointResponse.ok) {
        throw new Error(`NWS point lookup failed: ${pointResponse.status}`);
      }

      const pointData = await pointResponse.json();
      const forecastUrl = pointData.properties.forecast;
      const gridDataUrl = pointData.properties.forecastGridData;
      const location = {
        city: pointData.properties.relativeLocation?.properties?.city || 'Unknown',
        state: pointData.properties.relativeLocation?.properties?.state || 'Unknown',
      };

      // Step 2: narrative forecast and raw gridpoint data, in parallel.
      const [forecastResponse, gridDataResponse] = await Promise.all([
        fetchWithRetry(forecastUrl, { headers: NWS_HEADERS }),
        fetchWithRetry(gridDataUrl, { headers: NWS_HEADERS }),
      ]);

      if (!forecastResponse.ok || !gridDataResponse.ok) {
        throw new Error(
          `Failed to fetch weather data (forecast ${forecastResponse.status}, grid ${gridDataResponse.status})`
        );
      }

      const [forecast, gridData] = await Promise.all([
        forecastResponse.json(),
        gridDataResponse.json(),
      ]);

      const processed = {
        ...processWeatherData({ forecast, gridData, location }),
        gridDataUrl,
      };

      log('[NWS] Processed', {
        snow24h: processed.snow24h.toFixed(1),
        snow7day: processed.snow7day.toFixed(1),
        quality: processed.snowQuality,
        maxGust24h: processed.maxWindGust24h.toFixed(0),
      });

      const fetchTime = Date.now();
      setWeatherData(processed);
      setLastFetchTime(fetchTime);

      localStorage.setItem(
        cacheKey,
        JSON.stringify({ data: processed, timestamp: fetchTime })
      );
    } catch (err) {
      console.error('[NWS] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      // Fall back to cache so the user still sees something usable offline.
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL_MS) {
            setWeatherData(data);
            setLastFetchTime(timestamp);
            setError('Using cached data (offline)');
          }
        } catch {
          // Corrupt cache entry — ignore and surface the original error.
        }
      }
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    if (lat && lon) {
      // Paint cached data immediately, then revalidate.
      const cached = localStorage.getItem(`weather_${lat}_${lon}`);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL_MS) {
            setWeatherData(data);
            setLastFetchTime(timestamp);
          }
        } catch {
          // Ignore unparseable cache.
        }
      }
    }
    fetchWeather();
  }, [lat, lon, fetchWeather]);

  return { weatherData, loading, error, refresh: fetchWeather, lastFetchTime };
}

/**
 * Turn a raw NWS response into the display model.
 *
 * All windows look forward from `now`, because the gridpoint API is a forecast
 * series with no observational history. See lib/nwsProcessing.ts for detail.
 */
export function processWeatherData(
  data: WeatherData,
  now: number = Date.now()
): ProcessedWeatherData {
  const { forecast, gridData } = data;
  const periods = forecast.properties.periods;
  const props = gridData.properties;

  const currentPeriod = periods[0];
  const currentTemp = currentPeriod.temperature;
  const currentWindSpeed = parseWindSpeed(currentPeriod.windSpeed);

  // --- Current conditions -------------------------------------------------
  // Read the interval covering `now` rather than values[0]; the series begins
  // around 12:00Z, so values[0] can be many hours stale by evening.
  const currentWindGustKmh = getValueAt(props.windGust?.values, now);
  const currentWindGust =
    currentWindGustKmh === null ? currentWindSpeed : kmhToMph(currentWindGustKmh);

  const currentSkyCover = getValueAt(props.skyCover?.values, now) ?? 0;
  const currentVisibility = getValueAt(props.visibility?.values, now) ?? 16_000;
  const currentHumidity = getValueAt(props.relativeHumidity?.values, now) ?? 50;

  const dewpointC = getValueAt(props.dewpoint?.values, now);
  const currentDewpoint =
    dewpointC === null ? currentTemp - 5 : celsiusToFahrenheit(dewpointC);

  // --- Snow accumulation (mm in the API, inches for display) --------------
  const snow24h = mmToInches(sumAccumulationForward(props.snowfallAmount?.values, now, 24));
  const snow7day = mmToInches(sumAccumulationForward(props.snowfallAmount?.values, now, 168));

  // --- Wind ---------------------------------------------------------------
  const maxWindGust24h = kmhToMph(getMaxForward(props.windGust?.values, now, 24) ?? 0);
  const maxWindGust7day = kmhToMph(getMaxForward(props.windGust?.values, now, 168) ?? 0);
  const avgWindSpeed = kmhToMph(getAverageForward(props.windSpeed?.values, now, 24) ?? 0);

  // --- Temperature --------------------------------------------------------
  const tempRangeC = getRangeForward(props.temperature?.values, now, 24);
  const maxTemp24h = tempRangeC ? celsiusToFahrenheit(tempRangeC.max) : currentTemp;
  const minTemp24h = tempRangeC ? celsiusToFahrenheit(tempRangeC.min) : currentTemp;

  const maxPrecipProb24h =
    getMaxForward(props.probabilityOfPrecipitation?.values, now, 24) ?? 0;

  // --- Snow quality -------------------------------------------------------
  // Weighted by snowfall so the classification reflects the temperature while
  // snow is actually falling, not the 24h mean.
  const precipTempC = getSnowWeightedTempC(
    props.snowfallAmount?.values,
    props.temperature?.values,
    now,
    24
  );
  const precipTemp = precipTempC === null ? null : celsiusToFahrenheit(precipTempC);

  let snowQuality: SnowQuality;
  if (precipTemp !== null) {
    snowQuality = determineSnowQuality(precipTemp);
  } else {
    // No snow forecast — classify the existing surface off the current temp.
    snowQuality = determineSnowQuality(currentTemp);
  }

  const windChill = calculateWindChill(currentTemp, currentWindSpeed);

  const hourlySnowForecast: HourlySnowData[] = buildHourlyBuckets(
    props.snowfallAmount?.values,
    props.temperature?.values,
    props.windSpeed?.values,
    now,
    48
  ).map((bucket) => ({
    time: bucket.time,
    hour: bucket.hour,
    snowfall: bucket.snowfallIn,
    temperature: bucket.temperatureF,
    windSpeed: bucket.windSpeedMph,
    snowQuality: determineSnowQuality(bucket.temperatureF),
  }));

  return {
    currentTemp,
    currentWindSpeed,
    currentWindGust,
    currentVisibility,
    currentSkyCover,
    currentHumidity,
    currentDewpoint,
    snow24h,
    snow7day,
    maxWindGust24h,
    maxWindGust7day,
    avgWindSpeed,
    maxTemp24h,
    minTemp24h,
    maxPrecipProb24h,
    periods,
    snowQuality,
    windHoldRisk: hasWindHoldRisk(maxWindGust24h),
    frostbiteRisk: hasFrostbiteRisk(windChill),
    bluebirdDay: isBluebirdDay(currentSkyCover, currentWindSpeed),
    powderAlert: isPowderAlert(snow24h),
    precipTemp,
    hourlySnowForecast,
    gridDataUrl: '', // Set by the caller, which knows the source URL.
  };
}
