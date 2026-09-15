'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DEFAULT_URL_STATE,
  applyUrlState,
  parseUrlState,
  serializeUrlState,
  type AppUrlState,
} from '@/lib/urlState';

/**
 * App view state, mirrored to the query string.
 *
 * `push` adds a history entry, so back returns to the previous view — use it
 * for navigation (a new resort, a new tab). `replace` rewrites the current
 * entry — use it for refinements like base/summit that should not cost the
 * rider an extra back press.
 *
 * The static export renders with defaults, so the URL is read after mount.
 * Nothing is written until then, or the defaults would overwrite a deep link.
 */
export function useUrlState() {
  const [state, setState] = useState<AppUrlState>(DEFAULT_URL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    const initial = parseUrlState(window.location.search);
    stateRef.current = initial;
    setState(initial);
    setHydrated(true);

    const onPopState = () => {
      const next = applyUrlState(stateRef.current, window.location.search);
      stateRef.current = next;
      setState(next);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const update = useCallback(
    (patch: Partial<AppUrlState>, mode: 'push' | 'replace' = 'push') => {
      const next = { ...stateRef.current, ...patch };
      stateRef.current = next;
      setState(next);

      const search = serializeUrlState(next);
      if (search === window.location.search) return;

      const url = `${window.location.pathname}${search}${window.location.hash}`;
      // Pass the existing history.state through: the App Router keeps its own
      // bookkeeping there and back/forward breaks without it.
      if (mode === 'push') window.history.pushState(window.history.state, '', url);
      else window.history.replaceState(window.history.state, '', url);
    },
    []
  );

  return { ...state, hydrated, update };
}
