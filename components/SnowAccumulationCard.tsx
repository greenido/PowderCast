'use client';

import { CloudIcon } from '@heroicons/react/24/solid';
import { formatSnow } from '@/lib/unitConversion';

interface SnowAccumulationCardProps {
  snow24h: number;
  snow7day: number;
}

export default function SnowAccumulationCard({ snow24h, snow7day }: SnowAccumulationCardProps) {
  return (
    <div className="glass-card">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="p-2 sm:p-3 bg-cyan-400/20 rounded-xl">
          <CloudIcon className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="metric-label mb-2">Snow Accumulation</div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div>
              <div className="metric-large text-cyan-400">
                {formatSnow(snow24h)}
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">Last 24 Hours</div>
            </div>
            
            <div>
              <div className="metric-large text-cyan-300">
                {formatSnow(snow7day)}
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">7-Day Total</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
