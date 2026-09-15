'use client';

import { SparklesIcon } from '@heroicons/react/24/solid';
import { useUnits } from '@/hooks/useUnits';
import { formatSnow } from '@/lib/units';

interface PowderAlertProps {
  snow24h: number;
}

export default function PowderAlert({ snow24h }: PowderAlertProps) {
  const { units } = useUnits();

  if (snow24h < 6) return null;

  return (
    <div className="glass-card border-2 border-cyan-400 animate-pulse-slow">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative flex-shrink-0">
          <SparklesIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-cyan-400 animate-snowfall" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-cyan-400 mb-1 sm:mb-2">
            ❄️ POWDER ALERT! ❄️
          </div>
          <div className="text-base sm:text-lg text-white">
            {formatSnow(snow24h, units)} of fresh snow in the last 24 hours!
          </div>
          <div className="text-xs sm:text-sm text-gray-300 mt-1 sm:mt-2">
            Get ready for epic face shots and deep turns! 🏂
          </div>
        </div>
      </div>
    </div>
  );
}
