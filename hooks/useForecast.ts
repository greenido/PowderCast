'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Resort } from '@/lib/types';
import type { RiderConditions } from '@/lib/conditions';
import { deriveConditions } from '@/lib/conditions';
import { fetchForecast } from '@/lib/providers';
import { resortPoint } from '@/lib/resortGeo';

export type Elevation = 'base' | 'summit';

const CACHE_TTL_MS = 3_600_000; // 1 hour
const CACHE_PREFIX = 'pc_forecast_v2';

/**
 * Cache key includes elevation and provider version. The v2 prefix also
 * invalidates every entry written before the unit fixes, so nobody is served
 * a stale 10x snow total from localStorage.
 */
function cacheKey(resortId: string, elevation: Elevation): string {
  return `${CACHE_PREFIX}_${resortId}_${elevation}`;
}

function readCache(key: string, maxAgeMs = CACHE_TTL_MS) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > maxAgeMs) return null;
    return { data: data as RiderConditions, timestamp: timestamp as number };
  } catch {
    return null;
  }
}

function writeCache(key: string, data: RiderConditions, timestamp: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp }));
  } catch {
    // Quota exceeded or private mode — caching is best-effort.
  }
}

/**
 * Fetch conditions for one resort at one elevation.
 *
 * Paints cached data immediately, then revalidates. On failure, falls back to
 * cache of any age so an offline rider still sees the last known conditions.
 */
export function useForecast(resort: Resort | null, elevation: Elevation = 'base') {
  const [conditions, setConditions] = useState<RiderConditions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!resort) {
      setConditions(null);
      return;
    }

    const id = ++requestId.current;
    const key = cacheKey(resort.id, elevation);
    const point = resortPoint(resort, elevation);

    setLoading(true);
    setError(null);

    try {
      const forecast = await fetchForecast({
        lat: point.lat,
        lon: point.lon,
        elevationM: point.elevationM,
        timezone: resort.timezone,
      });

      if (id !== requestId.current) return; // Superseded by a newer request.

      const derived = deriveConditions(forecast);
      const now = Date.now();

      setConditions(derived);
      setLastFetchTime(now);
      writeCache(key, derived, now);
    } catch (err) {
      if (id !== requestId.current) return;

      console.error('[useForecast] failed:', err);

      // Any-age cache beats an error screen on a chairlift with one bar.
      const stale = readCache(key, Infinity);
      if (stale) {
        setConditions(stale.data);
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
      setLastFetchTime(null);
      return;
    }

    const cached = readCache(cacheKey(resort.id, elevation));
    if (cached) {
      setConditions(cached.data);
      setLastFetchTime(cached.timestamp);
    } else {
      setConditions(null);
    }

    load();
  }, [resort, elevation, load]);

  return { conditions, loading, error, refresh: load, lastFetchTime };
}

export interface MultiForecastState {
  data: Record<string, RiderConditions>;
  errors: Record<string, string>;
  loading: boolean;
  refresh: () => void;
}

/**
 * Fetch conditions for many resorts, for the comparison and planner views.
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

      const id = ++requestId.current;
      setLoading(true);

      const cached: Record<string, RiderConditions> = {};
      const pending: Resort[] = [];

      for (const resort of resorts) {
        const hit = force ? null : readCache(cacheKey(resort.id, elevation));
        if (hit) cached[resort.id] = hit.data;
        else pending.push(resort);
      }

      if (Object.keys(cached).length) {
        setData((prev) => ({ ...prev, ...cached }));
      }

      if (pending.length === 0) {
        setLoading(false);
        return;
      }

      const results: Record<string, RiderConditions> = { ...cached };
      const failures: Record<string, string> = {};

      let cursor = 0;
      async function worker() {
        while (cursor < pending.length) {
          const resort = pending[cursor++];
          const point = resortPoint(resort, elevation);

          try {
            const forecast = await fetchForecast({
              lat: point.lat,
              lon: point.lon,
              elevationM: point.elevationM,
              timezone: resort.timezone,
            });
            const derived = deriveConditions(forecast);
            results[resort.id] = derived;
            writeCache(cacheKey(resort.id, elevation), derived, Date.now());
          } catch (err) {
            const stale = readCache(cacheKey(resort.id, elevation), Infinity);
            if (stale) {
              results[resort.id] = stale.data;
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

      if (id !== requestId.current) return;

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

  return { data, errors, loading, refresh: () => load(true) };
}
