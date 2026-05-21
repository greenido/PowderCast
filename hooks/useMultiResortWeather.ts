'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProcessedWeatherData, WeatherData } from '@/lib/nwsTypes';
import type { Resort } from '@/lib/database';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { processWeatherData } from './useNWSWeather';

const USER_AGENT = 'PowderCast/1.1 (contact@powdercast.app)';
const NWS_API_BASE = 'https://api.weather.gov';

export function useMultiResortWeather(resorts: Resort[]) {
  const [data, setData] = useState<Record<string, ProcessedWeatherData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const activeFetchId = useRef(0);

  const fetchAllWeather = useCallback(async (forceRefresh = false) => {
    if (resorts.length === 0) {
      setData({});
      setErrors({});
      return;
    }

    const fetchId = ++activeFetchId.current;
    setLoading(true);
    
    // Step 1: Pre-populate from cache immediately to prevent layout shifts
    const initialData: Record<string, ProcessedWeatherData> = {};
    const resortsToFetch: Resort[] = [];

    resorts.forEach((resort) => {
      const cacheKey = `weather_${resort.base_lat}_${resort.base_lon}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached && !forceRefresh) {
        try {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          // If cache is fresh (< 1 hour), use it and don't re-fetch
          if (Date.now() - timestamp < 3600000) {
            initialData[resort.id] = cachedData;
          } else {
            resortsToFetch.push(resort);
          }
        } catch (e) {
          resortsToFetch.push(resort);
        }
      } else {
        resortsToFetch.push(resort);
      }
    });

    if (Object.keys(initialData).length > 0) {
      setData((prev) => ({ ...prev, ...initialData }));
    }

    if (resortsToFetch.length === 0) {
      setLoading(false);
      return;
    }

    const nextData = { ...initialData };
    const nextErrors: Record<string, string> = {};

    // Helper to fetch weather for a single resort
    const fetchSingleResort = async (resort: Resort, index: number) => {
      // Respect NWS guidelines by slightly staggering requests (150ms per resort)
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, index * 150));
      }

      const { base_lat: lat, base_lon: lon, id } = resort;

      try {
        // Step A: Fetch points
        const pointUrl = `${NWS_API_BASE}/points/${lat},${lon}`;
        const pointRes = await fetchWithRetry(pointUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/geo+json',
          },
        });

        if (!pointRes.ok) {
          throw new Error(`Points API returned status ${pointRes.status}`);
        }

        const pointData = await pointRes.json();
        const forecastUrl = pointData.properties.forecast;
        const gridDataUrl = pointData.properties.forecastGridData;
        const location = {
          city: pointData.properties.relativeLocation?.properties?.city || 'Unknown',
          state: pointData.properties.relativeLocation?.properties?.state || 'Unknown',
        };

        // Step B: Fetch forecast and grid in parallel
        const [forecastRes, gridRes] = await Promise.all([
          fetchWithRetry(forecastUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'application/geo+json',
            },
          }),
          fetchWithRetry(gridDataUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'application/geo+json',
            },
          }),
        ]);

        if (!forecastRes.ok || !gridRes.ok) {
          throw new Error('Failed to fetch forecast or grid data');
        }

        const [forecast, gridData] = await Promise.all([
          forecastRes.json(),
          gridRes.json(),
        ]);

        const weatherRaw: WeatherData = { forecast, gridData, location };
        const processed = processWeatherData(weatherRaw);
        const processedWithUrl = {
          ...processed,
          gridDataUrl,
        };

        // Write to localStorage cache
        const cacheKey = `weather_${lat}_${lon}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          data: processedWithUrl,
          timestamp: Date.now(),
        }));

        return { id, processed: processedWithUrl };
      } catch (err) {
        // Try fallback to older localStorage cache even if expired (> 1 hour)
        const cacheKey = `weather_${lat}_${lon}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { data: cachedData } = JSON.parse(cached);
            return { id, processed: cachedData, isFallback: true };
          } catch (e) {}
        }
        
        throw new Error(err instanceof Error ? err.message : 'Unknown NWS error');
      }
    };

    // Execute in parallel (with staggered delay built into each request)
    const results = await Promise.allSettled(
      resortsToFetch.map((resort, idx) => fetchSingleResort(resort, idx))
    );

    // Only update state if this is still the active/latest request
    if (fetchId !== activeFetchId.current) return;

    results.forEach((res, idx) => {
      const resort = resortsToFetch[idx];
      if (res.status === 'fulfilled') {
        nextData[resort.id] = res.value.processed;
      } else {
        nextErrors[resort.id] = res.reason instanceof Error ? res.reason.message : 'Failed to load weather';
      }
    });

    setData(nextData);
    setErrors(nextErrors);
    setLoading(false);
  }, [resorts]);

  useEffect(() => {
    fetchAllWeather(false);
  }, [fetchAllWeather]);

  return {
    data,
    errors,
    loading,
    refresh: () => fetchAllWeather(true),
  };
}
