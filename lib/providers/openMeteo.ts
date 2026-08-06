import type { WeatherProvider, ForecastRequest } from './types';
import type { NormalizedForecast, HourlySeries } from '@/lib/types';
import { emptyHourlySeries } from '@/lib/types';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

const API_BASE = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_FIELDS = [
  'temperature_2m',
  'dew_point_2m',
  'relative_humidity_2m',
  'snowfall',
  'snow_depth',
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
    });

    if (elevationM !== undefined && Number.isFinite(elevationM)) {
      params.set('elevation', Math.round(elevationM).toString());
    }
    if (regional) {
      params.set('models', regional.model);
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

    const hourly: HourlySeries = {
      ...emptyHourlySeries(),
      // timeformat=unixtime gives seconds; we work in ms.
      time: (h.time ?? []).map((t: number) => t * 1000),
      temperatureC: passthrough(h.temperature_2m),
      dewpointC: passthrough(h.dew_point_2m),
      humidityPct: passthrough(h.relative_humidity_2m),
      // Open-Meteo reports snowfall in CENTIMETRES; our canonical unit is mm.
      snowfallMm: scale(h.snowfall, 10),
      precipProbPct: passthrough(h.precipitation_probability),
      windSpeedKmh: passthrough(h.wind_speed_10m),
      windGustKmh: passthrough(h.wind_gusts_10m),
      windDirectionDeg: passthrough(h.wind_direction_10m),
      cloudCoverPct: passthrough(h.cloud_cover),
      visibilityM: passthrough(h.visibility),
      freezingLevelM: passthrough(h.freezing_level_height),
      // Open-Meteo reports snow depth in METRES; our canonical unit is cm.
      snowDepthCm: scale(h.snow_depth, 100),
    };

    return {
      source: 'open-meteo',
      model: regional?.label ?? 'GFS/ICON seamless',
      // Echoes back the elevation actually used, which may be clamped to the
      // model's terrain range.
      elevationM: json.elevation ?? elevationM ?? null,
      location: { timezone: timezone ?? json.timezone },
      hourly,
      fetchedAt: Date.now(),
      attribution: 'Open-Meteo.com (CC BY 4.0)',
      sourceUrl: url,
    };
  }
}
