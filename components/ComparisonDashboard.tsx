'use client';

import { useState } from 'react';
import type { Resort } from '@/lib/types';
import { useMultiForecast } from '@/hooks/useForecast';
import { calculateRideScore, getRideScoreLabel } from '@/lib/rideScore';
import { getSnowQualityInfo } from '@/lib/snowLogic';
import { 
  StarIcon, 
  ArrowPathIcon, 
  ChevronRightIcon, 
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/react/24/solid';

interface ComparisonDashboardProps {
  resorts: Resort[];
  onSelectResort: (resort: Resort) => void;
  title: string;
}

type SortOption = 'rideScore' | 'snowfall' | 'name';

export default function ComparisonDashboard({ resorts, onSelectResort, title }: ComparisonDashboardProps) {
  const { data, errors, loading, refresh } = useMultiForecast(resorts);
  const [sortBy, setSortBy] = useState<SortOption>('rideScore');

  // Prepare and enrich the resort list with weather & scores if available
  const processedResorts = resorts.map((resort) => {
    const weather = data[resort.id];
    const error = errors[resort.id];
    
    if (weather) {
      const scoreBreakdown = calculateRideScore(weather);
      return {
        resort,
        weather,
        score: scoreBreakdown.score,
        scoreBreakdown,
        error: null,
      };
    }
    
    return {
      resort,
      weather: null,
      score: -1,
      scoreBreakdown: null,
      error,
    };
  });

  // Sort the resorts based on selected sorting option
  const sortedResorts = [...processedResorts].sort((a, b) => {
    // If one is loading/has error, push it to the end
    if (!a.weather && b.weather) return 1;
    if (a.weather && !b.weather) return -1;
    if (!a.weather && !b.weather) return a.resort.name.localeCompare(b.resort.name);

    if (sortBy === 'rideScore') {
      return b.score - a.score;
    } else if (sortBy === 'snowfall') {
      return (b.weather?.snow24h || 0) - (a.weather?.snow24h || 0);
    } else {
      return a.resort.name.localeCompare(b.resort.name);
    }
  });

  return (
    <div className="space-y-6">
      {/* Dashboard Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-md">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
            🏔️ Compare Resorts
            <span className="text-sm font-normal text-gray-400 bg-white/10 px-2.5 py-0.5 rounded-full">
              {title} ({resorts.length})
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Compare ski resort weather conditions and powder depth at a glance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Sorting Controls */}
          <div className="flex bg-black/30 border border-white/10 rounded-lg p-1 text-xs sm:text-sm">
            <button
              onClick={() => setSortBy('rideScore')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                sortBy === 'rideScore'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🏆 Ride Score
            </button>
            <button
              onClick={() => setSortBy('snowfall')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                sortBy === 'snowfall'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🌨️ 24h Snow
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                sortBy === 'name'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔤 Name
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="inline-flex items-center justify-center p-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-all text-white disabled:opacity-50"
            title="Refresh All"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Resorts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sortedResorts.map(({ resort, weather, score, scoreBreakdown, error }) => {
          const isResortLoading = loading && !weather && !error;

          // Loading Skeleton State
          if (isResortLoading) {
            return (
              <div 
                key={resort.id} 
                className="glass-card p-6 border border-white/10 animate-pulse space-y-4"
              >
                <div className="h-6 bg-white/10 rounded-md w-2/3"></div>
                <div className="flex gap-4 items-center">
                  <div className="w-16 h-16 rounded-full bg-white/10"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-white/10 rounded-md w-1/2"></div>
                    <div className="h-4 bg-white/10 rounded-md w-3/4"></div>
                  </div>
                </div>
                <div className="h-10 bg-white/10 rounded-md w-full mt-4"></div>
              </div>
            );
          }

          // Error State for this specific resort
          if (error) {
            return (
              <div 
                key={resort.id} 
                className="glass-card p-6 border-2 border-red-500/20 bg-red-950/10 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white leading-tight">{resort.name}</h3>
                    <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded">
                      {resort.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-red-400 mt-4">
                    <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-semibold">Failed to fetch weather</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{error}</p>
                </div>
                <button
                  onClick={() => onSelectResort(resort)}
                  className="w-full mt-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl font-semibold text-sm transition-all text-gray-300 flex items-center justify-center gap-1"
                >
                  View Offline Info
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            );
          }

          // Render Active Weather Data for this resort
          if (weather) {
            const scoreLabel = getRideScoreLabel(score);
            const snowInfo = getSnowQualityInfo(weather.snowQuality);
            const isWindHold = weather.windHoldRisk;

            return (
              <div 
                key={resort.id} 
                className="glass-card hover-glow p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1"
              >
                <div>
                  {/* Resort Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight tracking-wide">{resort.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{resort.region}</p>
                    </div>
                    <span className="text-xs text-gray-300 bg-white/10 px-2.5 py-0.5 rounded-full font-bold border border-white/5">
                      {resort.state}
                    </span>
                  </div>

                  {/* Condition Summary and Score */}
                  <div className="flex items-center gap-4 my-5 bg-white/5 p-3 rounded-xl border border-white/5">
                    {/* circular Ride Score Indicator */}
                    <div className="relative flex items-center justify-center shrink-0">
                      <div className="w-14 h-14 rounded-full border-4 border-black/30 flex flex-col items-center justify-center bg-black/40">
                        <span className={`text-xl font-bold tracking-tighter ${scoreLabel.color}`}>
                          {score}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreLabel.bgColor} ${scoreLabel.color} border ${scoreLabel.borderColor}`}>
                        {scoreLabel.label}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        Comfortable riding conditions
                      </p>
                    </div>
                  </div>

                  {/* Conditions details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {/* Temperature */}
                    <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                      <span className="text-gray-400 block mb-0.5">Temp</span>
                      <span className="text-white font-bold text-sm block">
                        🌡️ {Math.round(weather.currentTemp)}°F
                      </span>
                    </div>

                    {/* Snow Forecast */}
                    <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                      <span className="text-gray-400 block mb-0.5">24h Snow</span>
                      <span className="text-white font-bold text-sm block flex items-center gap-1">
                        🌨️ {weather.snow24h.toFixed(1)}&quot;
                        {weather.snow24h > 0 && (
                          <span className={`text-[10px] font-bold ${snowInfo.color} shrink-0`}>
                            ({weather.snowQuality.split(' ')[0]})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Wind and Holds */}
                    <div className={`p-2.5 rounded-lg border ${
                      isWindHold 
                        ? 'bg-amber-500/10 border-amber-500/20' 
                        : 'bg-white/5 border-white/5'
                    }`}>
                      <span className="text-gray-400 block mb-0.5">Wind / Gust</span>
                      <span className={`font-bold text-sm block flex items-center gap-1 ${
                        isWindHold ? 'text-amber-400' : 'text-white'
                      }`}>
                        💨 {Math.round(weather.currentWindSpeed)} mph
                        {weather.currentWindGust > weather.currentWindSpeed && (
                          <span className="text-[10px] font-normal text-gray-400">
                            ({Math.round(weather.currentWindGust)}g)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Sky / Visibility */}
                    <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                      <span className="text-gray-400 block mb-0.5">Sky / Vis</span>
                      <span className="text-white font-bold text-sm block truncate">
                        {weather.bluebirdDay ? '☀️ Bluebird' : `☁️ ${weather.currentSkyCover}% cover`}
                      </span>
                    </div>
                  </div>

                  {/* Condition Badges */}
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {weather.powderAlert && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-400/20 flex items-center gap-0.5">
                        <SparklesIcon className="w-3 h-3 text-cyan-400" />
                        POWDER ALERT
                      </span>
                    )}
                    {weather.bluebirdDay && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-400/20 flex items-center gap-0.5">
                        ☀️ BLUEBIRD DAY
                      </span>
                    )}
                    {isWindHold && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-400/20 flex items-center gap-0.5">
                        <ExclamationTriangleIcon className="w-3 h-3 text-amber-400" />
                        WIND HOLD RISK
                      </span>
                    )}
                  </div>
                </div>

                {/* View Details Button */}
                <button
                  onClick={() => onSelectResort(resort)}
                  className="w-full mt-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-xl font-bold text-sm transition-all text-white shadow-md shadow-cyan-500/10 hover:shadow-cyan-400/20 flex items-center justify-center gap-1"
                >
                  View Details
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            );
          }

          // Fallback loading
          return (
            <div key={resort.id} className="glass-card p-6 border border-white/10 flex items-center justify-center text-gray-400">
              <span className="text-sm">Initializing...</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
