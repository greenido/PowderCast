'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Resort } from '@/lib/types';
import { fetchForecast } from '@/lib/providers';
import { resortPoint } from '@/lib/resortGeo';
import { buildOutlook, rankOutlooks, type ResortOutlook } from '@/lib/planner';

/**
 * Build a resort x day outlook grid for the planner view.
 *
 * Shares the same concurrency-pool discipline as useMultiForecast — a region
 * can hold a dozen resorts and each is one or two upstream calls.
 */
export function usePlanner(resorts: Resort[], days = 7, concurrency = 4) {
  const [outlooks, setOutlooks] = useState<ResortOutlook[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requestId = useRef(0);

  const resortKey = resorts.map((r) => r.id).join(',');

  const load = useCallback(
    async () => {
      if (resorts.length === 0) {
        setOutlooks([]);
        return;
      }

      const id = ++requestId.current;
      setLoading(true);
      setErrors({});

      const results: ResortOutlook[] = [];
      const failures: Record<string, string> = {};

      let cursor = 0;
      async function worker() {
        while (cursor < resorts.length) {
          const resort = resorts[cursor++];
          // The planner always reasons about mid-mountain, which is what a
          // day's riding actually averages out to.
          const base = resortPoint(resort, 'base');
          const summit = resortPoint(resort, 'summit');
          const midElevationM = (base.elevationM + summit.elevationM) / 2;

          try {
            const forecast = await fetchForecast({
              lat: base.lat,
              lon: base.lon,
              elevationM: midElevationM,
              timezone: resort.timezone,
            });
            results.push(buildOutlook(resort, forecast, Date.now(), days));
          } catch (err) {
            failures[resort.id] = err instanceof Error ? err.message : 'Failed to load';
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, resorts.length) }, worker)
      );

      if (id !== requestId.current) return;

      setOutlooks(rankOutlooks(results));
      setErrors(failures);
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resortKey, days, concurrency]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { outlooks, loading, errors, refresh: load };
}
