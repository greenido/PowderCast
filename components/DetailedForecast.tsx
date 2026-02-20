'use client';

import { useState } from 'react';
import { DocumentTextIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';
import type { NWSForecastPeriod } from '@/lib/nwsTypes';

interface DetailedForecastProps {
  periods: NWSForecastPeriod[];
}

export default function DetailedForecast({ periods }: DetailedForecastProps) {
  const [expandedPeriods, setExpandedPeriods] = useState<Set<number>>(new Set([0])); // First period expanded by default

  const togglePeriod = (periodNumber: number) => {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(periodNumber)) {
      newExpanded.delete(periodNumber);
    } else {
      newExpanded.add(periodNumber);
    }
    setExpandedPeriods(newExpanded);
  };

  return (
    <div className="glass-card">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl">
          <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
        </div>
        <div>
          <h3 className="metric-label text-lg sm:text-xl">Detailed Forecast</h3>
          <p className="text-xs sm:text-sm text-gray-400">NWS narrative forecast</p>
        </div>
      </div>

      <div className="space-y-3">
        {periods.slice(0, 7).map((period) => {
          const isExpanded = expandedPeriods.has(period.number);
          const precipProb = period.probabilityOfPrecipitation?.value || 0;
          
          return (
            <div
              key={period.number}
              className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:bg-white/10 transition-all"
            >
              <button
                onClick={() => togglePeriod(period.number)}
                className="w-full p-3 sm:p-4 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1">
                      <div className="font-semibold text-base sm:text-lg text-cyan-400">
                        {period.name}
                      </div>
                      {precipProb > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                          {precipProb}% precip
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                      <span className="text-xl sm:text-2xl font-bold text-white">
                        {period.temperature}°{period.temperatureUnit}
                      </span>
                      <span>{period.windSpeed} {period.windDirection}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-300">{period.shortForecast}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                      {period.detailedForecast}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={() => {
            if (expandedPeriods.size === periods.length) {
              setExpandedPeriods(new Set());
            } else {
              setExpandedPeriods(new Set(periods.map(p => p.number)));
            }
          }}
          className="text-xs sm:text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {expandedPeriods.size === periods.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
    </div>
  );
}
