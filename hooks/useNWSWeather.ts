import { useState, useEffect, useCallback } from 'react';
import type { 
  WeatherData, 
  ProcessedWeatherData, 
  NWSGridDataValue 
} from '@/lib/nwsTypes';
import { 
  cmToInches, 
  parseWindSpeed, 
  calculateWindChill 
} from '@/lib/unitConversion';
import {
  determineSnowQuality,
  isPowderAlert,
  isBluebirdDay,
  hasFrostbiteRisk,
  hasWindHoldRisk,
} from '@/lib/snowLogic';

export function useNWSWeather(lat: number | null, lon: number | null) {
  const [weatherData, setWeatherData] = useState<ProcessedWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    if (!lat || !lon) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch directly from NWS API (supports CORS)
      const NWS_API_BASE = 'https://api.weather.gov';
      const USER_AGENT = 'PowderCast/1.1 (contact@powdercast.app)';

      // Step 1: Get the point data
      const pointResponse = await fetch(
        `${NWS_API_BASE}/points/${lat},${lon}`,
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/geo+json',
          },
        }
      );

      if (!pointResponse.ok) {
        throw new Error(`NWS API error: ${pointResponse.status}`);
      }

      const pointData = await pointResponse.json();
      const forecastUrl = pointData.properties.forecast;
      const gridDataUrl = pointData.properties.forecastGridData;
      const location = {
        city: pointData.properties.relativeLocation?.properties?.city || 'Unknown',
        state: pointData.properties.relativeLocation?.properties?.state || 'Unknown',
      };

      // Step 2: Fetch forecast and grid data in parallel
      const [forecastResponse, gridDataResponse] = await Promise.all([
        fetch(forecastUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/geo+json',
          },
        }),
        fetch(gridDataUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/geo+json',
          },
        }),
      ]);

      if (!forecastResponse.ok || !gridDataResponse.ok) {
        throw new Error('Failed to fetch weather data');
      }

      const [forecast, gridData] = await Promise.all([
        forecastResponse.json(),
        gridDataResponse.json(),
      ]);

      const data: WeatherData = { forecast, gridData, location };
      const processed = processWeatherData(data);
      setWeatherData(processed);
      
      // Cache in localStorage
      localStorage.setItem(`weather_${lat}_${lon}`, JSON.stringify({
        data: processed,
        timestamp: Date.now(),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Try to load from cache
      const cached = localStorage.getItem(`weather_${lat}_${lon}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          setWeatherData(data);
          setError('Using cached data (offline)');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  return { weatherData, loading, error, refresh: fetchWeather };
}

function processWeatherData(data: WeatherData): ProcessedWeatherData {
  const { forecast, gridData } = data;
  const periods = forecast.properties.periods;

  // Extract current conditions (first period)
  const currentPeriod = periods[0];
  const currentTemp = currentPeriod.temperature;
  const currentWindSpeed = parseWindSpeed(currentPeriod.windSpeed);

  // Get grid data values
  const windGustValues = gridData.properties.windGust?.values || [];
  const snowValues = gridData.properties.snowfallAmount?.values || [];
  const tempValues = gridData.properties.temperature?.values || [];
  const skyCoverValues = gridData.properties.skyCover?.values || [];
  const visibilityValues = gridData.properties.visibility?.values || [];

  // Calculate 24h and 7-day snow accumulation
  const now = Date.now();
  const snow24h = sumSnowfall(snowValues, now, 24);
  const snow7day = sumSnowfall(snowValues, now, 168);

  // Get max wind gusts
  const maxWindGust24h = getMaxValue(windGustValues, now, 24);
  const maxWindGust7day = getMaxValue(windGustValues, now, 168);

  // Get current conditions
  const currentWindGust = windGustValues[0]?.value || currentWindSpeed;
  const currentSkyCover = skyCoverValues[0]?.value || 0;
  const currentVisibility = visibilityValues[0]?.value || 16000; // meters

  // Calculate average wind speed (next 24h)
const avgWindSpeed = getAverageValue(
    gridData.properties.windSpeed?.values || [], 
    now, 
    24
  );

  // Determine snow quality from temperature during precipitation
  let precipTemp: number | null = null;
  let snowQuality = 'Premium Packed';
  
  if (snow24h > 0) {
    // Get avg temp during snow periods (simplified - could be more sophisticated)
    precipTemp = getAverageValue(tempValues, now, 24);
    snowQuality = determineSnowQuality(precipTemp);
  }

  // Calculate wind chill
  const windChill = calculateWindChill(currentTemp, currentWindSpeed);

  // Check alerts and conditions
  const powderAlert = isPowderAlert(snow24h);
  const bluebirdDay = isBluebirdDay(currentSkyCover, currentWindSpeed);
  const frostbiteRisk = hasFrostbiteRisk(windChill);
  const windHoldRisk = hasWindHoldRisk(maxWindGust24h);

  return {
    currentTemp,
    currentWindSpeed,
    currentWindGust,
    currentVisibility,
    currentSkyCover,
    snow24h,
    snow7day,
    maxWindGust24h,
    maxWindGust7day,
    avgWindSpeed,
    periods,
    snowQuality,
    windHoldRisk,
    frostbiteRisk,
    bluebirdDay,
    powderAlert,
    precipTemp,
  };
}

function sumSnowfall(
  values: NWSGridDataValue[], 
  fromTime: number, 
  hours: number
): number {
  const endTime = fromTime + (hours * 3600000);
  let total = 0;

  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    if (time >= fromTime && time <= endTime && val.value) {
      // NWS returns snowfall in cm
      total += cmToInches(val.value);
    }
  }

  return total;
}

function getMaxValue(
  values: NWSGridDataValue[], 
  fromTime: number, 
  hours: number
): number {
  const endTime = fromTime + (hours * 3600000);
  let max = 0;

  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    if (time >= fromTime && time <= endTime && val.value) {
      // Convert from km/h to mph if needed
      const value = val.value * 0.621371;
      max = Math.max(max, value);
    }
  }

  return max;
}

function getAverageValue(
  values: NWSGridDataValue[], 
  fromTime: number, 
  hours: number
): number {
  const endTime = fromTime + (hours * 3600000);
  const relevantValues: number[] = [];

  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    if (time >= fromTime && time <= endTime && val.value !== null) {
      relevantValues.push(val.value);
    }
  }

  if (relevantValues.length === 0) return 0;
  return relevantValues.reduce((a, b) => a + b, 0) / relevantValues.length;
}
