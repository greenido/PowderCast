import type { WeatherProvider, ForecastRequest } from './types';
import type { NormalizedForecast, HourlySeries, NarrativePeriod, NwsGrid } from '@/lib/types';
import { emptyHourlySeries } from '@/lib/types';
import { combineSignals } from '@/lib/fetchWithRetry';
import { sharedFetchJson, HttpError } from '@/lib/sharedFetch';
import {
  sumAccumulationForward,
  getAverageForward,
} from '@/lib/nwsProcessing';
import { measureCoverage } from '@/lib/series';
import type { NWSGridDataValue } from '@/lib/nwsTypes';

const API_BASE = 'https://api.weather.gov';
const HOUR_MS = 3_600_000;
const FORECAST_HOURS = 168;

/**
 * Total time NWS gets before we fall back to Open-Meteo. A healthy uncached
 * gridpoint answers in well under a second; one that is still going at 8s is
 * having the kind of morning that ends in a 500.
 */
export const NWS_BUDGET_MS = 8_000;

/** How long the narrative may trail the gridpoint before we render without it. */
export const NARRATIVE_GRACE_MS = 1_500;

/** A coordinate's grid cell does not change; look it up once per session. */
const POINT_TTL_MS = Infinity;

/** NWS refreshes gridpoints roughly hourly. Long enough to serve base and mid. */
const FORECAST_TTL_MS = 10 * 60_000;

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

interface CellUrls {
  gridUrl: string;
  forecastUrl: string;
}

function cellFromGrid({ office, x, y }: NwsGrid): CellUrls {
  const gridUrl = `${API_BASE}/gridpoints/${office}/${x},${y}`;
  return { gridUrl, forecastUrl: `${gridUrl}/forecast` };
}

function cellFromPoint(point: any): CellUrls {
  return {
    gridUrl: point.properties.forecastGridData,
    forecastUrl: point.properties.forecast,
  };
}

export class NWSProvider implements WeatherProvider {
  id = 'nws';
  name = 'US National Weather Service';
  // NWS gridpoints are 2.5km cells with a single representative elevation.
  // They cannot resolve a base/summit split; the caller applies a lapse rate.
  readonly resolvesElevation = false;
  // No snow-depth field, and gridpoints start at the current hour.
  readonly suppliesSnowDepthAndHistory = false;

  /** `budgetMs` is overridable so tests need not wait out the real one. */
  constructor(private readonly budgetMs = NWS_BUDGET_MS) {}

  covers(lat: number, lon: number): boolean {
    return coversUS(lat, lon);
  }

