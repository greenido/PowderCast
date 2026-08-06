'use client';

import type { Resort } from '@/lib/types';
import { usePlanner } from '@/hooks/usePlanner';
import { scoreTone, type DayOutlook } from '@/lib/planner';
import { useUnits } from '@/hooks/useUnits';
import { formatSnow, formatWind } from '@/lib/units';
import { PassBadgeList } from '@/components/PassBadge';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface PlannerGridProps {
  resorts: Resort[];
  title: string;
  onSelectResort: (resort: Resort) => void;
}

function weekday(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone,
  }).format(new Date(timestamp));
}

function dayNumber(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(timestamp));
}

/**
 * Resort x day grid answering "where should I go this week?".
 *
 * Every other view in the app shows one mountain at one moment. This is the
 * planning view: the whole region across the whole forecast window, ranked, so
 * the best day and the best mountain are visible at a glance.
 */
export default function PlannerGrid({ resorts, title, onSelectResort }: PlannerGridProps) {
  const { outlooks, loading, errors, refresh } = usePlanner(resorts);
  const { units } = useUnits();

  const columnDays = outlooks[0]?.days ?? [];
  const timezone = outlooks[0]?.resort.timezone ?? 'UTC';

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            🗓️ 7-Day Planner
            <span className="ml-2 text-sm font-medium text-gray-400">{title}</span>
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Every resort, every day, ranked by conditions. Best day per mountain is
            outlined.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-white/10 bg-white/5 p-2.5 transition-colors hover:bg-white/10 disabled:opacity-50"
          aria-label="Refresh planner"
        >
          <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && outlooks.length === 0 && (
        <div className="glass-card py-16 text-center">
          <div className="mb-3 animate-bounce text-4xl">🗓️</div>
          <p className="text-gray-400">Building the outlook across {resorts.length} resorts…</p>
        </div>
      )}

      {outlooks.length > 0 && (
        <div className="glass-card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="sticky left-0 z-10 bg-slate-900/80 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 backdrop-blur">
                  Resort
                </th>
                {columnDays.map((day) => (
                  <th
                    key={day.dayKey}
                    className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400"
                  >
                    <div>{weekday(day.timestamp, timezone)}</div>
                    <div className="text-[10px] font-normal text-gray-500">
                      {dayNumber(day.timestamp, timezone)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {outlooks.map(({ resort, days, best }) => (
                <tr
                  key={resort.id}
                  className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/5"
                >
                  <td className="sticky left-0 z-10 bg-slate-900/80 px-4 py-3 backdrop-blur">
                    <button
                      onClick={() => onSelectResort(resort)}
                      className="text-left transition-colors hover:text-cyan-400"
                    >
                      <div className="text-sm font-semibold text-white">{resort.name}</div>
                      <div className="text-[11px] text-gray-500">{resort.region}</div>
                      <PassBadgeList passes={resort.passes} size="compact" className="mt-1" />
                    </button>
                  </td>

                  {days.map((day) => (
                    <DayCell
                      key={day.dayKey}
                      day={day}
                      isBest={best?.dayKey === day.dayKey && day.score >= 45}
                      units={units}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <p className="text-center text-xs text-gray-500">
          {Object.keys(errors).length} resort(s) could not be loaded.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-gray-500">
        {[80, 65, 45, 30, 0].map((threshold) => {
          const tone = scoreTone(threshold);
          return (
            <span key={threshold} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${tone.bg}`} />
              {tone.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  day,
  isBest,
  units,
}: {
  day: DayOutlook;
  isBest: boolean;
  units: 'metric' | 'imperial';
}) {
  const tone = scoreTone(day.score);

  return (
    <td className="p-1">
      <div
        className={`rounded-lg px-2 py-2.5 text-center ${tone.bg} ${
          isBest ? 'ring-2 ring-inset ring-cyan-400/60' : ''
        }`}
        title={`${tone.label} · score ${day.score}/100 · gusts to ${formatWind(day.maxGustMph, units)}`}
      >
        <div className={`text-sm font-bold tabular-nums ${tone.text}`}>{day.score}</div>
        {day.snowfallIn >= 0.5 && (
          <div className="mt-0.5 text-[11px] font-semibold text-white">
            {formatSnow(day.snowfallIn, units)}
          </div>
        )}
        {day.maxGustMph >= 40 && (
          <div className="mt-0.5 text-[10px] text-orange-300" title="Wind hold risk">
            💨
          </div>
        )}
      </div>
    </td>
  );
}
