'use client';

import type { Resort } from '@/lib/types';
import { useMultiForecast } from '@/hooks/useForecast';
import { usePlanner } from '@/hooks/usePlanner';
import { useUnits } from '@/hooks/useUnits';
import { calculateRideScore, getRideScoreLabel } from '@/lib/rideScore';
import { formatSnow } from '@/lib/units';
import { ChevronRightIcon } from '@heroicons/react/24/solid';

interface HomePicksProps {
  title: string;
  subtitle: string;
  resorts: Resort[];
  /** How many rows to show once ranked. Fetches cover every resort passed in. */
  show: number;
  /** Also fetch the week, to name each mountain's best day. */
  withBestDay?: boolean;
  onSelectResort: (resort: Resort) => void;
  seeAllLabel: string;
  onSeeAll: () => void;
}

function weekday(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(
    new Date(timestamp)
  );
}

/**
 * The home screen's answer: how are my mountains doing today?
 *
 * A returning rider landed on a hero, a pass filter, a units switch, the view
 * tabs, search, a location button and a welcome card with no data in it. Their
 * favorites were behind a star. This puts those mountains, ranked by today's
 * Ride Score, on the first screen; a first visit gets the top few in the
 * rider's likely home range instead.
 */
export default function HomePicks({
  title,
  subtitle,
  resorts,
  show,
  withBestDay = false,
  onSelectResort,
  seeAllLabel,
  onSeeAll,
}: HomePicksProps) {
  const { data, errors, loading } = useMultiForecast(resorts);
  const { outlooks } = usePlanner(withBestDay ? resorts : []);
  const { units } = useUnits();

  if (resorts.length === 0) return null;

  const bestDay = new Map(outlooks.map((o) => [o.resort.id, o.best]));

  const rows = resorts
    .map((resort) => ({
      resort,
      weather: data[resort.id] ?? null,
      score: data[resort.id] ? calculateRideScore(data[resort.id]).score : -1,
    }))
    // Scored first, best first; unloaded ones keep their order at the end.
    .sort((a, b) => b.score - a.score)
    .slice(0, show);

  return (
    <section className="glass-card mx-auto max-w-2xl p-0" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="truncate text-xs text-gray-400">{subtitle}</p>
        </div>
        <button
          onClick={onSeeAll}
          className="shrink-0 text-xs font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
        >
          {seeAllLabel}
        </button>
      </div>

      <ol className="divide-y divide-white/5">
        {rows.map(({ resort, weather, score }) => {
          const best = bestDay.get(resort.id);
          const label = weather ? getRideScoreLabel(score) : null;
          const status = errors[resort.id]
            ? 'Could not load the forecast'
            : !weather && loading
              ? 'Loading…'
              : resort.region;

          return (
            <li key={resort.id}>
              <button
                onClick={() => onSelectResort(resort)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 sm:px-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{resort.name}</span>
                  <span className="block truncate text-xs text-gray-400">
                    {weather ? (
                      <>
                        {label!.label}
                        {weather.snow24h > 0 && (
                          <span className="text-cyan-300">
                            {' '}
                            · {formatSnow(weather.snow24h, units)} next 24h
                          </span>
                        )}
                        {best && best.score >= 45 && (
                          <>
                            {' '}
                            · best {weekday(best.timestamp, resort.timezone)} ({best.score})
                          </>
                        )}
                      </>
                    ) : (
                      <span className={errors[resort.id] ? 'text-red-400' : undefined}>
                        {status}
                      </span>
                    )}
                  </span>
                </span>

                {label ? (
                  <span
                    className={`w-11 shrink-0 rounded-md border py-1 text-center text-base font-bold tabular-nums ${label.bgColor} ${label.color} ${label.borderColor}`}
                  >
                    {score}
                  </span>
                ) : (
                  loading && <span className="h-8 w-11 shrink-0 animate-pulse rounded-md bg-white/10" />
                )}
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-500" />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
