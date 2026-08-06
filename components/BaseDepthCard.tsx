'use client';

import { useUnits } from '@/hooks/useUnits';
import { formatDepth } from '@/lib/units';

interface BaseDepthCardProps {
  snowDepthIn: number | null;
}

/**
 * Settled snow already on the ground.
 *
 * Everything else in the app is forecast — what *will* fall. Early and late
 * season, the question that decides the trip is what is already there. Only
 * Open-Meteo supplies this; the card hides itself when the provider does not.
 */
export default function BaseDepthCard({ snowDepthIn }: BaseDepthCardProps) {
  const { units } = useUnits();

  if (snowDepthIn === null) return null;

  const assessment =
    snowDepthIn < 12
      ? { label: 'Thin cover', tone: 'text-red-400', note: 'Early season — watch for rocks and thin patches.' }
      : snowDepthIn < 30
        ? { label: 'Modest base', tone: 'text-yellow-400', note: 'Groomers should be fine; off-piste still hungry.' }
        : snowDepthIn < 60
          ? { label: 'Solid base', tone: 'text-cyan-400', note: 'Good coverage across the mountain.' }
          : { label: 'Deep base', tone: 'text-emerald-400', note: 'Everything is open and well covered.' };

  return (
    <div className="glass-card">
      <h3 className="metric-label mb-3">Base Depth</h3>

      <div className={`text-3xl font-bold ${assessment.tone}`}>
        {formatDepth(snowDepthIn, units)}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{assessment.label}</div>
      <p className="mt-1 text-xs text-gray-400">{assessment.note}</p>
      <p className="mt-3 text-[11px] text-gray-500">
        Modelled snow depth at the forecast point — not a groomed-trail report.
      </p>
    </div>
  );
}
