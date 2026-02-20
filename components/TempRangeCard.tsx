'use client';

import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/solid';

interface TempRangeCardProps {
  maxTemp24h: number;
  minTemp24h: number;
  currentTemp: number;
  maxPrecipProb24h: number;
}

export default function TempRangeCard({ 
  maxTemp24h, 
  minTemp24h, 
  currentTemp,
  maxPrecipProb24h 
}: TempRangeCardProps) {
  const tempRange = maxTemp24h - minTemp24h;
  const precipRisk = maxPrecipProb24h > 70 ? 'high' : maxPrecipProb24h > 40 ? 'moderate' : 'low';
  const precipColor = 
    precipRisk === 'high' ? 'text-blue-400' :
    precipRisk === 'moderate' ? 'text-cyan-400' :
    'text-gray-400';

  return (
    <div className="glass-card">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="p-2 sm:p-3 bg-gradient-to-br from-orange-500/20 to-blue-500/20 rounded-xl">
          <div className="flex gap-1">
            <ArrowTrendingUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
            <ArrowTrendingDownIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="metric-label mb-2">24h Outlook</div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-3">
            <div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl sm:text-3xl font-bold text-orange-400">
                  {Math.round(maxTemp24h)}°
                </div>
                <div className="text-base sm:text-lg text-gray-400">
                  / {Math.round(minTemp24h)}°
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">
                High / Low (Range: {Math.round(tempRange)}°)
              </div>
            </div>
            
            <div>
              <div className={`metric-large ${precipColor}`}>
                {Math.round(maxPrecipProb24h)}%
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1 capitalize">
                Precip Chance
              </div>
            </div>
          </div>

          <div className="text-xs sm:text-sm text-gray-300">
            Current: <span className="text-cyan-400 font-semibold">{Math.round(currentTemp)}°F</span>
            {maxPrecipProb24h > 50 && (
              <span className="ml-2">
                • <span className={precipColor}>Precipitation likely</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
