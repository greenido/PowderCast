'use client';

import { useState } from 'react';
import SearchBar from '@/components/SearchBar';
import ElevationToggle from '@/components/ElevationToggle';
import ResortHeader from '@/components/ResortHeader';
import WeatherDashboard from '@/components/WeatherDashboard';
import InstallPWA from '@/components/InstallPWA';
import FavoritesList from '@/components/FavoritesList';
import ComparisonDashboard from '@/components/ComparisonDashboard';
import { useNWSWeather } from '@/hooks/useNWSWeather';
import { useFavorites } from '@/hooks/useFavorites';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { ResortsProvider, useResortsContext } from '@/hooks/useResorts';
import type { Resort } from '@/lib/database';
import { StarIcon, BeakerIcon } from '@heroicons/react/24/solid';

function HomeContent() {
  const { allResorts } = useResortsContext();

  const [selectedResort, setSelectedResort] = useState<Resort | null>(null);
  const [elevation, setElevation] = useState<'base' | 'summit'>('base');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showProView, setShowProView] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');
  const [comparisonRegion, setComparisonRegion] = useState<string>('Lake Tahoe');

  const { favorites, toggleFavorite, isFavorite, hasFavorites } = useFavorites(allResorts);

  // Extract unique regions
  const regions = Array.from(new Set(allResorts.map((r) => r.region)))
    .filter(Boolean)
    .sort();

  const lat = selectedResort
    ? elevation === 'base'
      ? selectedResort.base_lat
      : selectedResort.summit_lat
    : null;

  const lon = selectedResort
    ? elevation === 'base'
      ? selectedResort.base_lon
      : selectedResort.summit_lon
    : null;

  const { weatherData, loading, error, refresh, lastFetchTime } = useNWSWeather(lat, lon);

  // Wire up visibility-aware auto-refresh (15 minutes) for active mountain view
  useAutoRefresh(refresh, 900000, lastFetchTime);

  // Determine which resorts to compare
  const compareResorts = comparisonRegion === 'Favorites'
    ? favorites
    : allResorts.filter((r) => r.region === comparisonRegion);

  return (
    <main className="min-h-screen p-4 sm:p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
            🏂 PowderCast
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">
            The Ultimate Snowboarder&apos;s Weather App
          </p>

          {hasFavorites && viewMode === 'single' && (
            <div className="mt-4">
              <button
                onClick={() => setShowFavorites(true)}
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 hover:from-yellow-500/30 hover:to-yellow-600/30 border border-yellow-400/30 rounded-lg transition-all text-sm sm:text-base"
              >
                <StarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                <span className="font-semibold text-yellow-400">My Favorites</span>
                <span className="text-xs text-gray-400">({favorites.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md shadow-inner text-sm">
            <button
              onClick={() => setViewMode('single')}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'single'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🏔️ Single Mountain
            </button>
            
            <button
              onClick={() => {
                setViewMode('compare');
                if (comparisonRegion === 'Favorites' && favorites.length === 0) {
                  setComparisonRegion(regions[0] || 'Lake Tahoe');
                }
              }}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'compare' && comparisonRegion !== 'Favorites'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📊 Compare Regions
            </button>

            <button
              onClick={() => {
                setViewMode('compare');
                setComparisonRegion('Favorites');
              }}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'compare' && comparisonRegion === 'Favorites'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ⭐ Compare Favorites
              {favorites.length > 0 && (
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full border border-yellow-400/20 font-bold shrink-0">
                  {favorites.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* COMPARISON DASHBOARD MODE */}
        {viewMode === 'compare' ? (
          <div className="space-y-6">
            {/* Region quick filter buttons */}
            {comparisonRegion !== 'Favorites' && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {regions.map((region) => (
                  <button
                    key={region}
                    onClick={() => setComparisonRegion(region)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                      comparisonRegion === region
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400/30 font-bold shadow-md shadow-cyan-500/5'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            )}

            {/* Render dashboard or empty favorites warning */}
            {comparisonRegion === 'Favorites' && favorites.length === 0 ? (
              <div className="glass-card text-center py-16 max-w-2xl mx-auto border-dashed">
                <div className="text-5xl mb-4 text-yellow-400 animate-pulse">⭐</div>
                <h3 className="text-xl font-bold text-white mb-2">No Favorites Added</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto px-4">
                  Search for your favorite ski resorts in the <strong>Single Mountain</strong> view and click the gold star icon in the header. They will appear here for fast side-by-side condition comparison!
                </p>
                <button
                  onClick={() => setViewMode('single')}
                  className="mt-6 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-semibold text-sm text-white transition-all shadow-md shadow-black/10"
                >
                  Find Some Mountains
                </button>
              </div>
            ) : (
              <ComparisonDashboard
                resorts={compareResorts}
                onSelectResort={(resort) => {
                  setSelectedResort(resort);
                  setViewMode('single');
                }}
                title={comparisonRegion}
              />
            )}
          </div>
        ) : (
          /* SINGLE RESORT SEARCH & DETAILS MODE */
          <div className="space-y-8">
            {/* Search Bar */}
            <div className="mb-4">
              <SearchBar
                onSelectResort={setSelectedResort}
                selectedResort={selectedResort}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
              />
            </div>

            {/* Welcome message */}
            {!selectedResort && (
              <div className="glass-card text-center py-12 sm:py-16">
                <div className="text-4xl sm:text-5xl md:text-6xl mb-6">🏔️</div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4 px-4 text-white">Welcome to PowderCast!</h2>
                <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto px-4">
                  Search for your favorite ski resort above to get hyper-local mountain weather data,
                  including snow quality predictions, wind hold alerts, and rider intelligence.
                </p>
                <div className="mt-6 sm:mt-8 text-xs sm:text-sm text-gray-500 px-4">
                  Powered by the National Weather Service API • Covering 22+ major US resorts • Made by{' '}
                  <a href="https://greenido.wordpress.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                    @greenido
                  </a>
                </div>
              </div>
            )}

            {/* Selected resort dashboard */}
            {selectedResort && (
              <div className="space-y-4 sm:space-y-6">
                <ResortHeader
                  resort={selectedResort}
                  elevation={elevation}
                  isFavorite={isFavorite(selectedResort.id)}
                  onToggleFavorite={() => toggleFavorite(selectedResort.id)}
                />

                <ElevationToggle
                  elevation={elevation}
                  onToggle={setElevation}
                  baseElevation={selectedResort.base_elevation}
                  summitElevation={selectedResort.summit_elevation}
                />

                {/* Pro View Toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowProView(!showProView)}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                      showProView
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 border border-white/20'
                    }`}
                  >
                    <BeakerIcon className="w-5 h-5" />
                    <span>{showProView ? 'Hide Pro View' : 'Show Pro View'}</span>
                    <span className="text-xs opacity-75">(All Data)</span>
                  </button>
                </div>

                {loading && !weatherData && (
                  <div className="glass-card text-center py-12">
                    <div className="text-4xl mb-4 animate-bounce">🌨️</div>
                    <div className="text-xl text-gray-400">Loading weather data...</div>
                  </div>
                )}

                {error && !weatherData && (
                  <div className="glass-card border-2 border-mountain-danger text-center py-12">
                    <div className="text-4xl mb-4">⚠️</div>
                    <div className="text-xl text-mountain-danger mb-2">Error Loading Weather</div>
                    <div className="text-gray-400">{error}</div>
                  </div>
                )}

                {weatherData && (
                  <WeatherDashboard
                    weatherData={weatherData}
                    selectedResort={selectedResort}
                    showProView={showProView}
                    error={error}
                    lastFetchTime={lastFetchTime}
                    onRefresh={refresh}
                    loading={loading}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <InstallPWA />

      <FavoritesList
        favorites={favorites}
        onSelectResort={(resort) => {
          setSelectedResort(resort);
          setViewMode('single');
        }}
        onRemoveFavorite={toggleFavorite}
        isOpen={showFavorites}
        onClose={() => setShowFavorites(false)}
      />
    </main>
  );
}

export default function Home() {
  return (
    <ResortsProvider>
      <HomeContent />
    </ResortsProvider>
  );
}
