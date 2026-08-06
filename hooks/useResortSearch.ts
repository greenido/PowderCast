import { useState, useEffect, useMemo } from 'react';
import type { Resort, PassId } from '@/lib/types';
import { useResortsContext } from '@/hooks/useResorts';
import { filterByPasses } from '@/lib/passes';

const MAX_RESULTS = 12;

/** Fold accents so "Kitzbuhel" finds "Kitzbühel" and "Meribel" finds "Méribel". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Score a resort against a query. Higher is better; 0 means no match.
 *
 * With 700+ resorts a plain substring filter buries the obvious answer —
 * typing "alta" should surface Alta, Utah before Alta Badia and Altaussee.
 * Ranking is: exact name > name prefix > word-start > substring, then
 * region/country matches, with resort size as the tiebreaker.
 */
function score(resort: Resort, query: string): number {
  const name = normalize(resort.name);
  const region = normalize(resort.region || '');
  const state = normalize(resort.state || '');

  let base = 0;

  if (name === query) base = 1000;
  else if (name.startsWith(query)) base = 800;
  else if (name.split(/[\s\-/]+/).some((word) => word.startsWith(query))) base = 600;
  else if (name.includes(query)) base = 400;
  else if (region.startsWith(query) || state.startsWith(query)) base = 200;
  else if (region.includes(query) || state.includes(query)) base = 100;
  else if (normalize(resort.country).startsWith(query)) base = 50;

  if (base === 0) return 0;

  // Bigger resorts win ties — a search for "val" should lead with Val Thorens,
  // not a two-lift hill of the same name. Capped so size never beats relevance.
  const sizeBonus = Math.min(50, (resort.runsKm ?? 0) / 4);
  return base + sizeBonus;
}

export function useResortSearch(query: string, passes: PassId[] = []) {
  const { allResorts } = useResortsContext();
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(id);
  }, [query]);

  const pool = useMemo(
    () => filterByPasses(allResorts, passes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allResorts, passes.join(',')]
  );

  const resorts = useMemo(() => {
    const q = normalize(debounced.trim());

    // With no query, show the biggest resorts in the current filter — a useful
    // default rather than an empty dropdown.
    if (q.length < 2) {
      return [...pool].sort((a, b) => (b.runsKm ?? 0) - (a.runsKm ?? 0)).slice(0, MAX_RESULTS);
    }

    return pool
      .map((resort) => ({ resort, score: score(resort, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.resort.name.localeCompare(b.resort.name))
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.resort);
  }, [debounced, pool]);

  return { resorts, loading: query !== debounced && query.length >= 2 };
}

export function useResort(resortId: string | null) {
  const { allResorts, resortsLoading } = useResortsContext();

  const resort = useMemo(
    () => (resortId ? (allResorts.find((r) => r.id === resortId) ?? null) : null),
    [resortId, allResorts]
  );

  return { resort, loading: resortsLoading };
}
