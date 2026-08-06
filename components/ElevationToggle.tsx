'use client';

import { ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import { useUnits } from '@/hooks/useUnits';
import { formatElevation } from '@/lib/units';

interface ElevationToggleProps {
  elevation: 'base' | 'summit';
  onToggle: (elevation: 'base' | 'summit') => void;
  baseElevation: number;
  summitElevation: number;
  /** Which provider served the data, so we can say how elevation was handled. */
  source?: string;
}

export default function ElevationToggle({
  elevation,
  onToggle,
  baseElevation,
  summitElevation,
  source,
}: ElevationToggleProps) {
  const { units } = useUnits();

  // Open-Meteo downscales to the requested elevation; NWS cannot, so the
  // summit view there is a lapse-rate correction rather than a real forecast.
  const isModelled = source === 'nws' && elevation === 'summit';

  return (
    <div className="glass-card">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <ArrowsUpDownIcon className="h-5 w-5 text-cyan-400 sm:h-6 sm:w-6" />
          <span className="text-base font-semibold sm:text-lg">Elevation View</span>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {(['base', 'summit'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onToggle(level)}
              aria-pressed={elevation === level}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all sm:px-6 sm:py-3 sm:text-base ${
                elevation === level
                  ? 'bg-cyan-400 text-slate-900'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {level === 'base' ? 'Base' : 'Summit'} (
              {formatElevation(level === 'base' ? baseElevation : summitElevation, units)})
            </button>
          ))}
        </div>
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
