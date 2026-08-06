import type { PassId, PassAccess, PassAffiliation, Resort } from '@/lib/types';

export interface PassMeta {
  id: PassId;
  name: string;
  /** Compact label for badges. */
  short: string;
  operator: string;
  url: string;
  /** Tailwind classes for the badge. */
  className: string;
}

export const PASSES: Record<PassId, PassMeta> = {
  ikon: {
    id: 'ikon',
    name: 'Ikon Pass',
    short: 'Ikon',
    operator: 'Alterra Mountain Company',
    url: 'https://www.ikonpass.com/en/destinations',
    className: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
  },
  epic: {
    id: 'epic',
    name: 'Epic Pass',
    short: 'Epic',
    operator: 'Vail Resorts',
    url: 'https://www.epicpass.com',
    className: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
  },
  'mountain-collective': {
    id: 'mountain-collective',
    name: 'Mountain Collective',
    short: 'MtnCol',
    operator: 'Mountain Collective',
    url: 'https://mountaincollective.com',
    className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
  },
  indy: {
    id: 'indy',
    name: 'Indy Pass',
    short: 'Indy',
    operator: 'Indy Pass',
    url: 'https://www.indyskipass.com',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  },
};

export const PASS_ORDER: PassId[] = ['ikon', 'epic', 'mountain-collective', 'indy'];

/** Short human description of what an affiliation gets you. */
export function describeAccess(affiliation: PassAffiliation): string {
  switch (affiliation.access) {
    case 'unlimited':
      return 'Unlimited';
    case 'limited':
      return affiliation.days ? `${affiliation.days} days` : 'Limited';
    case 'partner':
      return affiliation.days ? `${affiliation.days} days (partner)` : 'Partner';
  }
}

/** Unlimited sorts ahead of limited, which sorts ahead of partner. */
const ACCESS_RANK: Record<PassAccess, number> = {
  unlimited: 0,
  limited: 1,
  partner: 2,
};

export function sortAffiliations(affiliations: PassAffiliation[]): PassAffiliation[] {
  return [...affiliations].sort(
    (a, b) =>
      ACCESS_RANK[a.access] - ACCESS_RANK[b.access] ||
      PASS_ORDER.indexOf(a.pass) - PASS_ORDER.indexOf(b.pass)
  );
}

export function hasPass(resort: Resort, pass: PassId): boolean {
  return (resort.passes ?? []).some((a) => a.pass === pass);
}

/** Filter to resorts covered by ANY of the selected passes. Empty = no filter. */
export function filterByPasses(resorts: Resort[], selected: PassId[]): Resort[] {
  if (selected.length === 0) return resorts;
  return resorts.filter((resort) => selected.some((pass) => hasPass(resort, pass)));
}

/** Count resorts per pass, for filter-chip badges. */
export function countByPass(resorts: Resort[]): Record<PassId, number> {
  const counts = { ikon: 0, epic: 0, 'mountain-collective': 0, indy: 0 } as Record<
    PassId,
    number
  >;
  for (const resort of resorts) {
    for (const affiliation of resort.passes ?? []) {
      counts[affiliation.pass] = (counts[affiliation.pass] ?? 0) + 1;
    }
  }
  return counts;
}
