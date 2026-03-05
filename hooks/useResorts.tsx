'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Resort } from '@/lib/database';

interface ResortsContextValue {
  allResorts: Resort[];
  resortsLoading: boolean;
}

const ResortsContext = createContext<ResortsContextValue | null>(null);

export function ResortsProvider({ children }: { children: ReactNode }) {
  const [allResorts, setAllResorts] = useState<Resort[]>([]);
  const [resortsLoading, setResortsLoading] = useState(true);

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    fetch(`${basePath}/resorts.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load resorts');
        return res.json();
      })
      .then((data: Resort[]) => setAllResorts(data))
      .catch((err) => console.error('Failed to load resorts:', err))
      .finally(() => setResortsLoading(false));
  }, []);

  return (
    <ResortsContext.Provider value={{ allResorts, resortsLoading }}>
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
