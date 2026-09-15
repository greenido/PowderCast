'use client';

import type { Resort } from '@/lib/types';
import { PassBadgeList } from '@/components/PassBadge';
import ShareButton from '@/components/ShareButton';
import { StarIcon } from '@heroicons/react/24/solid';

interface ResortHeaderProps {
  resort: Resort;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

// Which elevation is showing lives in ElevationToggle, directly below; this
// used to repeat it in a second block that cost a third of a phone screen.
export default function ResortHeader({
  resort,
  isFavorite,
  onToggleFavorite,
}: ResortHeaderProps) {
  return (
    <div className="glass-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-cyan-400 sm:text-3xl">{resort.name}</h2>
          <p className="mt-1 text-sm text-gray-400 sm:text-base">
            {Array.from(new Set([resort.region, resort.state].filter(Boolean))).join(', ')} · {resort.country}
          </p>
          <PassBadgeList passes={resort.passes} className="mt-2" />
        </div>

        <div className="flex shrink-0 items-center">
          <button
            onClick={onToggleFavorite}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
          >
            <StarIcon
              className={`h-5 w-5 sm:h-6 sm:w-6 ${isFavorite ? 'text-yellow-400' : 'text-gray-600'}`}
            />
          </button>
          <ShareButton
            title={`${resort.name} · PowderCast`}
            text={`Mountain forecast for ${resort.name}`}
          />
        </div>
      </div>
    </div>
  );
}
