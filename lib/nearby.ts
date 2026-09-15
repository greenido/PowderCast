/**
 * "What's near me?" — resorts ranked by distance from a point.
 *
 * Straight-line (great-circle) distance, not drive time. Drive time needs a
 * routing service and an API key, which this static app deliberately has
 * none of; as a ranking, crow-flies distance puts the same resorts at the top
 * for everyone outside a handful of mountain-pass edge cases.
 */

import type { Resort } from '@/lib/types';
import { haversineMeters } from '@/lib/resortGeo';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface NearbyResort {
  resort: Resort;
  distanceKm: number;
}

/** Resorts sorted nearest first, measured to the base area. */
export function resortsNear(resorts: Resort[], origin: LatLon, limit = 10): NearbyResort[] {
  return resorts
    .map((resort) => ({
      resort,
      distanceKm: haversineMeters(origin.lat, origin.lon, resort.base_lat, resort.base_lon) / 1000,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** Lookup of resort id → distance, for views that render their own lists. */
export function distanceIndex(nearby: NearbyResort[]): Record<string, number> {
  return Object.fromEntries(nearby.map(({ resort, distanceKm }) => [resort.id, distanceKm]));
}
