import { useState, useEffect } from 'react';
import type { Resort } from '@/lib/database';

export function useResortSearch(query: string) {
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allResorts, setAllResorts] = useState<Resort[]>([]);

  // Load all resorts once
  useEffect(() => {
    const loadResorts = async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const response = await fetch(`${basePath}/resorts.json`);
        if (!response.ok) throw new Error('Failed to load resorts');
        const data = await response.json();
        setAllResorts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };
    loadResorts();
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResorts([]);
      return;
    }

    const searchResorts = () => {
      setLoading(true);
      setError(null);

      try {
        const q = query.toLowerCase();
        const filtered = allResorts.filter(
          (resort) =>
            resort.name.toLowerCase().includes(q) ||
            resort.state.toLowerCase().includes(q) ||
            resort.region.toLowerCase().includes(q)
        );
        setResorts(filtered.slice(0, 10)); // Limit results
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
  }, [query, allResorts]);

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
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const response = await fetch(`${basePath}/resorts.json`);
        if (!response.ok) throw new Error('Failed to load resorts');
        
        const allResorts: Resort[] = await response.json();
        const foundResort = allResorts.find((r) => r.id === resortId);
        
        if (!foundResort) {
          throw new Error('Resort not found');
        }
        
        setResort(foundResort);
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
