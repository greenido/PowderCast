'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PassId } from '@/lib/types';

const STORAGE_KEY = 'pc_my_passes';
const VALID: PassId[] = ['ikon', 'epic', 'mountain-collective', 'indy'];

/**
 * "My passes" — which passes the rider actually holds.
 *
 * Persisted, because it is a property of the person rather than the session:
 * someone with an Ikon pass wants Ikon resorts surfaced every time they open
 * the app, not to re-pick a filter on each visit.
 */
export function usePassFilter() {
  const [selected, setSelected] = useState<PassId[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelected(parsed.filter((p): p is PassId => VALID.includes(p)));
        }
      }
    } catch {
      // Ignore unparseable preference.
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: PassId[]) => {
    setSelected(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort.
    }
  }, []);

  const toggle = useCallback(
    (pass: PassId) => {
      persist(
        selected.includes(pass) ? selected.filter((p) => p !== pass) : [...selected, pass]
      );
    },
    [selected, persist]
  );

  const clear = useCallback(() => persist([]), [persist]);

  return {
    selected,
    toggle,
    clear,
    hydrated,
    isActive: selected.length > 0,
  };
}
