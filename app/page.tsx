'use client';

import { useState, useEffect } from 'react';
import SearchBar from '@/components/SearchBar';
import ElevationToggle from '@/components/ElevationToggle';
import ResortHeader from '@/components/ResortHeader';
import WeatherDashboard from '@/components/WeatherDashboard';
import InstallPWA from '@/components/InstallPWA';
import FavoritesList from '@/components/FavoritesList';
import ComparisonDashboard from '@/components/ComparisonDashboard';
import PlannerGrid from '@/components/PlannerGrid';
import UnitsToggle from '@/components/UnitsToggle';
import { useForecast } from '@/hooks/useForecast';
import { useFavorites } from '@/hooks/useFavorites';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { ResortsProvider, useResortsContext } from '@/hooks/useResorts';
import { UnitsProvider, useUnits } from '@/hooks/useUnits';
import PassFilter from '@/components/PassFilter';
import { usePassFilter } from '@/hooks/usePassFilter';
import { filterByPasses } from '@/lib/passes';
import { availableRegions, resortsInRegion, REGION_LABELS } from '@/lib/regions';
import type { Resort, RegionCode } from '@/lib/types';
import { StarIcon, BeakerIcon } from '@heroicons/react/24/solid';

function HomeContent() {
  const { allResorts, resortsLoading, resortsError } = useResortsContext();

  const [selectedResort, setSelectedResort] = useState<Resort | null>(null);
  const [elevation, setElevation] = useState<'base' | 'summit'>('base');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showProView, setShowProView] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'compare' | 'planner'>('single');
  const [comparisonRegion, setComparisonRegion] = useState<RegionCode | 'Favorites'>('us-west');

  const { favorites, toggleFavorite, isFavorite, hasFavorites } = useFavorites(allResorts);
  const passFilter = usePassFilter();
  const { suggestForCountry } = useUnits();

  // Adopt the resort's local convention (°C in the Alps, °F in the US) unless
  // the rider has picked a system explicitly.
  useEffect(() => {
    suggestForCountry(selectedResort?.country);
  }, [selectedResort?.country, suggestForCountry]);

  // Everything downstream of the pass filter sees only resorts the rider can
  // actually use, so search, comparison and the planner all stay consistent.
  const visibleResorts = filterByPasses(allResorts, passFilter.selected);
  const regions = availableRegions(visibleResorts);

  const {
    conditions: weatherData,
    loading,
    error,
    refresh,
    lastFetchTime,
  } = useForecast(selectedResort, elevation);

  // Wire up visibility-aware auto-refresh (15 minutes) for active mountain view
  useAutoRefresh(refresh, 900000, lastFetchTime);

  // Determine which resorts to compare
  const compareResorts =
    comparisonRegion === 'Favorites'
      ? favorites
      : resortsInRegion(visibleResorts, comparisonRegion);

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

        {resortsError && (
          <div className="glass-card mb-6 border border-red-400/30 text-center">
            <div className="mb-2 text-3xl">⚠️</div>
            <h2 className="text-lg font-bold text-white">Could not load the resort list</h2>
            <p className="mt-1 text-sm text-gray-400">{resortsError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-white/10 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20"
            >
              Reload
            </button>
          </div>
        )}

        {/* Pass filter — the question that decides where people actually ski */}
        <div className="mb-6">
          <PassFilter
            resorts={allResorts}
            selected={passFilter.selected}
            onToggle={passFilter.toggle}
            onClear={passFilter.clear}
          />
          <div className="mt-3 flex justify-center">
            <UnitsToggle />
          </div>
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
                if (comparisonRegion === 'Favorites') {
                  setComparisonRegion(regions[0]?.code ?? 'us-west');
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
              onClick={() => setViewMode('planner')}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'planner'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🗓️ 7-Day Planner
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

        {/* 7-DAY PLANNER MODE */}
        {viewMode === 'planner' ? (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-center gap-2">
              {regions.map((region) => (
                <button
                  key={region.code}
                  onClick={() => setComparisonRegion(region.code)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                    comparisonRegion === region.code
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400/30 font-bold'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {region.emoji} {region.label}
                </button>
              ))}
            </div>

            <PlannerGrid
              resorts={
                comparisonRegion === 'Favorites'
                  ? favorites
                  : resortsInRegion(visibleResorts, comparisonRegion, 10)
              }
              title={
                comparisonRegion === 'Favorites'
                  ? 'Favorites'
                  : REGION_LABELS[comparisonRegion]
              }
              onSelectResort={(resort) => {
                setSelectedResort(resort);
                setViewMode('single');
              }}
            />
          </div>
        ) : viewMode === 'compare' ? (
          <div className="space-y-6">
            {/* Region quick filter buttons */}
            {comparisonRegion !== 'Favorites' && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {regions.map((region) => (
                  <button
                    key={region.code}
                    onClick={() => setComparisonRegion(region.code)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                      comparisonRegion === region.code
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400/30 font-bold shadow-md shadow-cyan-500/5'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {region.emoji} {region.label}
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
                title={comparisonRegion === 'Favorites' ? 'Favorites' : REGION_LABELS[comparisonRegion]}
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
                passes={passFilter.selected}
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
                  {resortsLoading ? 'Loading resorts' : `${allResorts.length} resorts`} across the US, Alps, Dolomites, Pyrenees & Japan • Made by{' '}
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
                  source={weatherData?.source}
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
      <UnitsProvider>
        <HomeContent />
      </UnitsProvider>
    </ResortsProvider>
  );
}
