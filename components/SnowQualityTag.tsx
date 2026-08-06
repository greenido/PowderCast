'use client';

import type { SnowQuality } from '@/lib/snowLogic';
import type { RegionCode } from '@/lib/types';
import type { HourlySnowData } from '@/lib/conditions';
import { snowLabel, detectFirnWindow } from '@/lib/snowVocabulary';
import { useUnits } from '@/hooks/useUnits';
import { formatTemp } from '@/lib/units';

interface SnowQualityTagProps {
  quality: SnowQuality;
  temperature: number | null;
  regionCode?: RegionCode;
  hourly?: HourlySnowData[];
}

export default function SnowQualityTag({
  quality,
  temperature,
  regionCode,
  hourly = [],
}: SnowQualityTagProps) {
  const { units } = useUnits();
  const info = snowLabel(quality, regionCode);
  const firn = detectFirnWindow(hourly.slice(0, 24));

  return (
    <div className="glass-card">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex-shrink-0 text-3xl sm:text-4xl md:text-5xl">{info.emoji}</div>

        <div className="min-w-0 flex-1">
          <div className="metric-label mb-1">Snow Quality</div>

          <div className={`text-xl font-bold sm:text-2xl ${info.color}`}>{info.label}</div>
          {info.localTerm && (
            <div className="text-xs italic text-gray-500">{info.localTerm}</div>
          )}

          <div className="mt-1 text-xs text-gray-400 sm:text-sm">{info.description}</div>

          {temperature !== null && (
            <div className="mt-2 text-xs text-gray-500">
              Temperature during snowfall: {formatTemp(temperature, units)}
            </div>
          )}
        </div>
      </div>

      {/* Spring corn cycle — a two-hour window Alpine riders plan around. */}
      {firn.isFirn && (
        <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-300">
            🌽 Firn window
          </div>
          <p className="mt-1 text-xs text-gray-300">{firn.description}</p>
        </div>
      )}
    </div>
  );
}
