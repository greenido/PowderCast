'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LatLon } from '@/lib/nearby';

export type GeoStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';

interface GeolocationValue {
  position: LatLon | null;
  status: GeoStatus;
  /** Ask the browser for a fix. Must be called from a user gesture the first time. */
  locate: () => void;
}

const GeolocationContext = createContext<GeolocationValue | null>(null);

/**
 * The rider's position, shared by search, the planner and comparison.
 *
 * Asked for only on an explicit "Near me" tap — never on page load — unless
 * the browser reports that permission was already granted, in which case a
 * returning rider gets their nearby list without tapping again. The position
 * is held in memory only: it is never persisted, and never put in the URL.
 */
export function GeolocationProvider({ children }: { children: ReactNode }) {
  const [position, setPosition] = useState<LatLon | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus('ready');
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      // City-level accuracy is plenty to rank ski resorts, and a coarse fix
      // comes back in a fraction of the time a GPS lock takes.
      { enableHighAccuracy: false, maximumAge: 30 * 60_000, timeout: 15_000 }
    );
  }, []);

  useEffect(() => {
    // Safari only gained the Permissions API for geolocation recently; where
    // it is missing, the rider just taps "Near me" as on a first visit.
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((result) => {
        if (result.state === 'granted') locate();
      })
      .catch(() => {});
  }, [locate]);

  return (
    <GeolocationContext.Provider value={{ position, status, locate }}>
      {children}
    </GeolocationContext.Provider>
  );
}

export function useGeolocation(): GeolocationValue {
  const ctx = useContext(GeolocationContext);
  if (!ctx) throw new Error('useGeolocation must be used within a GeolocationProvider');
  return ctx;
}
