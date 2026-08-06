'use client';

import type { Resort } from '@/lib/types';
import { useUnits } from '@/hooks/useUnits';
import { formatElevation } from '@/lib/units';

interface FreezingLevelCardProps {
  freezingLevelFt: number | null;
  resort: Resort;
}

/**
 * Snow line vs. the mountain.
 *
 * This is the single most useful number in the Alps and the maritime US
 * ranges, and the app never showed it. With an 800m base in Europe the real
 * question on a marginal day is not "how much precipitation" but "is it
 * falling as rain at the bottom" — and that is entirely decided by where the
 * freezing level sits relative to base and summit.
 */
export default function FreezingLevelCard({
  freezingLevelFt,
  resort,
}: FreezingLevelCardProps) {
  const { units } = useUnits();

  if (freezingLevelFt === null) return null;

  const base = resort.base_elevation;
  const summit = resort.summit_elevation;

  const belowBase = freezingLevelFt <= base;
  const aboveSummit = freezingLevelFt >= summit;

  // Where the snow line sits as a fraction of the mountain, for the gauge.
  const fraction = Math.max(
    0,
    Math.min(1, (freezingLevelFt - base) / Math.max(1, summit - base))
  );

  const status = belowBase
    ? {
        headline: 'Snow to the base',
        detail: 'Freezing level is below the bottom lift — snow all the way down.',
        tone: 'text-cyan-400',
        ring: 'border-cyan-400/30',
      }
    : aboveSummit
      ? {
          headline: 'Rain on the whole mountain',
          detail: 'Freezing level is above the summit — expect rain, not snow.',
          tone: 'text-red-400',
          ring: 'border-red-400/30',
        }
      : {
          headline: 'Mixed — rain low, snow high',
          detail: `Snow above ${formatElevation(freezingLevelFt, units)}, rain below. Stay on the upper mountain.`,
          tone: 'text-yellow-400',
          ring: 'border-yellow-400/30',
        };

  return (
    <div className={`glass-card border ${status.ring}`}>
      <h3 className="metric-label mb-3">Snow Line</h3>

      <div className={`text-2xl font-bold ${status.tone}`}>
        {formatElevation(freezingLevelFt, units)}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{status.headline}</div>
      <p className="mt-1 text-xs text-gray-400">{status.detail}</p>

      {/* Vertical gauge: summit at top, base at bottom, snow line marked. */}
      <div className="mt-4 flex items-stretch gap-3">
        <div className="relative w-2 rounded-full bg-gradient-to-t from-emerald-900/60 to-white/30">
          {!belowBase && !aboveSummit && (
            <div
              className="absolute -left-1 h-0.5 w-4 bg-yellow-400"
              style={{ bottom: `${fraction * 100}%` }}
              aria-hidden
            />
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between py-0.5 text-[11px] text-gray-400">
          <div className="flex justify-between">
            <span>Summit</span>
            <span className="tabular-nums">{formatElevation(summit, units)}</span>
          </div>
          <div className="flex justify-between">
            <span>Base</span>
            <span className="tabular-nums">{formatElevation(base, units)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
