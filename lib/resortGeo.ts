/**
 * Geometry helpers for resort points.
 *
 * The base and summit coordinates stored per resort typically sit only a few
 * hundred metres apart — well inside a single NWS 2.5km grid cell, which is
 * why the old base/summit toggle often returned byte-identical forecasts.
 * What actually distinguishes them is ELEVATION, so that is what we pass to
 * providers that can use it.
 */

import type { Resort } from '@/lib/types';

const FEET_PER_METER = 3.28084;

export interface ResortPoint {
  lat: number;
  lon: number;
  elevationM: number;
  elevationFt: number;
}

export function resortPoint(resort: Resort, elevation: 'base' | 'summit'): ResortPoint {
  const isSummit = elevation === 'summit';
  const elevationFt = isSummit ? resort.summit_elevation : resort.base_elevation;

  return {
    lat: isSummit ? resort.summit_lat : resort.base_lat,
    lon: isSummit ? resort.summit_lon : resort.base_lon,
    elevationFt,
    elevationM: elevationFt / FEET_PER_METER,
  };
}

/** Great-circle distance in metres. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/** Meteorological degrees (direction wind comes FROM) to a compass label. */
export function degreesToCompass(degrees: number): string {
  return COMPASS[Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16];
}

/**
 * Aspects that collect wind-deposited snow, given the direction wind is
 * coming from. Snow is stripped from windward slopes and loaded onto lee
 * slopes — so the lee aspect is roughly 180° from the wind origin.
 *
 * Returns the loaded (deep, soft) and scoured (wind-packed, thin) aspects.
 */
export function windLoadedAspects(windFromDegrees: number): {
  loaded: string[];
  scoured: string[];
} {
  const leeCenter = (windFromDegrees + 180) % 360;

  const around = (center: number) =>
    [-45, 0, 45].map((offset) => degreesToCompass((center + offset + 360) % 360));

  return {
    loaded: Array.from(new Set(around(leeCenter))),
    scoured: Array.from(new Set(around(windFromDegrees))),
  };
}
