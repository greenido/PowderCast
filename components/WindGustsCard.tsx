'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { formatWind } from '@/lib/unitConversion';
import { getWindHoldWarning } from '@/lib/snowLogic';

interface WindGustsCardProps {
  currentWindSpeed: number;
  currentWindGust: number;
  maxWindGust24h: number;
  maxWindGust7day: number;
}

export default function WindGustsCard({
  currentWindSpeed,
  currentWindGust,
  maxWindGust24h,
  maxWindGust7day,
}: WindGustsCardProps) {
  const warning = getWindHoldWarning(maxWindGust24h);
  const isHighWind = warning.level !== 'none';

  return (
    <div className={`glass-card ${isHighWind ? 'border-mountain-danger' : ''}`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`p-2 sm:p-3 rounded-xl ${isHighWind ? 'bg-mountain-danger/20' : 'bg-orange-400/20'}`}>
          <ExclamationTriangleIcon 
            className={`w-6 h-6 sm:w-8 sm:h-8 ${isHighWind ? 'text-mountain-danger' : 'text-orange-400'}`} 
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="metric-label mb-2">Wind Conditions</div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-3 sm:mb-4">
            <div>
              <div className={`metric-large ${isHighWind ? 'text-mountain-danger' : 'text-orange-400'}`}>
                {formatWind(currentWindGust)}
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">Current Gusts</div>
            </div>
            
            <div>
              <div className={`metric-large ${maxWindGust24h >= 40 ? 'text-mountain-danger' : 'text-orange-300'}`}>
                {formatWind(maxWindGust24h)}
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">Max 24h Gusts</div>
            </div>
          </div>

          {isHighWind && (
            <div className="mt-3 p-2 sm:p-3 bg-mountain-danger/10 border border-mountain-danger/30 rounded-lg">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-mountain-danger flex-shrink-0" />
                <div className="text-xs sm:text-sm text-mountain-danger font-semibold">
                  {warning.message}
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 text-xs sm:text-sm text-gray-400">
            Current Speed: {formatWind(currentWindSpeed)} • 7-Day Max: {formatWind(maxWindGust7day)}
          </div>
        </div>
      </div>
    </div>
  );
}
