'use client';

import type { PassAffiliation } from '@/lib/types';
import { PASSES, describeAccess, sortAffiliations } from '@/lib/passes';

interface PassBadgeProps {
  affiliation: PassAffiliation;
  /** `compact` drops the access text — for dense lists. */
  size?: 'compact' | 'full';
}

export function PassBadge({ affiliation, size = 'full' }: PassBadgeProps) {
  const meta = PASSES[affiliation.pass];
  if (!meta) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.className}`}
      title={`${meta.name} — ${describeAccess(affiliation)} (${affiliation.season})`}
    >
      {meta.short}
      {size === 'full' && (
        <span className="font-medium normal-case opacity-75">
          {affiliation.access === 'unlimited' ? '∞' : describeAccess(affiliation)}
        </span>
      )}
    </span>
  );
}

interface PassBadgeListProps {
  passes: PassAffiliation[] | undefined;
  size?: 'compact' | 'full';
  className?: string;
}

export function PassBadgeList({ passes, size = 'full', className = '' }: PassBadgeListProps) {
  if (!passes || passes.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {sortAffiliations(passes).map((affiliation) => (
        <PassBadge key={affiliation.pass} affiliation={affiliation} size={size} />
      ))}
    </div>
  );
}
