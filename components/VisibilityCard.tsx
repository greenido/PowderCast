'use client';

import { EyeIcon } from '@heroicons/react/24/solid';
import { formatVisibility } from '@/lib/unitConversion';

interface VisibilityCardProps {
  visibility: number;
  skyCover: number;
  shortForecast: string;
}

export default function VisibilityCard({ visibility, skyCover, shortForecast }: VisibilityCardProps) {
  const visibilityLevel = visibility > 9656 ? 'excellent' : visibility > 4828 ? 'good' : 'limited';
  const visibilityColor = 
    visibilityLevel === 'excellent' ? 'text-mountain-success' :
    visibilityLevel === 'good' ? 'text-mountain-warning' :
    'text-mountain-danger';

  return (
    <div className="glass-card">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`p-2 sm:p-3 rounded-xl ${
          visibilityLevel === 'excellent' ? 'bg-mountain-success/20' :
          visibilityLevel === 'good' ? 'bg-mountain-warning/20' :
          'bg-mountain-danger/20'
        }`}>
          <EyeIcon className={`w-6 h-6 sm:w-8 sm:h-8 ${visibilityColor}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="metric-label mb-2">Visibility</div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div>
              <div className={`metric-large ${visibilityColor}`}>
                {formatVisibility(visibility)}
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1 capitalize">{visibilityLevel}</div>
            </div>
            
            <div>
              <div className={`metric-large ${skyCover > 75 ? 'text-gray-400' : 'text-blue-400'}`}>
                {Math.round(skyCover)}%
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">Cloud Cover</div>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-300 italic">
            {shortForecast}
          </div>
        </div>
      </div>
    </div>
  );
}
