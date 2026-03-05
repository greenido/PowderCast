import { useState, useEffect } from 'react';
import type { Resort } from '@/lib/database';
import { useResortsContext } from '@/hooks/useResorts';

export function useResortSearch(query: string) {
  const { allResorts } = useResortsContext();
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResorts([]);
      return;
    }

    const searchResorts = () => {
      setLoading(true);

      try {
        const q = query.toLowerCase();
        const filtered = allResorts.filter(
          (resort) =>
            resort.name.toLowerCase().includes(q) ||
            resort.state.toLowerCase().includes(q) ||
            resort.region.toLowerCase().includes(q)
        );
        setResorts(filtered.slice(0, 10));
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchResorts, 300);
    return () => clearTimeout(timeoutId);
  }, [query, allResorts]);

  return { resorts, loading };
}

export function useResort(resortId: string | null) {
  const { allResorts, resortsLoading } = useResortsContext();
  const [resort, setResort] = useState<Resort | null>(null);

  useEffect(() => {
    if (!resortId || resortsLoading) {
      if (!resortId) setResort(null);
      return;
    }

    const found = allResorts.find((r) => r.id === resortId) ?? null;
    setResort(found);
  }, [resortId, allResorts, resortsLoading]);

  return { resort, loading: resortsLoading };
}
