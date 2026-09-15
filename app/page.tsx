'use client';

import { useState, useEffect } from 'react';
import SearchBar from '@/components/SearchBar';
import ElevationToggle from '@/components/ElevationToggle';
import ResortHeader from '@/components/ResortHeader';
import WeatherDashboard from '@/components/WeatherDashboard';
import FavoritesList from '@/components/FavoritesList';
import ComparisonDashboard from '@/components/ComparisonDashboard';
import PlannerGrid from '@/components/PlannerGrid';
import ErrorBoundary from '@/components/ErrorBoundary';
import UnitsToggle from '@/components/UnitsToggle';
import ViewTabs, { type ViewTab } from '@/components/ViewTabs';
import { useForecast } from '@/hooks/useForecast';
import { useFavorites } from '@/hooks/useFavorites';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { ResortsProvider, useResortsContext } from '@/hooks/useResorts';
import { UnitsProvider, useUnits } from '@/hooks/useUnits';
import { useResort } from '@/hooks/useResortSearch';
import { useUrlState } from '@/hooks/useUrlState';
import PassFilter from '@/components/PassFilter';
import { usePassFilter } from '@/hooks/usePassFilter';
import { filterByPasses } from '@/lib/passes';
import { availableRegions, resortsInRegion, REGION_LABELS } from '@/lib/regions';
import type { Resort } from '@/lib/types';
import { StarIcon, BeakerIcon } from '@heroicons/react/24/solid';

const DEFAULT_TITLE = "PowderCast - Ultimate Snowboarder's Weather Dashboard";

