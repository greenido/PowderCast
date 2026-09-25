'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Resort } from '@/lib/types';
import type { RiderConditions } from '@/lib/conditions';
import type { NormalizedForecast } from '@/lib/types';
import { deriveConditions } from '@/lib/conditions';
import { fetchForecast } from '@/lib/providers';
import { resortPoint } from '@/lib/resortGeo';
import {
  forecastKey,
  readForecast,
  writeForecast,
  clearLegacyEntries,
} from '@/lib/forecastCache';

export type Elevation = 'base' | 'summit';

/** True when a rejection is this hook cancelling its own request. */
function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Fetch conditions for one resort at one elevation.
 *
 * Paints cached data immediately, then revalidates. On failure, falls back to
 * cache of any age so an offline rider still sees the last known conditions.
 *
 * Conditions are derived from the cached forecast on every read rather than
 * cached alongside it: every window in deriveConditions() is anchored to `now`,
 * so a stored conditions blob showed a "next 24 hours" that started whenever it
 * happened to be written.
 */
export function useForecast(resort: Resort | null, elevation: Elevation = 'base') {
  const [conditions, setConditions] = useState<RiderConditions | null>(null);
  const [forecast, setForecast] = useState<NormalizedForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const requestId = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => clearLegacyEntries(), []);

  const load = useCallback(async () => {
    if (!resort) {
      setConditions(null);
      return;
    }

    // Stop whatever the previous resort was still doing. The request-id guard
    // below keeps stale results off the screen, but only an abort keeps them
    // off the network — for NWS that is three calls nobody is waiting for.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    const id = ++requestId.current;
    const key = forecastKey(resort.id, elevation);
    const point = resortPoint(resort, elevation);

    setLoading(true);
    setError(null);

    try {
      const fresh = await fetchForecast({
        lat: point.lat,
        lon: point.lon,
        elevationM: point.elevationM,
        timezone: resort.timezone,
        signal: controller.signal,
      });

      if (id !== requestId.current) return; // Superseded by a newer request.

      const now = Date.now();
      setConditions(deriveConditions(fresh, now));
      setForecast(fresh);
      setLastFetchTime(now);
      writeForecast(key, fresh, now);
    } catch (err) {
      if (id !== requestId.current || isAbort(err)) return;

      console.error('[useForecast] failed:', err);

      // Any-age cache beats an error screen on a chairlift with one bar.
      const stale = readForecast(key, Infinity);
      if (stale) {
        setConditions(deriveConditions(stale.forecast));
        setForecast(stale.forecast);
        setLastFetchTime(stale.timestamp);
        setError('Showing saved data — could not reach the forecast service');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load forecast');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [resort, elevation]);

  useEffect(() => {
    if (!resort) {
      setConditions(null);
      setForecast(null);
      setLastFetchTime(null);
      return;
    }

    const cached = readForecast(forecastKey(resort.id, elevation));
    if (cached) {
      setConditions(deriveConditions(cached.forecast));
      setForecast(cached.forecast);
      setLastFetchTime(cached.timestamp);
    } else {
      setConditions(null);
      setForecast(null);
    }

    load();
  }, [resort, elevation, load]);

  // Leaving the page should not leave requests running.
  useEffect(() => () => inFlight.current?.abort(), []);

  return { conditions, forecast, loading, error, refresh: load, lastFetchTime };
}

export interface MultiForecastState {
  data: Record<string, RiderConditions>;
  errors: Record<string, string>;
  loading: boolean;
  refresh: () => void;
}

/**
 * Fetch conditions for many resorts, for the comparison view.
 *
 * Requests run through a small concurrency pool rather than all at once.
 * A region can hold 30+ resorts, and each one is two upstream calls for NWS;
 * firing them in parallel is both rude and a good way to get rate limited.
 */
export function useMultiForecast(
  resorts: Resort[],
  elevation: Elevation = 'base',
  concurrency = 4
): MultiForecastState {
  const [data, setData] = useState<Record<string, RiderConditions>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  // Depend on identity, not array reference, so a re-render with an equivalent
  // list doesn't retrigger a full refetch.
  const resortKey = resorts.map((r) => r.id).join(',');

  const load = useCallback(
    async (force = false) => {
      if (resorts.length === 0) {
        setData({});
        setErrors({});
        return;
      }

      // Changing region mid-load abandons a dozen resorts' worth of requests.
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      const id = ++requestId.current;
      setLoading(true);

      const cached: Record<string, RiderConditions> = {};
      const pending: Resort[] = [];

      for (const resort of resorts) {
        const hit = force ? null : readForecast(forecastKey(resort.id, elevation));
        if (hit) cached[resort.id] = deriveConditions(hit.forecast);
        else pending.push(resort);
      }

      if (Object.keys(cached).length) {
        setData((prev) => ({ ...prev, ...cached }));
      }

      if (pending.length === 0) {
        setErrors({});
        setLoading(false);
        return;
      }

      const results: Record<string, RiderConditions> = { ...cached };
      const failures: Record<string, string> = {};

      let cursor = 0;
      async function worker() {
        while (cursor < pending.length) {
          if (controller.signal.aborted) return;

          const resort = pending[cursor++];
          const point = resortPoint(resort, elevation);

          try {
            const forecast = await fetchForecast({
              lat: point.lat,
              lon: point.lon,
              elevationM: point.elevationM,
              timezone: resort.timezone,
              signal: controller.signal,
            });
            const now = Date.now();
            results[resort.id] = deriveConditions(forecast, now);
            writeForecast(forecastKey(resort.id, elevation), forecast, now);
          } catch (err) {
            if (isAbort(err)) return;

            const stale = readForecast(forecastKey(resort.id, elevation), Infinity);
            if (stale) {
              results[resort.id] = deriveConditions(stale.forecast);
            } else {
              failures[resort.id] =
                err instanceof Error ? err.message : 'Failed to load';
            }
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, pending.length) }, worker)
      );

      if (id !== requestId.current || controller.signal.aborted) return;

      setData(results);
      setErrors(failures);
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resortKey, elevation, concurrency]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => () => inFlight.current?.abort(), []);

  return { data, errors, loading, refresh: () => load(true) };
}
