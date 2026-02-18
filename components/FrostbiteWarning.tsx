'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { calculateWindChill } from '@/lib/unitConversion';
import { getFrostbiteWarning } from '@/lib/snowLogic';

interface FrostbiteWarningProps {
  temperature: number;
  windSpeed: number;
}

export default function FrostbiteWarning({ temperature, windSpeed }: FrostbiteWarningProps) {
  const windChill = calculateWindChill(temperature, windSpeed);
  const warning = getFrostbiteWarning(windChill);

  if (warning.level === 'none') return null;

  const colorClass = 
    warning.level === 'extreme' ? 'border-red-600 bg-red-600/20' :
    warning.level === 'danger' ? 'border-mountain-danger bg-mountain-danger/20' :
    'border-orange-500 bg-orange-500/20';

  const textColor = 
    warning.level === 'extreme' ? 'text-red-500' :
    warning.level === 'danger' ? 'text-mountain-danger' :
    'text-orange-500';

  return (
    <div className={`glass-card border-2 ${colorClass} ${warning.level === 'extreme' ? 'animate-pulse' : ''}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`p-2 sm:p-3 rounded-xl flex-shrink-0 ${
          warning.level === 'extreme' ? 'bg-red-600/30' :
          warning.level === 'danger' ? 'bg-mountain-danger/30' :
          'bg-orange-500/30'
        }`}>
          <ExclamationTriangleIcon className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 ${textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-base sm:text-lg md:text-xl font-bold ${textColor} mb-1 sm:mb-2`}>
            {warning.level === 'extreme' ? '🥶 EXTREME COLD WARNING' : '❄️ FROSTBITE RISK'}
          </div>
          <div className="text-sm sm:text-base text-white font-semibold mb-1">
            Wind Chill: {Math.round(windChill)}°F
          </div>
          <div className="text-xs sm:text-sm text-gray-300">
            {warning.message}
          </div>
          <div className="text-xs text-gray-400 mt-1 sm:mt-2">
            Temp: {Math.round(temperature)}°F • Wind: {Math.round(windSpeed)} mph
          </div>
        </div>
      </div>
    </div>
  );
}
