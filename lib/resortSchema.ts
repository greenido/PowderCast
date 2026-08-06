/**
 * Validation for resort data arriving over the network.
 *
 * public/resorts.json is fetched at runtime from a static host, so the browser
 * can hand us a copy cached from an older release with a different shape. A
 * record missing a field the current code expects previously threw inside a
 * render and blanked the entire page.
 *
 * Anything unusable is dropped; anything merely incomplete is filled with a
 * safe default, so one bad record costs one resort rather than the whole app.
 */

import type { Resort, RegionCode } from '@/lib/types';

const VALID_REGION_CODES: RegionCode[] = [
  'us-west',
  'us-rockies',
  'us-east',
  'canada',
  'alps',
  'dolomites',
  'pyrenees',
  'scandinavia',
  'japan',
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Infer a region for a legacy record that predates regionCode. Rough, but it
 * keeps such a resort usable and grouped somewhere sensible rather than
 * dropped outright.
 */
function inferRegionCode(lat: number, lon: number): RegionCode {
  if (lon >= 122 && lon <= 150) return 'japan';
  if (lon >= 4 && lon <= 32 && lat >= 55) return 'scandinavia';
  if (lon >= 10 && lon <= 13.5 && lat >= 46 && lat <= 47) return 'dolomites';
  if (lon >= -2 && lon <= 3.5 && lat >= 42 && lat <= 43.5) return 'pyrenees';
  if (lon >= -6 && lon <= 17 && lat >= 41 && lat <= 52) return 'alps';
  if (lat > 50 && lon < -50) return 'canada';
  // Pacific states run west of about -114 (Tahoe -120, Cascades -121); the
  // Rockies sit between there and about -100 (Vail -106, Alta -112).
  if (lon < -114) return 'us-west';
  if (lon < -100) return 'us-rockies';
  return 'us-east';
}

/** Coarse timezone fallback for records that predate the field. */
function inferTimezone(lat: number, lon: number, region: RegionCode): string {
  switch (region) {
    case 'japan':
      return 'Asia/Tokyo';
    case 'scandinavia':
      return 'Europe/Oslo';
    case 'dolomites':
      return 'Europe/Rome';
    case 'pyrenees':
      return lon < 1 ? 'Europe/Madrid' : 'Europe/Paris';
    case 'alps':
      return lon < 7 ? 'Europe/Paris' : lon < 10 ? 'Europe/Zurich' : 'Europe/Vienna';
    default:
      if (lon < -114) return 'America/Los_Angeles';
      if (lon < -100) return 'America/Denver';
      if (lon < -87) return 'America/Chicago';
      return 'America/New_York';
  }
}

/**
 * Coerce one unknown record into a Resort, or return null when it lacks the
 * irreducible minimum: an id, a name and a usable base coordinate.
 */
export function sanitizeResort(raw: unknown): Resort | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = asString(r.id);
  const name = asString(r.name);
  if (!id || !name) return null;

  const baseLat = r.base_lat;
  const baseLon = r.base_lon;
  if (!isFiniteNumber(baseLat) || !isFiniteNumber(baseLon)) return null;
  if (baseLat < -90 || baseLat > 90 || baseLon < -180 || baseLon > 180) return null;

  const baseElevation = isFiniteNumber(r.base_elevation) ? r.base_elevation : 0;
  const summitElevation = isFiniteNumber(r.summit_elevation)
    ? r.summit_elevation
    : baseElevation;

  const regionCode =
    typeof r.regionCode === 'string' &&
    VALID_REGION_CODES.includes(r.regionCode as RegionCode)
      ? (r.regionCode as RegionCode)
      : inferRegionCode(baseLat, baseLon);

  return {
    id,
    name,
    state: asString(r.state),
    region: asString(r.region),
    // Legacy records predate `country`; everything in that dataset was US.
    country: asString(r.country, regionCode.startsWith('us-') ? 'US' : ''),
    regionCode,
    timezone: asString(r.timezone, inferTimezone(baseLat, baseLon, regionCode)),

    base_lat: baseLat,
    base_lon: baseLon,
    base_elevation: baseElevation,
    summit_lat: isFiniteNumber(r.summit_lat) ? r.summit_lat : baseLat,
    summit_lon: isFiniteNumber(r.summit_lon) ? r.summit_lon : baseLon,
    summit_elevation: summitElevation,

    webcam_url: typeof r.webcam_url === 'string' ? r.webcam_url : null,
    website_url: typeof r.website_url === 'string' ? r.website_url : null,
    runsKm: isFiniteNumber(r.runsKm) ? r.runsKm : 0,
    passes: Array.isArray(r.passes) ? (r.passes as Resort['passes']) : [],
  };
}

export function sanitizeResorts(data: unknown): { resorts: Resort[]; dropped: number } {
  if (!Array.isArray(data)) return { resorts: [], dropped: 0 };

  const resorts: Resort[] = [];
  let dropped = 0;

  for (const raw of data) {
    const resort = sanitizeResort(raw);
    if (resort) resorts.push(resort);
    else dropped++;
  }

  return { resorts, dropped };
}
