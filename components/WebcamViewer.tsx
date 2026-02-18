'use client';

import { VideoCameraIcon } from '@heroicons/react/24/solid';

interface WebcamViewerProps {
  webcamUrl: string | null;
  resortName: string;
}

export default function WebcamViewer({ webcamUrl, resortName }: WebcamViewerProps) {
  if (!webcamUrl) return null;

  return (
    <div className="glass-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <VideoCameraIcon className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400 flex-shrink-0" />
          <div>
            <div className="font-semibold text-base sm:text-lg">Live Webcams</div>
            <div className="text-xs sm:text-sm text-gray-400">Eyes on the ground at {resortName}</div>
          </div>
        </div>
        <a
          href={webcamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto text-center px-4 sm:px-6 py-2.5 sm:py-3 bg-cyan-400 text-slate-900 font-semibold text-sm sm:text-base rounded-lg hover:bg-cyan-300 transition-colors"
        >
          View Cams →
        </a>
      </div>
    </div>
  );
}