  async fetchForecast({
    lat,
    lon,
    timezone,
    nwsGrid,
    signal,
  }: ForecastRequest): Promise<NormalizedForecast> {
    // One deadline for the whole chain rather than a timeout per call. With
    // per-call timeouts and retries a stalled NWS cost ~33s per step, and the
    // chain has two steps before the Open-Meteo fallback could even start.
    const deadline = new AbortController();
    const deadlineTimer = setTimeout(() => deadline.abort(), this.budgetMs);
    const chainSignal = combineSignals(signal ? [signal, deadline.signal] : [deadline.signal]);

    // Never retried: the fallback is a better use of the time than a second
    // attempt at a service that just failed.
    const get = <T>(url: string, ttlMs: number, own: AbortSignal = chainSignal) =>
      sharedFetchJson<T>(url, {
        headers: HEADERS,
        signal: own,
        ttlMs,
        maxRetries: 0,
        timeoutMs: this.budgetMs,
      });

    const describe = (step: string, err: unknown): Error => {
      if (deadline.signal.aborted && !signal?.aborted) {
        return new Error(`NWS ${step} did not answer within ${this.budgetMs / 1000}s`);
      }
      if (signal?.aborted) return err instanceof Error ? err : new Error(String(err));
      return new Error(`NWS ${step} failed: ${err instanceof Error ? err.message : err}`);
    };

    // The prose narrative is not the numbers. Its endpoint 500s on its own
    // schedule, and it used to take the whole NWS forecast down with it. It
    // gets a short grace period after the grid lands, then we go without.
    const fetchCell = async (cell: CellUrls) => {
      const narrativeCutoff = new AbortController();
      const narrativePromise = get<{ properties?: { periods?: NarrativePeriod[] } }>(
        cell.forecastUrl,
        FORECAST_TTL_MS,
        combineSignals([chainSignal, narrativeCutoff.signal])
      ).catch((err) => {
        if (!signal?.aborted) {
          console.warn(`[nws] narrative unavailable: ${err instanceof Error ? err.message : err}`);
        }
        return null;
      });

      let grid: any;
      try {
        grid = await get(cell.gridUrl, FORECAST_TTL_MS);
      } catch (err) {
        narrativeCutoff.abort();
        throw err;
      }

      const graceTimer = setTimeout(() => narrativeCutoff.abort(), NARRATIVE_GRACE_MS);
      const narrative = await narrativePromise;
      clearTimeout(graceTimer);
      return { grid, periods: narrative?.properties?.periods };
    };

    const lookUpPoint = async () => {
      try {
        return await get<any>(`${API_BASE}/points/${lat},${lon}`, POINT_TTL_MS);
      } catch (err) {
        throw describe('point lookup', err);
      }
    };

    try {
      // A grid cell resolved at build time skips /points, which was the first
      // serial round trip of every US forecast.
      let point: any = nwsGrid ? null : await lookUpPoint();
      let cell = point ? cellFromPoint(point) : cellFromGrid(nwsGrid!);

      let result: Awaited<ReturnType<typeof fetchCell>>;
      try {
        result = await fetchCell(cell);
      } catch (err) {
        // NWS re-grids an office now and then, and a stored cell then 404s.
        // Resolve the coordinate properly rather than give up on NWS.
        const stale = !point && err instanceof HttpError && err.status === 404;
        if (!stale || signal?.aborted || deadline.signal.aborted) {
          throw describe('gridpoint', err);
        }
        console.warn(`[nws] stored grid ${nwsGrid!.office}/${nwsGrid!.x},${nwsGrid!.y} is stale`);
        point = await lookUpPoint();
        cell = cellFromPoint(point);
        try {
          result = await fetchCell(cell);
        } catch (retryErr) {
          throw describe('gridpoint', retryErr);
        }
      }

      if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');

      return this.normalize(point, result.grid, result.periods, cell.gridUrl, timezone);
    } finally {
      clearTimeout(deadlineTimer);
    }
  }

  private normalize(
    point: any,
    grid: any,
    periods: NarrativePeriod[] | undefined,
    gridUrl: string,
    timezone: string | undefined
  ): NormalizedForecast {
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
      // Liquid-equivalent QPF, uom mm. NWS forecasts snowfall for the grid
      // cell's own elevation only, so a summit 2,000ft higher needs this to
      // reconstruct what falls as snow up there — see lib/lapseRate.ts.
      precipMm: resample(
        props.quantitativePrecipitation?.values,
        startHour,
        FORECAST_HOURS,
        true
      ),
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
      // NWS publishes no snow-depth field and no history. Both are grafted on
      // from Open-Meteo in lib/providers/index.ts rather than left null, which
      // used to cost every US resort its base depth card.
      snowDepthCm: new Array(FORECAST_HOURS).fill(null),
    };

    return {
      source: 'nws',
      model: 'NDFD',
      elevationM: props.elevation?.value ?? null,
      location: {
        // Only known when /points was called; nothing renders these today.
        name: point?.properties.relativeLocation?.properties?.city,
        region: point?.properties.relativeLocation?.properties?.state,
        country: 'US',
        timezone: point?.properties.timeZone ?? timezone,
      },
      hourly,
      coverage: measureCoverage(hourly),
      narrative: periods,
      fetchedAt: Date.now(),
      attribution: 'NOAA / National Weather Service',
      sourceUrl: gridUrl,
    };
  }
}
