'use client';

import type { Resort } from '@/lib/types';
import { resortsNear } from '@/lib/nearby';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useUnits } from '@/hooks/useUnits';
import { formatDistance } from '@/lib/units';
import { MapPinIcon } from '@heroicons/react/24/solid';

interface NearbyPanelProps {
  /** Resorts to rank — already narrowed by the pass filter. */
  resorts: Resort[];
  onSelectResort: (resort: Resort) => void;
  onCompareNearby: () => void;
  onPlanNearby: () => void;
}

const SHOWN = 6;

/**
 * "What's near me?" on the welcome screen.
 *
 * Typing a name assumes you already know where to go. From a phone the more
 * common question is which mountains are within reach, so this answers it
 * with one tap and no keyboard.
 */
export default function NearbyPanel({
  resorts,
  onSelectResort,
  onCompareNearby,
  onPlanNearby,
}: NearbyPanelProps) {
  const { position, status, locate } = useGeolocation();
  const { units } = useUnits();

  if (!position) {
    return (
      <div className="glass-card text-center">
        <button
          onClick={locate}
          disabled={status === 'locating'}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-5 py-3 text-sm font-bold text-cyan-300 transition-all hover:bg-cyan-500/25 disabled:opacity-60"
        >
          <MapPinIcon className="h-5 w-5" />
          {status === 'locating' ? 'Finding you…' : 'Show resorts near me'}
        </button>
        {status === 'denied' && (
          <p className="mt-3 text-xs text-gray-400">
            Location access is blocked for this site. Allow it in your browser settings, or
            search by name above.
          </p>
        )}
        {status === 'unavailable' && (
          <p className="mt-3 text-xs text-gray-400">
            Couldn&apos;t get a location from this device. Search by name above instead.
          </p>
        )}
        {status !== 'denied' && status !== 'unavailable' && (
          <p className="mt-3 text-xs text-gray-500">
            Your location stays on this device and is never saved or shared.
          </p>
        )}
      </div>
    );
  }

  const nearby = resortsNear(resorts, position, SHOWN);

  return (
    <div className="glass-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="metric-label flex items-center gap-1.5">
          <MapPinIcon className="h-4 w-4" /> Near you
        </h2>
        <div className="flex gap-2 text-xs font-semibold">
          <button
            onClick={onCompareNearby}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            📊 Compare
          </button>
          <button
            onClick={onPlanNearby}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            🗓️ 7-day
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {nearby.map(({ resort, distanceKm }) => (
          <li key={resort.id}>
            <button
              onClick={() => onSelectResort(resort)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{resort.name}</span>
                <span className="block truncate text-xs text-gray-400">
                  {Array.from(new Set([resort.region, resort.state].filter(Boolean))).join(', ')}
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-cyan-300">
                {formatDistance(distanceKm, units)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
