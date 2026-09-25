import type { WeatherProvider, ForecastRequest } from './types';
import type { NormalizedForecast, HourlySeries, ModelSeries } from '@/lib/types';
import { emptyHourlySeries } from '@/lib/types';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { measureCoverage } from '@/lib/series';

const API_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Days of history to request.
 *
 * Every window in lib/series.ts used to look forward, on the assumption that
 * forecast APIs carry no history. Open-Meteo does, via `past_days`, and "what
 * fell overnight" is the question riders actually ask at 6am -- a foot that
 * landed yesterday is still on the mountain today.
 */
const PAST_DAYS = 2;

/** Open-Meteo's automatic model choice. Global, and complete on every field. */
const GLOBAL_MODEL = 'best_match';
const GLOBAL_LABEL = 'GFS/ICON seamless';

const HOURLY_FIELDS = [
  'temperature_2m',
  'dew_point_2m',
  'relative_humidity_2m',
  'snowfall',
  'snow_depth',
  // Liquid equivalent, needed to estimate snow where a model reports only rain.
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'cloud_cover',
  'visibility',
  'freezing_level_height',
].join(',');

/**
 * High-resolution regional models, preferred over the global default where
 * they apply. These are the models that make a mountain forecast worth reading:
 * ICON-D2 is 2km over the Eastern Alps, AROME 1.5km over the French Alps and
 * Pyrenees, and JMA runs 5km over Japan.
 *
 * None of them is complete, which is why every request now also asks for the
 * global model and merges the two. Measured against live responses:
 *
 *   AROME HD     no snowfall, snow_depth, freezing_level or visibility at all,
 *                and temperature/wind stop at ~52h
 *   ICON-D2      every field stops at ~49h
 *   JMA seamless no snow_depth, freezing_level, wind gusts or precip probability
 *   MET Norway   no freezing_level
 *
 * Asking for the regional model alone therefore left the French Alps and the
 * Pyrenees with no snow forecast and no snow line -- the single most important
 * number in the range -- and blanked days 3-7 of the Alpine planner. Worse, it
 * did so silently: sumOver() drops nulls before reducing, so 168 missing hours
 * summed to a confident "0 in" mid-storm. Coverage now travels with the
 * forecast so the display layer can tell missing from zero.
 */
interface RegionalModel {
  model: string;
  label: string;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

// Order matters: the first match wins, so the finest-resolution model for a
// given area is listed first. AROME (1.5km) beats ICON-D2 (2km) over the
// French Alps and Pyrenees; ICON-D2 takes the rest of the Alpine arc.
const REGIONAL_MODELS: RegionalModel[] = [
  {
    // French Alps (incl. the Mont Blanc massif) and the Pyrenees/Andorra.
    model: 'meteofrance_arome_france_hd',
    label: 'Météo-France AROME HD (1.5km)',
    bounds: { minLat: 41.0, maxLat: 51.5, minLon: -5.5, maxLon: 7.7 },
  },
  {
    // Switzerland, Austria, Bavaria, Dolomites.
    model: 'dwd_icon_d2',
    label: 'DWD ICON-D2 (2km)',
    bounds: { minLat: 45.0, maxLat: 49.5, minLon: 5.5, maxLon: 17.0 },
  },
  {
    model: 'jma_seamless',
    label: 'JMA Seamless (5km)',
    bounds: { minLat: 24.0, maxLat: 46.0, minLon: 122.0, maxLon: 146.0 },
  },
  {
    model: 'metno_seamless',
    label: 'MET Norway Nordic (1km)',
    bounds: { minLat: 55.0, maxLat: 71.5, minLon: 4.0, maxLon: 32.0 },
  },
];

function selectModel(lat: number, lon: number): RegionalModel | null {
  return (
    REGIONAL_MODELS.find(
      ({ bounds }) =>
        lat >= bounds.minLat &&
        lat <= bounds.maxLat &&
        lon >= bounds.minLon &&
        lon <= bounds.maxLon
    ) ?? null
  );
}

/**
 * Pull one hourly field for one model out of a response.
 *
 * With `models=a,b` Open-Meteo suffixes every field with the model id; with no
 * `models` parameter the fields are bare. Both shapes flow through here.
 */
function pick(
  hourly: Record<string, Array<number | null> | undefined>,
  field: string,
  model: string | null
): Array<number | null> | undefined {
  return hourly[model ? `${field}_${model}` : field];
}

/**
 * Take the first finite value available for each hour, in preference order.
 *
 * Hour by hour rather than series by series: ICON-D2 is the better forecast for
 * the first 49 hours and absent after, so the merge has to happen per hour or
 * days 3-7 would keep the gap.
 */
function mergeSeries(
  candidates: Array<Array<number | null> | undefined>,
  length: number
): { merged: Array<number | null>; usedFallback: boolean } {
  const merged: Array<number | null> = new Array(length).fill(null);
  let usedFallback = false;

  for (let i = 0; i < length; i++) {
    for (let c = 0; c < candidates.length; c++) {
      const value = candidates[c]?.[i];
      if (value !== null && value !== undefined && Number.isFinite(value)) {
        merged[i] = value;
        if (c > 0) usedFallback = true;
        break;
      }
    }
  }

  return { merged, usedFallback };
}

/** Multiply a nullable series, e.g. cm -> mm. */
function scale(values: Array<number | null> | undefined, factor: number): Array<number | null> {
  if (!values) return [];
  return values.map((v) => (v === null || v === undefined ? null : v * factor));
}

function passthrough(values: Array<number | null> | undefined): Array<number | null> {
  return values ? values.map((v) => (v === undefined ? null : v)) : [];
}

export class OpenMeteoProvider implements WeatherProvider {
  id = 'open-meteo';
  name = 'Open-Meteo';
  // Open-Meteo accepts an `elevation` parameter and downscales the model to it.
  // This is what makes a genuine base-vs-summit forecast possible.
  readonly resolvesElevation = true;
  // snow_depth and past_days come back in the same request.
  readonly suppliesSnowDepthAndHistory = true;

