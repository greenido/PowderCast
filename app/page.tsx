'use client';

import { useState } from 'react';
import SearchBar from '@/components/SearchBar';
import ElevationToggle from '@/components/ElevationToggle';
import SnowAccumulationCard from '@/components/SnowAccumulationCard';
import WindGustsCard from '@/components/WindGustsCard';
import VisibilityCard from '@/components/VisibilityCard';
import SnowQualityTag from '@/components/SnowQualityTag';
import PowderAlert from '@/components/PowderAlert';
import BluebirdIndicator from '@/components/BluebirdIndicator';
import FrostbiteWarning from '@/components/FrostbiteWarning';
import WebcamViewer from '@/components/WebcamViewer';
import HourlySnowForecast from '@/components/HourlySnowForecast';
import InstallPWA from '@/components/InstallPWA';
import { useNWSWeather } from '@/hooks/useNWSWeather';
import type { Resort } from '@/lib/database';

export default function Home() {
  const [selectedResort, setSelectedResort] = useState<Resort | null>(null);
  const [elevation, setElevation] = useState<'base' | 'summit'>('base');

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

  const { weatherData, loading, error } = useNWSWeather(lat, lon);

  return (
    <main className="min-h-screen p-4 sm:p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            🏂 PowderCast
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 px-4">
            The Ultimate Snowboarder&apos;s Weather App
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            onSelectResort={setSelectedResort}
            selectedResort={selectedResort}
          />
        </div>

        {/* Content */}
        {!selectedResort && (
          <div className="glass-card text-center py-12 sm:py-16">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-6">🏔️</div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 px-4">Welcome to PowderCast!</h2>
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

        {selectedResort && (
          <div className="space-y-4 sm:space-y-6">
            {/* Resort Header */}
            <div className="glass-card">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-cyan-400 mb-2">
                    {selectedResort.name}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-400">
                    {selectedResort.region}, {selectedResort.state}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider mb-1">
                    Current View
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-cyan-400">
                    {elevation === 'base' ? 'Base' : 'Summit'}
                  </div>
                  <div className="text-base sm:text-lg text-gray-400">
                    {elevation === 'base'
                      ? selectedResort.base_elevation.toLocaleString()
                      : selectedResort.summit_elevation.toLocaleString()}ft
                  </div>
                </div>
              </div>
            </div>

            {/* Elevation Toggle */}
            <ElevationToggle
              elevation={elevation}
              onToggle={setElevation}
              baseElevation={selectedResort.base_elevation}
              summitElevation={selectedResort.summit_elevation}
            />

            {/* Loading State */}
            {loading && (
              <div className="glass-card text-center py-12">
                <div className="text-4xl mb-4 animate-bounce">🌨️</div>
                <div className="text-xl text-gray-400">Loading weather data...</div>
              </div>
            )}

            {/* Error State */}
            {error && !weatherData && (
              <div className="glass-card border-2 border-mountain-danger text-center py-12">
                <div className="text-4xl mb-4">⚠️</div>
                <div className="text-xl text-mountain-danger mb-2">Error Loading Weather</div>
                <div className="text-gray-400">{error}</div>
              </div>
            )}

            {/* Weather Data */}
            {weatherData && (
              <>
                {/* Special Alerts */}
                <div className="space-y-4">
                  <PowderAlert snow24h={weatherData.snow24h} />
                  <BluebirdIndicator
                    isBluebird={weatherData.bluebirdDay}
                    skyCover={weatherData.currentSkyCover}
                    windSpeed={weatherData.currentWindSpeed}
                  />
                  <FrostbiteWarning
                    temperature={weatherData.currentTemp}
                    windSpeed={weatherData.currentWindSpeed}
                  />
                </div>

                {/* The Big Three */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <SnowAccumulationCard
                    snow24h={weatherData.snow24h}
                    snow7day={weatherData.snow7day}
                  />
                  <WindGustsCard
                    currentWindSpeed={weatherData.currentWindSpeed}
                    currentWindGust={weatherData.currentWindGust}
                    maxWindGust24h={weatherData.maxWindGust24h}
                    maxWindGust7day={weatherData.maxWindGust7day}
                  />
                  <VisibilityCard
                    visibility={weatherData.currentVisibility}
                    skyCover={weatherData.currentSkyCover}
                    shortForecast={weatherData.periods[0]?.shortForecast || 'N/A'}
                  />
                </div>

                {/* Hourly Snow Forecast */}
                <HourlySnowForecast hourlyData={weatherData.hourlySnowForecast} />

                {/* Snow Quality & Webcams */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SnowQualityTag
                    quality={weatherData.snowQuality as any}
                    temperature={weatherData.precipTemp}
                  />
                  <WebcamViewer
                    webcamUrl={selectedResort.webcam_url}
                    resortName={selectedResort.name}
                  />
                </div>

                {/* 7-Day Forecast */}
                <div className="glass-card">
                  <h3 className="metric-label mb-4 sm:mb-6">7-Day Forecast</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {weatherData.periods.slice(0, 7).map((period) => (
                      <div
                        key={period.number}
                        className="bg-white/5 border border-white/10 rounded-lg p-3 sm:p-4 hover:bg-white/10 transition-all"
                      >
                        <div className="font-semibold text-base sm:text-lg mb-2 text-cyan-400">
                          {period.name}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                          <div className="text-2xl sm:text-3xl font-bold">
                            {period.temperature}°
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400">
                            {period.windSpeed}
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-300">
                          {period.shortForecast}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info Footer */}
                {error && (
                  <div className="text-center text-sm text-gray-500 italic">
                    ⚠️ {error}
                  </div>
                )}
                <div className="text-center text-xs text-gray-600">
                  Data provided by the National Weather Service • Updated: {new Date().toLocaleString()}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* PWA Install Prompt */}
      <InstallPWA />
    </main>
  );
}
