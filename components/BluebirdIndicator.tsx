'use client';

import { SunIcon } from '@heroicons/react/24/solid';

interface BluebirdIndicatorProps {
  isBluebird: boolean;
  skyCover: number;
  windSpeed: number;
}

export default function BluebirdIndicator({ isBluebird, skyCover, windSpeed }: BluebirdIndicatorProps) {
  if (!isBluebird) return null;

  return (
    <div className="glass-card border-2 border-yellow-400 bg-gradient-to-r from-blue-500/20 to-yellow-400/20">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-yellow-400/30 rounded-xl flex-shrink-0">
          <SunIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-400 mb-1 sm:mb-2">
            🕶️ BLUEBIRD DAY! 🕶️
          </div>
          <div className="text-base sm:text-lg text-white">
            Perfect conditions: Clear skies and calm winds
          </div>
          <div className="text-xs sm:text-sm text-gray-300 mt-1 sm:mt-2">
            Cloud cover: {Math.round(skyCover)}% • Wind: {Math.round(windSpeed)} mph
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Don&apos;t forget your sunscreen and goggles! ☀️
          </div>
        </div>
      </div>
    </div>
  );
}
