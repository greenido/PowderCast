'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Resort } from '@/lib/types';
import { fetchForecast } from '@/lib/providers';
import { resortPoint } from '@/lib/resortGeo';
import { buildOutlook, rankOutlooks, type ResortOutlook } from '@/lib/planner';
import { forecastKey, readForecast, writeForecast } from '@/lib/forecastCache';

/** True when a rejection is this hook cancelling its own request. */
function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Build a resort x day outlook grid for the planner view.
 *
 * Shares the same concurrency-pool discipline as useMultiForecast — a region
 * can hold a dozen resorts and each is one or two upstream calls — and now the
 * same cache. It previously had none, so every trip between Compare and Planner
 * refetched the entire region.
 *
 * The planner's forecasts are cached under their own 'mid' elevation tag rather
 * than shared with the resort page's base/summit entries. A mid-mountain
 * forecast is a different request, and serving it as the summit view would be a
 * quiet lie.
 */
export function usePlanner(resorts: Resort[], days = 7, concurrency = 4) {
  const [outlooks, setOutlooks] = useState<ResortOutlook[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requestId = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  const resortKey = resorts.map((r) => r.id).join(',');

  const load = useCallback(
    async (force = false) => {
      if (resorts.length === 0) {
        setOutlooks([]);
        return;
      }

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      const id = ++requestId.current;
      setLoading(true);
      setErrors({});

      const results: ResortOutlook[] = [];
      const failures: Record<string, string> = {};
      const pending: Resort[] = [];

      // Outlooks are rebuilt from the cached forecast rather than cached
      // themselves: buildOutlook() buckets by local day from `now`, so a stored
      // grid would still be labelled with the day it was built on.
      for (const resort of resorts) {
        const hit = force ? null : readForecast(forecastKey(resort.id, 'mid'));
        if (hit) results.push(buildOutlook(resort, hit.forecast, Date.now(), days));
        else pending.push(resort);
      }

      let cursor = 0;
      async function worker() {
        while (cursor < pending.length) {
          if (controller.signal.aborted) return;

          const resort = pending[cursor++];
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
              signal: controller.signal,
            });
            const now = Date.now();
            results.push(buildOutlook(resort, forecast, now, days));
            writeForecast(forecastKey(resort.id, 'mid'), forecast, now);
          } catch (err) {
            if (isAbort(err)) return;

            const stale = readForecast(forecastKey(resort.id, 'mid'), Infinity);
            if (stale) {
              results.push(buildOutlook(resort, stale.forecast, Date.now(), days));
            } else {
              failures[resort.id] = err instanceof Error ? err.message : 'Failed to load';
            }
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, pending.length) }, worker)
      );

      if (id !== requestId.current || controller.signal.aborted) return;

      setOutlooks(rankOutlooks(results));
      setErrors(failures);
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resortKey, days, concurrency]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => () => inFlight.current?.abort(), []);

  return { outlooks, loading, errors, refresh: () => load(true) };
}
