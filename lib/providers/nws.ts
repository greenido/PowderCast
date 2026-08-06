import type { WeatherProvider, ForecastRequest } from './types';
import type { NormalizedForecast, HourlySeries } from '@/lib/types';
import { emptyHourlySeries } from '@/lib/types';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  sumAccumulationForward,
  getAverageForward,
} from '@/lib/nwsProcessing';
import type { NWSGridDataValue } from '@/lib/nwsTypes';

const API_BASE = 'https://api.weather.gov';
const HOUR_MS = 3_600_000;
const FORECAST_HOURS = 168;

// Browsers refuse to let fetch set User-Agent so this is dropped client-side,
// but it identifies us correctly from Node (tests, build scripts) and documents
// intent. NWS asks API consumers to identify themselves.
const HEADERS = {
  'User-Agent': 'PowderCast/2.0 (contact@powdercast.app)',
  Accept: 'application/geo+json',
};

/**
 * Continental US, Alaska, Hawaii and PR. Deliberately generous — coverage is
 * confirmed by the /points call, which 404s outside the NWS domain.
 */
function coversUS(lat: number, lon: number): boolean {
  const inConus = lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66;
  const inAlaska = lat >= 51 && lat <= 72 && lon >= -170 && lon <= -129;
  const inHawaii = lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154;
  return inConus || inAlaska || inHawaii;
}

/**
 * Resample an irregular NWS interval series onto an hourly grid.
 *
 * `accumulating` quantities (snowfall) are summed and prorated across the hours
 * a block spans; everything else is sampled as a duration-weighted mean over
 * the hour. See lib/nwsProcessing.ts for why proration matters.
 */
function resample(
  values: NWSGridDataValue[] | undefined,
  startHour: number,
  hours: number,
  accumulating = false
): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 0; i < hours; i++) {
    const hourStart = startHour + i * HOUR_MS;
    out.push(
      accumulating
        ? sumAccumulationForward(values, hourStart, 1)
        : getAverageForward(values, hourStart, 1)
    );
  }
  return out;
}

export class NWSProvider implements WeatherProvider {
  id = 'nws';
  name = 'US National Weather Service';
  // NWS gridpoints are 2.5km cells with a single representative elevation.
  // They cannot resolve a base/summit split; the caller applies a lapse rate.
  readonly resolvesElevation = false;

  covers(lat: number, lon: number): boolean {
    return coversUS(lat, lon);
  }

  async fetchForecast({ lat, lon, signal }: ForecastRequest): Promise<NormalizedForecast> {
    const pointRes = await fetchWithRetry(`${API_BASE}/points/${lat},${lon}`, {
      headers: HEADERS,
      signal,
    });
    if (!pointRes.ok) {
      throw new Error(`NWS point lookup failed: ${pointRes.status}`);
    }

    const point = await pointRes.json();
    const forecastUrl: string = point.properties.forecast;
    const gridUrl: string = point.properties.forecastGridData;

    const [narrativeRes, gridRes] = await Promise.all([
      fetchWithRetry(forecastUrl, { headers: HEADERS, signal }),
      fetchWithRetry(gridUrl, { headers: HEADERS, signal }),
    ]);
    if (!narrativeRes.ok || !gridRes.ok) {
      throw new Error(
        `NWS forecast failed (narrative ${narrativeRes.status}, grid ${gridRes.status})`
      );
    }

    const [narrative, grid] = await Promise.all([narrativeRes.json(), gridRes.json()]);
    const props = grid.properties;

    const startHour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;

    const hourly: HourlySeries = {
      ...emptyHourlySeries(),
      time: Array.from({ length: FORECAST_HOURS }, (_, i) => startHour + i * HOUR_MS),
      // uom degC — already SI.
      temperatureC: resample(props.temperature?.values, startHour, FORECAST_HOURS),
      dewpointC: resample(props.dewpoint?.values, startHour, FORECAST_HOURS),
      humidityPct: resample(props.relativeHumidity?.values, startHour, FORECAST_HOURS),
      // uom mm — already SI. Accumulating, so prorate across the block.
      snowfallMm: resample(props.snowfallAmount?.values, startHour, FORECAST_HOURS, true),
      precipProbPct: resample(
        props.probabilityOfPrecipitation?.values,
        startHour,
        FORECAST_HOURS
      ),
      // uom km_h-1 — already SI.
      windSpeedKmh: resample(props.windSpeed?.values, startHour, FORECAST_HOURS),
      windGustKmh: resample(props.windGust?.values, startHour, FORECAST_HOURS),
      windDirectionDeg: resample(props.windDirection?.values, startHour, FORECAST_HOURS),
      cloudCoverPct: resample(props.skyCover?.values, startHour, FORECAST_HOURS),
      visibilityM: resample(props.visibility?.values, startHour, FORECAST_HOURS),
      // NWS `snowLevel` is the snow/rain line in metres — the same concept as
      // Open-Meteo's freezing level for our purposes.
      freezingLevelM: resample(props.snowLevel?.values, startHour, FORECAST_HOURS),
      // NWS publishes no snow-depth field. Left null; the UI hides the card.
      snowDepthCm: new Array(FORECAST_HOURS).fill(null),
    };

    return {
      source: 'nws',
      model: 'NDFD',
      elevationM: props.elevation?.value ?? null,
      location: {
        name: point.properties.relativeLocation?.properties?.city,
        region: point.properties.relativeLocation?.properties?.state,
        country: 'US',
        timezone: point.properties.timeZone,
      },
      hourly,
      narrative: narrative.properties.periods,
      fetchedAt: Date.now(),
      attribution: 'NOAA / National Weather Service',
      sourceUrl: gridUrl,
    };
  }
}
