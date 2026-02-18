'use client';

import { getSnowQualityInfo } from '@/lib/snowLogic';
import type { SnowQuality } from '@/lib/snowLogic';

interface SnowQualityTagProps {
  quality: SnowQuality;
  temperature: number | null;
}

export default function SnowQualityTag({ quality, temperature }: SnowQualityTagProps) {
  const info = getSnowQualityInfo(quality);

  return (
    <div className="glass-card">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-3xl sm:text-4xl md:text-5xl flex-shrink-0">{info.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="metric-label mb-1">Snow Quality</div>
          <div className={`text-xl sm:text-2xl font-bold ${info.color}`}>
            {quality}
          </div>
          <div className="text-xs sm:text-sm text-gray-400 mt-1">
            {info.description}
          </div>
          {temperature !== null && (
            <div className="text-xs text-gray-500 mt-2">
              Precipitation temp: {Math.round(temperature)}°F
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
