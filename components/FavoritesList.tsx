'use client';

import { StarIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/solid';
import type { Resort } from '@/lib/database';

interface FavoritesListProps {
  favorites: Resort[];
  onSelectResort: (resort: Resort) => void;
  onRemoveFavorite: (resortId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Component to display a list of favorite resorts with quick access
 */
export default function FavoritesList({
  favorites,
  onSelectResort,
  onRemoveFavorite,
  isOpen,
  onClose,
}: FavoritesListProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
          <div className="flex items-center gap-2 sm:gap-3">
            <StarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Favorite Resorts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close favorites"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <StarIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-base sm:text-lg text-gray-400">
                No favorite resorts yet
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                Click the star icon next to any resort to add it to your favorites
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map((resort) => (
                <div
                  key={resort.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-3 sm:p-4 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => {
                        onSelectResort(resort);
                        onClose();
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="font-semibold text-base sm:text-lg text-cyan-400 mb-1 group-hover:text-cyan-300 transition-colors">
                        {resort.name}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-400">
                        {resort.region}, {resort.state}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Base: {resort.base_elevation.toLocaleString()}ft • Summit: {resort.summit_elevation.toLocaleString()}ft
                      </div>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite(resort.id);
                      }}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-all flex-shrink-0 group/remove"
                      aria-label="Remove from favorites"
                      title="Remove from favorites"
                    >
                      <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 group-hover/remove:text-red-400 transition-colors" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {favorites.length > 0 && (
          <div className="p-4 border-t border-white/10 text-center text-xs sm:text-sm text-gray-500">
            {favorites.length} {favorites.length === 1 ? 'resort' : 'resorts'} saved
          </div>
        )}
      </div>
    </div>
  );
}
