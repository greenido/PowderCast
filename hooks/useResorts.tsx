'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Resort } from '@/lib/types';
import { sanitizeResorts } from '@/lib/resortSchema';

interface ResortsContextValue {
  allResorts: Resort[];
  resortsLoading: boolean;
  resortsError: string | null;
}

const ResortsContext = createContext<ResortsContextValue | null>(null);

export function ResortsProvider({ children }: { children: ReactNode }) {
  const [allResorts, setAllResorts] = useState<Resort[]>([]);
  const [resortsLoading, setResortsLoading] = useState(true);
  const [resortsError, setResortsError] = useState<string | null>(null);

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const version = process.env.NEXT_PUBLIC_RESORTS_HASH || 'dev';

    // The query is a hash of the file's contents (see next.config.js), so a
    // browser holding an older copy holds it under a different URL. That makes
    // ordinary HTTP caching safe, and saves a revalidation round trip in front
    // of every forecast.
    fetch(`${basePath}/resorts.json?v=${version}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load resorts (${res.status})`);
        return res.json();
      })
      .then((data: unknown) => {
        const { resorts, dropped } = sanitizeResorts(data);

        if (dropped > 0) {
          console.warn(
            `[resorts] Dropped ${dropped} malformed record(s). ` +
              'This usually means a cached resorts.json from an older schema.'
          );
        }

        if (resorts.length === 0) {
          throw new Error('Resort list was empty or unreadable');
        }

        setAllResorts(resorts);
      })
      .catch((err) => {
        console.error('[resorts] Failed to load:', err);
        setResortsError(err instanceof Error ? err.message : 'Failed to load resorts');
      })
      .finally(() => setResortsLoading(false));
  }, []);

  return (
    <ResortsContext.Provider value={{ allResorts, resortsLoading, resortsError }}>
      {children}
    </ResortsContext.Provider>
  );
}

export function useResortsContext(): ResortsContextValue {
  const ctx = useContext(ResortsContext);
  if (!ctx) {
    throw new Error('useResortsContext must be used within a ResortsProvider');
  }
  return ctx;
}
