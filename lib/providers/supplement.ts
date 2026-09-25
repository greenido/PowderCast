/**
 * Fills the two holes an NWS gridpoint cannot fill itself.
 *
 * NWS publishes no snow-depth field and no history, which cost every US resort
 * its base depth card -- the number that decides early- and late-season trips --
 * and made "what fell overnight" unanswerable in the range with the most
 * resorts. Open-Meteo has both, globally, for one small extra request.
 *
 * The grafted values land in the same hourly grid as everything else rather
 * than in a parallel "observed" block. One grid means one code path in
 * lib/conditions.ts: sumBack() works the same whether the history came from the
 * serving provider or from here. Two paths is how the same number ends up
 * disagreeing with itself across views.
 */

import type { NormalizedForecast, HourlySeries } from '@/lib/types';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { measureCoverage } from '@/lib/series';

const API_BASE = 'https://api.open-meteo.com/v1/forecast';
const PAST_DAYS = 2;

/** Every nullable series on HourlySeries, i.e. everything except `time`. */
const SERIES_KEYS: Array<Exclude<keyof HourlySeries, 'time'>> = [
  'temperatureC',
  'dewpointC',
  'humidityPct',
  'snowfallMm',
  'precipMm',
  'precipProbPct',
  'windSpeedKmh',
  'windGustKmh',
  'windDirectionDeg',
  'cloudCoverPct',
  'visibilityM',
  'freezingLevelM',
  'snowDepthCm',
];

interface SupplementRequest {
  lat: number;
  lon: number;
  elevationM?: number;
  signal?: AbortSignal;
}

interface SupplementData {
  /** Epoch ms, hourly, ascending. Spans PAST_DAYS back through +7 days. */
  time: number[];
  snowfallMm: Array<number | null>;
  temperatureC: Array<number | null>;
  snowDepthCm: Array<number | null>;
}

async function fetchSupplement({
  lat,
  lon,
  elevationM,
  signal,
}: SupplementRequest): Promise<SupplementData | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: 'snowfall,snow_depth,temperature_2m',
    timeformat: 'unixtime',
    timezone: 'UTC',
    forecast_days: '7',
    past_days: String(PAST_DAYS),
  });

  if (elevationM !== undefined && Number.isFinite(elevationM)) {
    params.set('elevation', Math.round(elevationM).toString());
  }

  const res = await fetchWithRetry(`${API_BASE}?${params.toString()}`, { signal });
  if (!res.ok) return null;

  const json = await res.json();
  if (json.error) return null;

  const h = json.hourly ?? {};
  const time: number[] = (h.time ?? []).map((t: number) => t * 1000);
  if (time.length === 0) return null;

  const nullable = (values: unknown, factor = 1): Array<number | null> =>
    (Array.isArray(values) ? values : []).map((v) =>
      typeof v === 'number' && Number.isFinite(v) ? v * factor : null
    );

  return {
    time,
    // Open-Meteo reports snowfall in CENTIMETRES and depth in METRES.
    snowfallMm: nullable(h.snowfall, 10),
    snowDepthCm: nullable(h.snow_depth, 100),
    temperatureC: nullable(h.temperature_2m),
  };
}

/**
 * Graft snow depth and trailing history onto a forecast.
 *
 * Alignment is by timestamp, never by index: the two providers agree on hourly
 * boundaries but not on where their series start, and lining them up by
 * position would quietly shift every value.
 *
 * Failure is not an error. The forecast is already complete and useful without
 * a base depth, so a dead supplement returns the input untouched.
 */
export async function withSnowDepthAndHistory(
  forecast: NormalizedForecast,
  request: SupplementRequest
): Promise<NormalizedForecast> {
  let data: SupplementData | null = null;
  try {
    data = await fetchSupplement(request);
  } catch (err) {
    console.warn(
      `[supplement] snow depth/history unavailable: ${
        err instanceof Error ? err.message : err
      }`
    );
  }
  if (!data) return forecast;

  const h = forecast.hourly;
  const firstForecastHour = h.time[0];
  if (firstForecastHour === undefined) return forecast;

  const byHour = new Map<number, number>();
  data.time.forEach((t, i) => {
    const depth = data.snowDepthCm[i];
    if (depth !== null) byHour.set(t, depth);
  });

  // 1. Snow depth, aligned onto the existing forecast hours.
  const snowDepthCm = h.time.map((t) => byHour.get(t) ?? null);

  // 2. History, prepended. Only hours strictly before the forecast starts, so
  //    the providers cannot both claim the same hour.
  const pastIndices: number[] = [];
  for (let i = 0; i < data.time.length; i++) {
    if (data.time[i] < firstForecastHour) pastIndices.push(i);
  }

  if (pastIndices.length === 0) {
    const grafted = { ...h, snowDepthCm };
    return { ...forecast, hourly: grafted, coverage: measureCoverage(grafted) };
  }

  const blanks = new Array(pastIndices.length).fill(null);
  const hourly: HourlySeries = {
    ...h,
    time: [...pastIndices.map((i) => data.time[i]), ...h.time],
    snowDepthCm: [...pastIndices.map((i) => data.snowDepthCm[i]), ...snowDepthCm],
    snowfallMm: [...pastIndices.map((i) => data.snowfallMm[i]), ...h.snowfallMm],
    temperatureC: [...pastIndices.map((i) => data.temperatureC[i]), ...h.temperatureC],
  };

  // Everything the supplement does not carry is padded so all series stay the
  // same length and index i keeps meaning hourly.time[i].
  for (const key of SERIES_KEYS) {
    if (key === 'snowDepthCm' || key === 'snowfallMm' || key === 'temperatureC') continue;
    hourly[key] = [...blanks, ...h[key]];
  }

  return {
    ...forecast,
    hourly,
    // Recomputed: snow depth went from absent to present, and coverage is what
    // the UI reads to decide between "none" and "unknown".
    coverage: measureCoverage(hourly),
    attribution: `${forecast.attribution} · snow depth and history: Open-Meteo.com (CC BY 4.0)`,
  };
}
