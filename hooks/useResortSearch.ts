import { useState, useEffect } from 'react';
import type { Resort } from '@/lib/database';

export function useResortSearch(query: string) {
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResorts([]);
      return;
    }

    const searchResorts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/resorts?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Failed to search resorts');
        
        const data = await response.json();
        setResorts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setResorts([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchResorts, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  return { resorts, loading, error };
}

export function useResort(resortId: string | null) {
  const [resort, setResort] = useState<Resort | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resortId) {
      setResort(null);
      return;
    }

    const fetchResort = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/resorts?id=${resortId}`);
        if (!response.ok) throw new Error('Failed to fetch resort');
        
        const data = await response.json();
        setResort(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setResort(null);
      } finally {
        setLoading(false);
      }
    };

    fetchResort();
  }, [resortId]);

  return { resort, loading, error };
}
