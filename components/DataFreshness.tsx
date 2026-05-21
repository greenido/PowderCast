'use client';

import { useState, useEffect } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface DataFreshnessProps {
  lastFetchTime: number | null;
  onRefresh: () => void;
  loading: boolean;
}

export default function DataFreshness({ lastFetchTime, onRefresh, loading }: DataFreshnessProps) {
  const [elapsedText, setElapsedText] = useState<string>('Just now');
  const [status, setStatus] = useState<'fresh' | 'aging' | 'stale'>('fresh');

  useEffect(() => {
    if (!lastFetchTime) {
      setElapsedText('Never updated');
      setStatus('stale');
      return;
    }

    const updateFreshness = () => {
      const diffMs = Date.now() - lastFetchTime;
      const diffSec = Math.max(0, Math.floor(diffMs / 1000));
      const diffMin = Math.floor(diffSec / 60);
      const diffHrs = Math.floor(diffMin / 60);

      // Determine status
      if (diffMin < 15) {
        setStatus('fresh');
      } else if (diffMin < 60) {
        setStatus('aging');
      } else {
        setStatus('stale');
      }

      // Format human-readable text
      if (diffSec < 10) {
        setElapsedText('Just now');
      } else if (diffSec < 60) {
        setElapsedText(`${diffSec}s ago`);
      } else if (diffMin < 60) {
        setElapsedText(`${diffMin}m ago`);
      } else if (diffHrs < 24) {
        const remainingMin = diffMin % 60;
        setElapsedText(remainingMin > 0 ? `${diffHrs}h ${remainingMin}m ago` : `${diffHrs}h ago`);
      } else {
        const days = Math.floor(diffHrs / 24);
        setElapsedText(`${days}d ago`);
      }
    };

    updateFreshness();

    // Tick every 10 seconds for dynamic live updates
    const intervalId = setInterval(updateFreshness, 10000);

    return () => clearInterval(intervalId);
  }, [lastFetchTime]);

  const getStatusBadge = () => {
    switch (status) {
      case 'fresh':
        return {
          bg: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-400',
          dot: 'bg-emerald-400 animate-pulse',
          label: 'Fresh'
        };
      case 'aging':
        return {
          bg: 'bg-amber-500/10 border-amber-400/20 text-amber-400',
          dot: 'bg-amber-400',
          label: 'Aging'
        };
      case 'stale':
        return {
          bg: 'bg-rose-500/10 border-rose-400/20 text-rose-400',
          dot: 'bg-rose-400 animate-ping',
          label: 'Stale'
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-full text-sm font-medium backdrop-blur-md shadow-lg shadow-black/10">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${badge.dot}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${badge.dot.split(' ')[0]}`}></span>
        </span>
        <span className={`text-xs uppercase tracking-wider font-semibold ${badge.bg.split(' ')[2]}`}>
          {badge.label}
        </span>
      </div>
      
      <div className="h-4 w-px bg-white/15"></div>
      
      <span className="text-gray-300 font-normal">
        Updated <span className="font-semibold text-white">{elapsedText}</span>
      </span>

      <button
        onClick={onRefresh}
        disabled={loading}
        title="Refresh weather data"
        className="ml-1 p-1 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
      </button>
    </div>
  );
}
