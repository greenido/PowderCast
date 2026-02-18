'use client';

import { ArrowsUpDownIcon } from '@heroicons/react/24/outline';

interface ElevationToggleProps {
  elevation: 'base' | 'summit';
  onToggle: (elevation: 'base' | 'summit') => void;
  baseElevation: number;
  summitElevation: number;
}

export default function ElevationToggle({
  elevation,
  onToggle,
  baseElevation,
  summitElevation,
}: ElevationToggleProps) {
  return (
    <div className="glass-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ArrowsUpDownIcon className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
          <span className="font-semibold text-base sm:text-lg">Elevation View</span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => onToggle('base')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all ${
              elevation === 'base'
                ? 'bg-cyan-400 text-slate-900'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Base ({baseElevation.toLocaleString()}ft)
          </button>
          <button
            onClick={() => onToggle('summit')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all ${
              elevation === 'summit'
                ? 'bg-cyan-400 text-slate-900'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Summit ({summitElevation.toLocaleString()}ft)
          </button>
        </div>
      </div>
    </div>
  );
}