  covers(): boolean {
    return true; // Global.
  }

  async fetchForecast({
    lat,
    lon,
    elevationM,
    timezone,
    signal,
  }: ForecastRequest): Promise<NormalizedForecast> {
    const regional = selectModel(lat, lon);

    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      hourly: HOURLY_FIELDS,
      wind_speed_unit: 'kmh',
      timeformat: 'unixtime',
      timezone: 'UTC',
      forecast_days: '7',
      past_days: String(PAST_DAYS),
    });

    if (elevationM !== undefined && Number.isFinite(elevationM)) {
      params.set('elevation', Math.round(elevationM).toString());
    }
    // Ask for the global model alongside the regional one. It costs one request
    // (~5.5KB gzipped for both, plus history) and it is what fills the regional
    // model's missing fields and short horizon. See REGIONAL_MODELS.
    if (regional) {
      params.set('models', `${regional.model},${GLOBAL_MODEL}`);
    }

    const url = `${API_BASE}?${params.toString()}`;
    const res = await fetchWithRetry(url, { signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo request failed: ${res.status}`);
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(`Open-Meteo error: ${json.reason ?? 'unknown'}`);
    }

    const h = json.hourly ?? {};

    // timeformat=unixtime gives seconds; we work in ms.
    const time: number[] = (h.time ?? []).map((t: number) => t * 1000);

    // With one model the fields are bare; with two they are suffixed. The
    // regional model leads and the global one fills its gaps, hour by hour.
    const primaryKey = regional ? regional.model : null;
    const fallbackKey = regional ? GLOBAL_MODEL : null;

    let filled = false;
    const field = (name: string, factor = 1): Array<number | null> => {
      const { merged, usedFallback } = mergeSeries(
        [pick(h, name, primaryKey), fallbackKey ? pick(h, name, fallbackKey) : undefined],
        time.length
      );
      if (usedFallback) filled = true;
      return factor === 1 ? merged : scale(merged, factor);
    };

    const hourly: HourlySeries = {
      ...emptyHourlySeries(),
      time,
      temperatureC: field('temperature_2m'),
      dewpointC: field('dew_point_2m'),
      humidityPct: field('relative_humidity_2m'),
      // Open-Meteo reports snowfall in CENTIMETRES; our canonical unit is mm.
      snowfallMm: field('snowfall', 10),
      precipMm: field('precipitation'),
      precipProbPct: field('precipitation_probability'),
      windSpeedKmh: field('wind_speed_10m'),
      windGustKmh: field('wind_gusts_10m'),
      windDirectionDeg: field('wind_direction_10m'),
      cloudCoverPct: field('cloud_cover'),
      visibilityM: field('visibility'),
      freezingLevelM: field('freezing_level_height'),
      // Open-Meteo reports snow depth in METRES; our canonical unit is cm.
      snowDepthCm: field('snow_depth', 100),
    };

    // Keep each model's snowfall so the UI can show a range where they
    // disagree. Only worth reporting when at least two actually answered.
    const ensemble: ModelSeries[] = [];
    if (regional) {
      for (const [model, label] of [
        [regional.model, regional.label],
        [GLOBAL_MODEL, GLOBAL_LABEL],
      ] as const) {
        const snowfallMm = scale(pick(h, 'snowfall', model), 10);
        if (snowfallMm.some((v) => v !== null)) {
          ensemble.push({ model, label, snowfallMm });
        }
      }
    }

    return {
      source: 'open-meteo',
      model: regional
        ? `${regional.label}${filled ? ` + ${GLOBAL_LABEL} fill` : ''}`
        : GLOBAL_LABEL,
      // Echoes back the elevation actually used, which may be clamped to the
      // model's terrain range.
      elevationM: normalizeElevation(json.elevation) ?? elevationM ?? null,
      location: { timezone: timezone ?? json.timezone },
      hourly,
      ensemble: ensemble.length > 1 ? ensemble : undefined,
      coverage: measureCoverage(hourly),
      fetchedAt: Date.now(),
      attribution: 'Open-Meteo.com (CC BY 4.0)',
      sourceUrl: url,
    };
  }
}

/**
 * A multi-model response can echo `elevation` as an array, one per model. They
 * are the same downscaled elevation, so the first is as good as any.
 */
function normalizeElevation(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'number' && Number.isFinite(first) ? first : null;
}
