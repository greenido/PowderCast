'use client';

import { useUnits } from '@/hooks/useUnits';
import { formatWind } from '@/lib/units';
import { degreesToCompass, windLoadedAspects } from '@/lib/resortGeo';

interface WindAspectCardProps {
  windDirectionDeg: number | null;
  windSpeedMph: number;
  gustMph: number;
}

/**
 * Where the wind is putting the snow.
 *
 * Wind strips snow off windward slopes and deposits it on lee slopes, so on
 * any windy day the same mountain holds boot-deep pockets on one aspect and
 * scoured hardpack on the other. Riders who know this chase it; the app had
 * the wind direction in its data and never surfaced it.
 */
export default function WindAspectCard({
  windDirectionDeg,
  windSpeedMph,
  gustMph,
}: WindAspectCardProps) {
  const { units } = useUnits();

  if (windDirectionDeg === null) return null;

  const from = degreesToCompass(windDirectionDeg);
  const { loaded, scoured } = windLoadedAspects(windDirectionDeg);

  // Below about 15mph wind does not meaningfully redistribute snow.
  const isTransporting = windSpeedMph >= 15 || gustMph >= 25;

  return (
    <div className="glass-card">
      <h3 className="metric-label mb-3">Wind &amp; Aspect</h3>

      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5"
          title={`Wind from ${from} (${Math.round(windDirectionDeg)}°)`}
        >
          <span
            className="text-2xl leading-none"
            style={{ transform: `rotate(${windDirectionDeg + 180}deg)` }}
            aria-hidden
          >
            ↑
          </span>
        </div>

        <div>
          <div className="text-xl font-bold text-white">
            {from} <span className="text-sm font-medium text-gray-400">wind</span>
          </div>
          <div className="text-sm text-gray-400">
            {formatWind(windSpeedMph, units)} · gusting {formatWind(gustMph, units)}
          </div>
        </div>
      </div>

      {isTransporting ? (
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 rounded bg-cyan-500/15 px-1.5 py-0.5 font-bold text-cyan-300">
              LOADED
            </span>
            <span className="text-gray-300">
              <strong className="text-white">{loaded.join(', ')}</strong> aspects —
              wind-deposited snow, deeper and softer.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 rounded bg-orange-500/15 px-1.5 py-0.5 font-bold text-orange-300">
              SCOURED
            </span>
            <span className="text-gray-300">
              <strong className="text-white">{scoured.join(', ')}</strong> aspects —
              stripped back to firm base.
            </span>
          </div>
          <p className="pt-1 text-[11px] text-gray-500">
            Wind-loaded slopes also carry higher avalanche risk. Check the local
            bulletin before riding off-piste.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-gray-400">
          Winds are too light to move much snow — conditions should be even
          across aspects.
        </p>
      )}
    </div>
  );
}