function HomeContent() {
  const { allResorts, resortsLoading, resortsError } = useResortsContext();

  // View, resort, elevation and region live in the query string so back/forward,
  // refresh, bookmarks and shared links all land on the same view.
  const url = useUrlState();
  const { view: viewMode, elevation, region: comparisonRegion } = url;
  const { resort: selectedResort } = useResort(url.resortId);

  const [showFavorites, setShowFavorites] = useState(false);
  const [showProView, setShowProView] = useState(false);

  const { favorites, toggleFavorite, isFavorite, hasFavorites } = useFavorites(allResorts);
  const passFilter = usePassFilter();
  const { suggestForCountry } = useUnits();

  const selectResort = (resort: Resort | null) =>
    url.update({ view: 'single', resortId: resort?.id ?? null });

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
    forecast,
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

  // The welcome screen keeps the full hero; everywhere else the chrome shrinks
  // so the forecast starts on the first screen.
  const showHero = viewMode === 'single' && !url.resortId;

  const tabs: ViewTab[] = [
    {
      key: 'single',
      label: 'Single Mountain',
      short: 'Mountain',
      emoji: '🏔️',
      active: viewMode === 'single',
      onSelect: () => url.update({ view: 'single' }),
    },
    {
      key: 'compare',
      label: 'Compare Regions',
      short: 'Compare',
      emoji: '📊',
      active: viewMode === 'compare' && comparisonRegion !== 'Favorites',
      onSelect: () =>
        url.update({
          view: 'compare',
          region:
            comparisonRegion === 'Favorites'
              ? (regions[0]?.code ?? 'us-west')
              : comparisonRegion,
        }),
    },
    {
      key: 'planner',
      label: '7-Day Planner',
      short: 'Planner',
      emoji: '🗓️',
      active: viewMode === 'planner',
      onSelect: () => url.update({ view: 'planner' }),
    },
    {
      key: 'favorites',
      label: 'Compare Favorites',
      short: 'Favorites',
      emoji: '⭐',
      active: viewMode === 'compare' && comparisonRegion === 'Favorites',
      badge: favorites.length,
      onSelect: () => url.update({ view: 'compare', region: 'Favorites' }),
    },
  ];

  return (
    // Bottom padding on phones clears the fixed tab bar.
    <main className="min-h-screen px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-6 md:p-8 lg:p-12">
      {/* Name the tab after the mountain so bookmarks and history entries are
          recognisable. The page owns <title> outright (layout metadata sets
          none): with two sources, Next's streamed metadata hydrates late and
          wins over anything set here. */}
      <title>
        {viewMode === 'single' && selectedResort
          ? `${selectedResort.name} · PowderCast`
          : DEFAULT_TITLE}
      </title>
      <div className="max-w-7xl mx-auto">
        {showHero ? (
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
              🏂 PowderCast
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">
              The Ultimate Snowboarder&apos;s Weather App
            </p>

            {hasFavorites && (
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
        ) : (
          /* Compact header once there is something to look at — the hero cost
             most of a phone screen before the first number. */
          <header className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
            <h1 className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl">
              <button onClick={() => url.update({ view: 'single', resortId: null })}>
                🏂 PowderCast
              </button>
            </h1>
            <div className="flex items-center gap-1 sm:gap-2">
              {hasFavorites && (
                <button
                  onClick={() => setShowFavorites(true)}
                  className="rounded-lg p-2 transition-colors hover:bg-white/10"
                  aria-label={`My favorites (${favorites.length})`}
                  title="My favorites"
                >
                  <StarIcon className="h-5 w-5 text-yellow-400" />
                </button>
              )}
              <UnitsToggle />
            </div>
          </header>
        )}

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

        {/* Pass filter — the question that decides where people actually ski.
            Hidden on a resort's page, which it does not affect. */}
        {(showHero || viewMode !== 'single') && (
          <div className="mb-6">
            <PassFilter
              resorts={allResorts}
              selected={passFilter.selected}
              onToggle={passFilter.toggle}
              onClear={passFilter.clear}
            />
            {showHero && (
              <div className="mt-3 flex justify-center">
                <UnitsToggle />
              </div>
            )}
          </div>
        )}

        <ViewTabs tabs={tabs} />

        {/* 7-DAY PLANNER MODE */}
        {viewMode === 'planner' ? (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-center gap-2">
              {regions.map((region) => (
                <button
                  key={region.code}
                  onClick={() => url.update({ region: region.code }, 'replace')}
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

            <ErrorBoundary label="7-Day Planner">


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
                onSelectResort={selectResort}
              />


            </ErrorBoundary>
          </div>
        ) : viewMode === 'compare' ? (
          <div className="space-y-6">
            {/* Region quick filter buttons */}
            {comparisonRegion !== 'Favorites' && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {regions.map((region) => (
                  <button
                    key={region.code}
                    onClick={() => url.update({ region: region.code }, 'replace')}
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
                  onClick={() => url.update({ view: 'single' })}
                  className="mt-6 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-semibold text-sm text-white transition-all shadow-md shadow-black/10"
                >
                  Find Some Mountains
                </button>
              </div>
            ) : (
              <ErrorBoundary label="Comparison">

                <ComparisonDashboard
                  resorts={compareResorts}
                  onSelectResort={selectResort}
                  title={comparisonRegion === 'Favorites' ? 'Favorites' : REGION_LABELS[comparisonRegion]}
                />

              </ErrorBoundary>
            )}
          </div>
        ) : (
          /* SINGLE RESORT SEARCH & DETAILS MODE */
          <div className="space-y-8">
            {/* Search Bar */}
            <div className="mb-4">
              <ErrorBoundary label="Search">

                <SearchBar
                  onSelectResort={selectResort}
                  selectedResort={selectedResort}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                  passes={passFilter.selected}
                />

              </ErrorBoundary>
            </div>

            {/* A deep link waits for the resort list rather than flashing the welcome screen */}
            {url.resortId && !selectedResort && (
              <div className="glass-card text-center py-12">
                {resortsLoading ? (
                  <>
                    <div className="text-4xl mb-4 animate-bounce">🌨️</div>
                    <div className="text-xl text-gray-400">Loading resort...</div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl mb-4">🧭</div>
                    <h2 className="text-xl font-bold text-white">That link doesn&apos;t match a resort</h2>
                    <p className="mt-2 text-sm text-gray-400">
                      It may have been renamed. Search for it above instead.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Welcome message */}
            {!url.resortId && (
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
                  isFavorite={isFavorite(selectedResort.id)}
                  onToggleFavorite={() => toggleFavorite(selectedResort.id)}
                />

                <ElevationToggle
                  elevation={elevation}
                  onToggle={(level) => url.update({ elevation: level }, 'replace')}
                  baseElevation={selectedResort.base_elevation}
                  summitElevation={selectedResort.summit_elevation}
                  source={weatherData?.source}
                  trailing={
                    <button
                      onClick={() => setShowProView(!showProView)}
                      aria-pressed={showProView}
                      title="Every raw forecast series"
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                        showProView
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                          : 'border border-white/20 bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <BeakerIcon className="h-4 w-4" />
                      <span>
                        Pro<span className="hidden sm:inline"> View</span>
                      </span>
                    </button>
                  }
                />

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
                  <ErrorBoundary label="Conditions">

                    <WeatherDashboard
                      weatherData={weatherData}
                      forecast={forecast}
                      selectedResort={selectedResort}
                      elevation={elevation}
                      showProView={showProView}
                      error={error}
                      lastFetchTime={lastFetchTime}
                      onRefresh={refresh}
                      loading={loading}
                    />

                  </ErrorBoundary>
                )}
              </div>
            )}
          </div>
        )}
      </div>


      <FavoritesList
        favorites={favorites}
        onSelectResort={selectResort}
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
