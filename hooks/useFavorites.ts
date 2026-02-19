import { useState, useEffect, useCallback } from 'react';
import type { Resort } from '@/lib/database';

const FAVORITES_KEY = 'powdercast-favorites';

/**
 * Custom hook to manage favorite resorts using localStorage
 * @returns {object} - favoriteIds, favorites array, and methods to toggle/check favorites
 */
export function useFavorites(allResorts: Resort[] = []) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);

  // Set client flag on mount to prevent SSR issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load favorites from localStorage on mount
  useEffect(() => {
    if (!isClient) return;
    
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavoriteIds(new Set(parsed));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  }, [isClient]);

  // Save favorites to localStorage whenever they change
  const saveFavorites = useCallback((ids: Set<string>) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(ids)));
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }, []);

  // Toggle a resort as favorite
  const toggleFavorite = useCallback((resortId: string) => {
    setFavoriteIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(resortId)) {
        newSet.delete(resortId);
      } else {
        newSet.add(resortId);
      }
      saveFavorites(newSet);
      return newSet;
    });
  }, [saveFavorites]);

  // Check if a resort is a favorite
  const isFavorite = useCallback((resortId: string): boolean => {
    return favoriteIds.has(resortId);
  }, [favoriteIds]);

  // Get the full Resort objects for favorites
  const favorites = allResorts.filter((resort) => favoriteIds.has(resort.id));

  return {
    favoriteIds,
    favorites,
    toggleFavorite,
    isFavorite,
    hasFavorites: favoriteIds.size > 0,
  };
}
