'use client';

import { useUnits } from '@/hooks/useUnits';
import { formatSnow } from '@/lib/units';

interface RecentSnowCardProps {
  /** Inches that fell in the trailing 24h, or null when no history exists. */
  observedSnow24h: number | null;
  observedSnow48h: number | null;
}

/**
 * Snow that has already fallen.
 *
 * Everything else on the page is a forecast. This is the only number that has
 * actually happened, and at 6am it is often the one that decides the day — a
 * foot that landed yesterday is still on the mountain, and no amount of
 * "next 24 hours" tells you it is there.
 *
 * Hides itself when no history is available rather than showing a zero, which
 * would read as "nothing fell" instead of "we don't know".
 */
export default function RecentSnowCard({
  observedSnow24h,
  observedSnow48h,
}: RecentSnowCardProps) {
  const { units } = useUnits();

  if (observedSnow48h === null && observedSnow24h === null) return null;

  const total = observedSnow48h ?? observedSnow24h ?? 0;
  const assessment =
    total < 1
      ? { label: 'Nothing new', tone: 'text-gray-400', note: 'Whatever is down there has been there a while.' }
      : total < 4
        ? { label: 'A refresh', tone: 'text-cyan-400', note: 'Enough to soften the groomers.' }
        : total < 8
          ? { label: 'Worth chasing', tone: 'text-emerald-400', note: 'Still soft in the trees and on shaded aspects.' }
          : { label: 'Recent dump', tone: 'text-cyan-300', note: 'Tracked out by now on the obvious lines. Go looking.' };

  return (
    <div className="glass-card">
      <h3 className="metric-label mb-3">Already Fell</h3>

      <div className={`text-3xl font-bold ${assessment.tone}`}>
        {formatSnow(total, units)}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{assessment.label}</div>

      {/* Only worth splitting out when something actually fell, and when the
          two windows differ — "0cm of it in the last 24 hours" is noise. */}
      {observedSnow24h !== null && observedSnow48h !== null && observedSnow24h >= 0.1 && (
        <p className="mt-2 text-xs text-gray-400">
          {observedSnow48h - observedSnow24h < 0.1
            ? 'All of it in the last 24 hours'
            : `${formatSnow(observedSnow24h, units)} of it in the last 24 hours`}
        </p>
      )}

      <p className="mt-1 text-xs text-gray-400">{assessment.note}</p>
      <p className="mt-3 text-[11px] text-gray-500">
        Observed over the past 48 hours, not a forecast.
      </p>
    </div>
  );
}
