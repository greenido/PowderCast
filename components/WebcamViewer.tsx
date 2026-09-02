'use client';

import { VideoCameraIcon, GlobeAltIcon } from '@heroicons/react/24/solid';
import type { Resort } from '@/lib/types';

interface WebcamViewerProps {
  resort: Resort;
}

/**
 * Eyes on the ground.
 *
 * Webcam pages come from a hand-checked overlay (data/webcams.json) and only
 * exist for a couple of dozen resorts, because OpenSkiMap carries no webcam
 * links and a guessed URL is worse than none. Everywhere else the resort's own
 * site is offered instead — it is one click from the cams, and it is a link we
 * actually got from the data rather than invented.
 *
 * If we have neither, the card hides rather than rendering a dead end.
 */
export default function WebcamViewer({ resort }: WebcamViewerProps) {
  const { webcam_url: webcam, website_url: website, name } = resort;
  if (!webcam && !website) return null;

  const hasCams = Boolean(webcam);

  return (
    <div className="glass-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {hasCams ? (
            <VideoCameraIcon className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400 flex-shrink-0" />
          ) : (
            <GlobeAltIcon className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400 flex-shrink-0" />
          )}
          <div>
            <div className="font-semibold text-base sm:text-lg">
              {hasCams ? 'Live Webcams' : 'Resort Website'}
            </div>
            <div className="text-xs sm:text-sm text-gray-400">
              {hasCams
                ? `Eyes on the ground at ${name}`
                : `Cams, lift status and snow report at ${name}`}
            </div>
          </div>
        </div>

        <div className="flex w-full sm:w-auto gap-2">
          {hasCams && (
            <a
              href={webcam as string}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none text-center px-4 sm:px-6 py-2.5 sm:py-3 bg-cyan-400 text-slate-900 font-semibold text-sm sm:text-base rounded-lg hover:bg-cyan-300 transition-colors"
            >
              View Cams →
            </a>
          )}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 sm:flex-none text-center px-4 sm:px-6 py-2.5 sm:py-3 font-semibold text-sm sm:text-base rounded-lg transition-colors ${
                hasCams
                  ? 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                  : 'bg-cyan-400 text-slate-900 hover:bg-cyan-300'
              }`}
            >
              {hasCams ? 'Site' : 'Visit Site →'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
