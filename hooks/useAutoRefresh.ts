'use client';

import { useEffect, useRef } from 'react';

/**
 * A visibility-aware automatic refresh hook.
 * Triggers a callback at regular intervals, but pauses when the tab is hidden
 * and eagerly triggers upon tab focus if the data has grown stale.
 * 
 * @param onRefresh Callback to fetch fresh data
 * @param intervalMs Interval in milliseconds (default 15 minutes = 900,000ms)
 * @param lastFetchTime Timestamp of the last successful fetch (used to check staleness on focus)
 */
export function useAutoRefresh(
  onRefresh: () => void,
  intervalMs = 900000, // 15 minutes
  lastFetchTime: number | null = null
) {
  const onRefreshRef = useRef(onRefresh);
  const lastFetchTimeRef = useRef(lastFetchTime);

  // Keep references updated to prevent resetting timers when callbacks change
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    lastFetchTimeRef.current = lastFetchTime;
  }, [lastFetchTime]);

  useEffect(() => {
    if (intervalMs <= 0) return;

    let timerId: NodeJS.Timeout | null = null;

    const startTimer = () => {
      stopTimer();
      timerId = setInterval(() => {
        if (!document.hidden) {
          console.log('[Auto-Refresh] Timer fired, refreshing weather...');
          onRefreshRef.current();
        }
      }, intervalMs);
    };

    const stopTimer = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    // Initialize timer
    startTimer();

    // Check freshness and handle visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Auto-Refresh] Tab backgrounded. Paused polling.');
        stopTimer();
      } else {
        console.log('[Auto-Refresh] Tab active. Resuming polling.');
        startTimer();

        // Eagerly refresh on focus if data is stale
        const lastFetch = lastFetchTimeRef.current;
        if (lastFetch) {
          const ageMs = Date.now() - lastFetch;
          if (ageMs >= intervalMs) {
            console.log(`[Auto-Refresh] Eagerly refreshing because data is stale (age: ${Math.round(ageMs / 1000)}s)`);
            onRefreshRef.current();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);
}
