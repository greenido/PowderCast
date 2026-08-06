import type { RegionCode, Resort } from '@/lib/types';

export interface RegionMeta {
  code: RegionCode;
  label: string;
  emoji: string;
}

/** Display order roughly follows how riders think about the map. */
export const REGIONS: RegionMeta[] = [
  { code: 'us-west', label: 'US West', emoji: '🌲' },
  { code: 'us-rockies', label: 'US Rockies', emoji: '🏔️' },
  { code: 'us-east', label: 'US East & Midwest', emoji: '🍁' },
  { code: 'alps', label: 'Alps', emoji: '🇨🇭' },
  { code: 'dolomites', label: 'Dolomites', emoji: '🇮🇹' },
  { code: 'pyrenees', label: 'Pyrenees', emoji: '🇦🇩' },
  { code: 'japan', label: 'Japan', emoji: '🇯🇵' },
  { code: 'scandinavia', label: 'Scandinavia', emoji: '🇳🇴' },
  { code: 'canada', label: 'Canada', emoji: '🇨🇦' },
];

export const REGION_LABELS: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.code, r.label])
);

/** Regions that actually have resorts in the current dataset. */
export function availableRegions(resorts: Resort[]): RegionMeta[] {
  const present = new Set(resorts.map((r) => r.regionCode));
  return REGIONS.filter((r) => present.has(r.code));
}

/**
 * Resorts in a region, largest first.
 *
 * Comparison views fetch one forecast per resort, so they are capped. Sorting
 * by size means the cap keeps the resorts people actually travel to rather
 * than an alphabetical slice.
 */
export function resortsInRegion(
  resorts: Resort[],
  regionCode: RegionCode,
  limit = 12
): Resort[] {
  return resorts
    .filter((r) => r.regionCode === regionCode)
    .sort((a, b) => (b.runsKm ?? 0) - (a.runsKm ?? 0))
    .slice(0, limit);
}
