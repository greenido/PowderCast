'use client';

import { useUnits } from '@/hooks/useUnits';

/**
 * Metric / imperial switch.
 *
 * Non-negotiable once the app covers Europe and Japan — "6 inches at 28°F"
 * is meaningless to most of the world's riders. Defaults follow the viewer's
 * locale and then the selected resort's country, until they choose explicitly.
 */
export default function UnitsToggle() {
  const { units, setUnits, hydrated } = useUnits();

  // Render nothing until hydrated so SSR markup and the stored preference
  // cannot disagree.
  if (!hydrated) return null;

  return (
    <div
      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-0.5 text-xs"
      role="group"
      aria-label="Unit system"
    >
      {(['metric', 'imperial'] as const).map((system) => (
        <button
          key={system}
          onClick={() => setUnits(system)}
          aria-pressed={units === system}
          className={`rounded-full px-3 py-1 font-semibold transition-all ${
            units === system
              ? 'bg-white/15 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {system === 'metric' ? '°C · cm' : '°F · in'}
        </button>
      ))}
    </div>
  );
}
