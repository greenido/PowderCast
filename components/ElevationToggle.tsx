'use client';

import type { ReactNode } from 'react';
import { useUnits } from '@/hooks/useUnits';
import { formatElevation } from '@/lib/units';

interface ElevationToggleProps {
  elevation: 'base' | 'summit';
  onToggle: (elevation: 'base' | 'summit') => void;
  baseElevation: number;
  summitElevation: number;
  /** Which provider served the data, so we can say how elevation was handled. */
  source?: string;
  /** Extra controls on the same row, e.g. the Pro View switch. */
  trailing?: ReactNode;
}

export default function ElevationToggle({
  elevation,
  onToggle,
  baseElevation,
  summitElevation,
  source,
  trailing,
}: ElevationToggleProps) {
  const { units } = useUnits();

  // Open-Meteo downscales to the requested elevation; NWS cannot, so the
  // summit view there is a lapse-rate correction rather than a real forecast.
  const isModelled = source === 'nws' && elevation === 'summit';

  return (
    <div className="glass-card py-3 sm:py-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-black/20 p-1 sm:max-w-md"
          role="group"
          aria-label="Forecast elevation"
        >
          {(['base', 'summit'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onToggle(level)}
              aria-pressed={elevation === level}
              className={`rounded-lg px-3 py-1.5 text-center transition-all ${
                elevation === level
                  ? 'bg-cyan-400 text-slate-900'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <span className="block text-sm font-bold">
                {level === 'base' ? 'Base' : 'Summit'}
              </span>
              <span
                className={`block text-[11px] tabular-nums ${
                  elevation === level ? 'text-slate-800' : 'text-gray-400'
                }`}
              >
                {formatElevation(level === 'base' ? baseElevation : summitElevation, units)}
              </span>
            </button>
          ))}
        </div>

        {trailing}
      </div>

      {isModelled && (
        <p className="mt-3 text-[11px] text-gray-500">
          Summit conditions are modelled from the valley forecast using a lapse
          rate — the National Weather Service publishes one forecast per 2.5km
          grid cell and cannot resolve the vertical.
        </p>
      )}
    </div>
  );
}
