/**
 * Core domain types.
 *
 * Lives apart from lib/database.ts on purpose: that module imports
 * better-sqlite3 at module scope and is build-time only, but client components
 * need the Resort shape. Importing the type from there worked only because
 * TypeScript erases type-only imports — one accidental value import and the
 * client bundle breaks.
 */

/** Ski pass affiliations. See lib/passes.ts for the roster. */
export type PassId = 'ikon' | 'epic' | 'mountain-collective' | 'indy';

/** How a pass covers a resort. Unlimited vs a day allotment matters to buyers. */
export type PassAccess = 'unlimited' | 'limited' | 'partner';

export interface PassAffiliation {
  pass: PassId;
  access: PassAccess;
  /** Days included when access is 'limited' or 'partner'. */
  days?: number;
  /** Season this was verified against, e.g. "2025-26". */
  season: string;
  notes?: string;
}

export type RegionCode =
  | 'us-west'
  | 'us-rockies'
  | 'us-east'
  | 'canada'
  | 'alps'
  | 'dolomites'
  | 'pyrenees'
  | 'scandinavia'
  | 'japan';

export interface Resort {
  id: string;
  name: string;
  /** State / province / département. */
  state: string;
  /** Human-readable range or area, e.g. "Lake Tahoe", "Chamonix Valley". */
  region: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  regionCode: RegionCode;
  /** IANA timezone, needed to render local forecast hours correctly. */
  timezone: string;

  base_lat: number;
  base_lon: number;
  /** Feet. Stored imperial for backwards compatibility; convert at the edge. */
  base_elevation: number;
  summit_lat: number;
  summit_lon: number;
  summit_elevation: number;

  webcam_url: string | null;
  website_url?: string | null;
  /** Total pisted run length in km — a decent proxy for resort size. */
  runsKm?: number;
  passes?: PassAffiliation[];
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Normalized forecast model
//
// Every provider is converted into this before anything else touches it. All
// values are SI, always, with no exceptions:
//
//   temperature      °C
//   snowfall         mm (liquid-equivalent-free, actual snow depth)
//   snow depth       cm
//   wind             km/h
//   direction        degrees, meteorological (the direction wind comes FROM)
//   distance/height  m
//   percentages      0-100
//
// Providers disagree wildly — NWS reports snowfall in mm, Open-Meteo in cm,
// snow depth in m. Normalizing once, here, is what keeps unit errors from
// reaching the display layer.
// ---------------------------------------------------------------------------

export type ProviderId = 'nws' | 'open-meteo';

export interface HourlySeries {
  /** Epoch ms, aligned to the top of each hour, ascending. */
  time: number[];
  temperatureC: Array<number | null>;
  dewpointC: Array<number | null>;
  humidityPct: Array<number | null>;
  /** Snowfall accumulated within each hour, in mm. */
  snowfallMm: Array<number | null>;
  /**
   * Liquid-equivalent precipitation within each hour, in mm.
   *
   * Distinct from snowfallMm: 1mm of water is roughly 10mm of settled snow at
   * -5°C and nearly 20mm at -15°C. Carrying it is what makes a summit snow
   * estimate possible when the provider only forecasts snow for the valley --
   * see lib/lapseRate.ts.
   */
  precipMm: Array<number | null>;
  precipProbPct: Array<number | null>;
  windSpeedKmh: Array<number | null>;
  windGustKmh: Array<number | null>;
  windDirectionDeg: Array<number | null>;
  cloudCoverPct: Array<number | null>;
  visibilityM: Array<number | null>;
  /** Height of the 0°C isotherm above sea level, in m. */
  freezingLevelM: Array<number | null>;
  /** Settled snow on the ground, in cm. */
  snowDepthCm: Array<number | null>;
}

export interface NarrativePeriod {
  /** Sequence number. NWS supplies it; used as a render key. */
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  icon?: string;
  probabilityOfPrecipitation?: { value: number | null };
}

/**
 * One model's snowfall series, kept alongside the merged forecast.
 *
 * A single number implies a precision nobody has. Two models that both say
 * 10in is a very different decision from one saying 4in and another 16in, and
 * the second case is exactly when someone is deciding whether to drive three
 * hours. Open-Meteo returns several models in one request, so the spread is
 * free -- it just has to survive normalization.
 */
export interface ModelSeries {
  /** Provider's model id, e.g. "dwd_icon_d2". */
  model: string;
  /** Human-readable label for the UI. */
  label: string;
  /** Snowfall per hour, in mm, on the same time grid as HourlySeries. */
  snowfallMm: Array<number | null>;
}

/**
 * Fraction (0-1) of the forward window each series actually covers.
 *
 * Absent means "not measured". See coverageOver() in lib/series.ts for why
 * this is load-bearing rather than diagnostic.
 */
export type FieldCoverage = Partial<Record<keyof HourlySeries, number>>;

export interface NormalizedForecast {
  source: ProviderId;
  /** Specific numerical model, when the provider exposes one. */
  model?: string;
  /** Elevation the forecast is valid for, in m. */
  elevationM: number | null;
  location: {
    name?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
  hourly: HourlySeries;
  /** Prose forecast. NWS only; Open-Meteo has no equivalent. */
  narrative?: NarrativePeriod[];
  /**
   * Per-model snowfall, when more than one model answered. Absent when only
   * one model was available, which is the honest signal for "no spread known".
   */
  ensemble?: ModelSeries[];
  /** How much of the forward window each series covers. */
  coverage?: FieldCoverage;
  fetchedAt: number;
  attribution: string;
  /** Raw upstream URL, surfaced in Pro View. */
  sourceUrl?: string;
}

export function emptyHourlySeries(): HourlySeries {
  return {
    time: [],
    temperatureC: [],
    dewpointC: [],
    humidityPct: [],
    snowfallMm: [],
    precipMm: [],
    precipProbPct: [],
    windSpeedKmh: [],
    windGustKmh: [],
    windDirectionDeg: [],
    cloudCoverPct: [],
    visibilityM: [],
    freezingLevelM: [],
    snowDepthCm: [],
  };
}
