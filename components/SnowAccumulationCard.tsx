'use client';

import { CloudIcon } from '@heroicons/react/24/solid';
import { formatSnow } from '@/lib/units';
import { useUnits } from '@/hooks/useUnits';
import type { SnowRange } from '@/lib/conditions';
import type { UnitSystem } from '@/lib/units';

interface SnowAccumulationCardProps {
  snow24h: number;
  snow7day: number;
  /** Model spread, when more than one model answered. */
  range24h?: SnowRange | null;
  range7day?: SnowRange | null;
  /**
   * False when the serving models publish no snowfall for this point. A zero
   * then means "unknown", and printing it as 0" is a lie riders act on.
   */
  available?: boolean;
}

/**
 * Renders a total, widened into a range where the models disagree.
 *
 * A single number implies a precision nobody has. Where two models are within
 * an inch it is not worth the clutter, so the range only appears when it
 * actually changes the decision.
 */
function Total({
  inches,
  range,
  units,
  tone,
}: {
  inches: number;
  range: SnowRange | null | undefined;
  units: UnitSystem;
  tone: string;
}) {
  if (range && !range.agree) {
    return (
      <div className={`metric-large ${tone}`}>
        <span className="whitespace-nowrap">
          {formatSnow(range.lowIn, units)}
          <span className="px-1 text-gray-500">–</span>
          {formatSnow(range.highIn, units)}
        </span>
      </div>
    );
  }

  return <div className={`metric-large ${tone}`}>{formatSnow(inches, units)}</div>;
}

export default function SnowAccumulationCard({
  snow24h,
  snow7day,
  range24h,
  range7day,
  available = true,
}: SnowAccumulationCardProps) {
  const { units } = useUnits();

  // Any disagreement across the two windows is worth a word, since the card is
  // where someone decides whether to trust the number above it.
  const spread = range24h && !range24h.agree ? range24h : range7day && !range7day.agree ? range7day : null;
  const agreement = range24h ?? range7day ?? null;

  return (
    <div className="glass-card">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="p-2 sm:p-3 bg-cyan-400/20 rounded-xl">
          <CloudIcon className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="metric-label mb-2">Snow Forecast</div>

          {available ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <div>
                  <Total
                    inches={snow24h}
                    range={range24h}
                    units={units}
                    tone="text-cyan-400"
                  />
                  <div className="text-xs sm:text-sm text-gray-400 mt-1">Next 24 Hours</div>
                </div>

                <div>
                  <Total
                    inches={snow7day}
                    range={range7day}
                    units={units}
                    tone="text-cyan-300"
                  />
                  <div className="text-xs sm:text-sm text-gray-400 mt-1">Next 7 Days</div>
                </div>
              </div>

              {spread ? (
                <p className="mt-3 text-[11px] leading-snug text-amber-300/80">
                  ⚖️ {spread.models} models disagree on this storm — treat the range as the
                  forecast, not the middle of it.
                </p>
              ) : (
                agreement && (
                  <p className="mt-3 text-[11px] text-gray-500">
                    ✓ {agreement.models} models agree
                  </p>
                )
              )}
            </>
          ) : (
            /* Better to say nothing than to say zero. An all-null snowfall
               series used to sum to a confident 0", which is how a storm could
               read as a dry week. */
            <>
              <div className="metric-large text-gray-500">—</div>
              <p className="mt-2 text-xs leading-snug text-gray-400">
                No snowfall forecast available for this point right now. This is missing
                data, not a dry forecast.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
