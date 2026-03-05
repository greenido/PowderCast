'use client';

import type { Resort } from '@/lib/database';
import { StarIcon } from '@heroicons/react/24/solid';

interface ResortHeaderProps {
  resort: Resort;
  elevation: 'base' | 'summit';
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export default function ResortHeader({
  resort,
  elevation,
  isFavorite,
  onToggleFavorite,
}: ResortHeaderProps) {
  return (
    <div className="glass-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-cyan-400">
              {resort.name}
            </h2>
            <button
              onClick={onToggleFavorite}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <StarIcon
                className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  isFavorite ? 'text-yellow-400' : 'text-gray-600'
                }`}
              />
            </button>
          </div>
          <p className="text-sm sm:text-base text-gray-400">
            {resort.region}, {resort.state}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider mb-1">
            Current View
          </div>
          <div className="text-xl sm:text-2xl font-bold text-cyan-400">
            {elevation === 'base' ? 'Base' : 'Summit'}
          </div>
          <div className="text-base sm:text-lg text-gray-400">
            {elevation === 'base'
              ? resort.base_elevation.toLocaleString()
              : resort.summit_elevation.toLocaleString()}ft
          </div>
        </div>
      </div>
    </div>
  );
}
