'use client';

import type { Resort } from '@/lib/types';
import { usePlanner } from '@/hooks/usePlanner';
import { scoreTone } from '@/lib/planner';
import { useUnits } from '@/hooks/useUnits';
import { formatSnow } from '@/lib/units';

function dayLabel(timestamp: number, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).format(
    new Date(timestamp)
  );
}

/**
 * "Which day this week?" for one mountain.
 *
 * The resort page answered "how is it now" and nothing else; finding the best
 * day meant switching to the planner and hunting for the row. This is that
 * row. It reads the planner's own mid-mountain outlook (and its cache), so a
 * day scores the same here as it does in the grid.
 */
export default function ResortWeekStrip({ resort }: { resort: Resort }) {
  const { outlooks, loading } = usePlanner([resort]);
  const { units } = useUnits();
  const outlook = outlooks.find((o) => o.resort.id === resort.id);

  if (!outlook) {
    if (!loading) return null;
    return (
      <div className="glass-card" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const { days, best } = outlook;
  const maxSnow = Math.max(...days.map((d) => d.snowfallIn), 1);

  return (
    <section className="glass-card" aria-label={`The week at ${resort.name}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="metric-label">This week</h3>
        <span className="text-[11px] text-gray-500">Mid-mountain · same scores as the planner</span>
      </div>

      <ol className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((day) => {
          const weekday = dayLabel(day.timestamp, resort.timezone, { weekday: 'short' });
          const date = dayLabel(day.timestamp, resort.timezone, { day: 'numeric' });

          if (!day.hasData) {
            return (
              <li
                key={day.dayKey}
                className="flex flex-col items-center rounded-lg border border-dashed border-white/10 py-2 text-center"
                title="No forecast published for this day"
              >
                <span className="text-[11px] font-semibold uppercase text-gray-500">{weekday}</span>
                <span className="text-[10px] text-gray-600">{date}</span>
                <span className="mt-auto pt-2 text-sm font-bold text-gray-600">–</span>
              </li>
            );
          }

          const tone = scoreTone(day.score);
          // Same bar as the planner grid's outline: the best day, if it is any good.
          const isBest = best?.dayKey === day.dayKey && day.score >= 45;
          const snow = day.snowfallIn >= 0.5 ? formatSnow(day.snowfallIn, units) : null;

          return (
            <li
              key={day.dayKey}
              className={`flex flex-col items-center rounded-lg bg-white/5 py-2 text-center ${
                isBest ? 'ring-2 ring-inset ring-cyan-400/60' : ''
              }`}
              title={`${tone.label} · score ${day.score}/100${snow ? ` · ${snow} snow` : ''}`}
            >
              <span className="text-[11px] font-semibold uppercase text-gray-400">{weekday}</span>
              <span className="text-[10px] text-gray-500">{date}</span>

              {/* Snow bar, scaled to the snowiest day of the week. */}
              <span className="mt-1.5 flex h-8 w-2.5 items-end overflow-hidden rounded-full bg-white/5">
                <span
                  className="w-full rounded-full bg-cyan-400/80"
                  style={{ height: `${Math.round((day.snowfallIn / maxSnow) * 100)}%` }}
                />
              </span>
              <span className="h-4 text-[10px] font-semibold leading-4 text-cyan-300">{snow}</span>

              <span
                className={`mt-0.5 w-9 rounded-md py-0.5 text-xs font-bold tabular-nums sm:w-10 sm:text-sm ${tone.bg} ${tone.text}`}
              >
                {day.score}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
