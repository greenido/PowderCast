'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloudIcon,
  SunIcon,
  BeakerIcon,
  EyeIcon,
  MapIcon,
  FireIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';

interface GridpointData {
  properties: {
    updateTime: string;
    temperature: { values: Array<{ validTime: string; value: number }> };
    dewpoint: { values: Array<{ validTime: string; value: number }> };
    maxTemperature: { values: Array<{ validTime: string; value: number }> };
    minTemperature: { values: Array<{ validTime: string; value: number }> };
    relativeHumidity: { values: Array<{ validTime: string; value: number }> };
    apparentTemperature: { values: Array<{ validTime: string; value: number }> };
    windChill: { values: Array<{ validTime: string; value: number | null }> };
    heatIndex: { values: Array<{ validTime: string; value: number | null }> };
    skyCover: { values: Array<{ validTime: string; value: number }> };
    windDirection: { values: Array<{ validTime: string; value: number }> };
    windSpeed: { values: Array<{ validTime: string; value: number }> };
    windGust: { values: Array<{ validTime: string; value: number }> };
    weather: { values: Array<{ validTime: string; value: any[] }> };
    probabilityOfPrecipitation: { values: Array<{ validTime: string; value: number }> };
    quantitativePrecipitation: { values: Array<{ validTime: string; value: number }> };
    iceAccumulation: { values: Array<{ validTime: string; value: number }> };
    snowfallAmount: { values: Array<{ validTime: string; value: number }> };
    snowLevel: { values: Array<{ validTime: string; value: number }> };
    ceilingHeight: { values: Array<{ validTime: string; value: number | null }> };
    visibility: { values: Array<{ validTime: string; value: number }> };
    transportWindSpeed: { values: Array<{ validTime: string; value: number }> };
    transportWindDirection: { values: Array<{ validTime: string; value: number }> };
    mixingHeight: { values: Array<{ validTime: string; value: number }> };
    probabilityOfThunder: { values: Array<{ validTime: string; value: number }> };
    elevation: { value: number };
  };
}

interface ProViewProps {
  gridpointUrl: string | null;
}

interface DataSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  expanded: boolean;
  data: Array<{ label: string; value: string; unit?: string }>;
}

export default function ProView({ gridpointUrl }: ProViewProps) {
  const [gridData, setGridData] = useState<GridpointData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['❄️ Snow & Precipitation', '🌡️ Temperature', '💨 Wind']));

  const fetchGridData = async () => {
    if (!gridpointUrl) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(gridpointUrl, {
        headers: {
          'User-Agent': 'PowderCast/1.1 (contact@powdercast.app)',
          'Accept': 'application/geo+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch grid data: ${response.status}`);
      }

      const data = await response.json();
      setGridData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gridpointUrl) {
      fetchGridData();
    }
  }, [gridpointUrl]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getLatestValue = (values: Array<{ validTime: string; value: number | null }>) => {
    if (!values || values.length === 0) return null;
    const latest = values[0];
    return latest.value;
  };

  const celsiusToFahrenheit = (c: number) => (c * 9/5) + 32;
  const mmToInches = (mm: number) => mm / 25.4;
  const metersToFeet = (m: number) => m * 3.28084;
  const kmhToMph = (kmh: number) => kmh * 0.621371;
  const metersToMiles = (m: number) => m / 1609.34;

  // Helper to sum snowfall within a time range
  const sumSnowfallInTimeRange = (values: Array<{ validTime: string; value: number | null }>, hours: number) => {
    const now = Date.now();
    const endTime = now + (hours * 3600000);
    let total = 0;
    
    for (const val of values) {
      if (!val.value) continue;
      const time = new Date(val.validTime.split('/')[0]).getTime();
      if (time >= now && time <= endTime) {
        total += val.value;
      }
    }
    return total;
  };

  if (!gridpointUrl) {
    return (
      <div className="glass-card text-center py-8">
        <BeakerIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-400">Select a resort to view Pro data</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card text-center py-12">
        <div className="text-4xl mb-4 animate-pulse">🔬</div>
        <div className="text-xl text-gray-400">Loading detailed weather data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card border-2 border-red-500/50 text-center py-8">
        <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <div className="text-red-400 mb-2">Error Loading Pro Data</div>
        <div className="text-sm text-gray-400">{error}</div>
        <button
          onClick={fetchGridData}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!gridData) return null;

  const props = gridData.properties;
  const currentTemp = getLatestValue(props.temperature.values);
  const currentDewpoint = getLatestValue(props.dewpoint.values);
  const currentWindSpeed = getLatestValue(props.windSpeed.values);
  const currentWindGust = getLatestValue(props.windGust.values);
  const currentWindDir = getLatestValue(props.windDirection.values);
  const currentSkyCover = getLatestValue(props.skyCover.values);
  const currentVisibility = getLatestValue(props.visibility.values);
  const currentHumidity = getLatestValue(props.relativeHumidity.values);
  const currentWindChill = getLatestValue(props.windChill.values);

  // Calculate snow accumulation (forward-looking forecast)
  const snow24h = sumSnowfallInTimeRange(props.snowfallAmount.values, 24);
  const snow48h = sumSnowfallInTimeRange(props.snowfallAmount.values, 48);
  const snow7day = sumSnowfallInTimeRange(props.snowfallAmount.values, 168);

  const sections: DataSection[] = [
    {
      title: '❄️ Snow & Precipitation',
      icon: <CloudIcon className="w-6 h-6" />,
      color: 'cyan',
      expanded: expandedSections.has('❄️ Snow & Precipitation'),
      data: [
        { label: 'Next 24h Snow', value: mmToInches(snow24h).toFixed(1), unit: 'in' },
        { label: 'Next 48h Snow', value: mmToInches(snow48h).toFixed(1), unit: 'in' },
        { label: 'Next 7-day Snow', value: mmToInches(snow7day).toFixed(1), unit: 'in' },
        { label: 'Snow Level', value: props.snowLevel?.values?.[0]?.value ? metersToFeet(props.snowLevel.values[0].value).toFixed(0) : 'N/A', unit: props.snowLevel?.values?.[0]?.value ? 'ft' : '' },
        { label: 'Current Precip Prob', value: (getLatestValue(props.probabilityOfPrecipitation?.values || []) || 0).toString(), unit: '%' },
        { label: 'Max Precip Prob (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let max = 0;
          for (const val of props.probabilityOfPrecipitation?.values || []) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              max = Math.max(max, val.value);
            }
          }
          return max.toString();
        })(), unit: '%' },
        { label: 'Total Precip (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let total = 0;
          for (const val of props.quantitativePrecipitation?.values || []) {
            if (!val.value) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              total += val.value;
            }
          }
          return mmToInches(total).toFixed(2);
        })(), unit: 'in' },
        { label: 'Ice Accumulation (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let total = 0;
          for (const val of props.iceAccumulation?.values || []) {
            if (!val.value) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              total += val.value;
            }
          }
          return mmToInches(total).toFixed(2);
        })(), unit: 'in' },
      ],
    },
    {
      title: '🌡️ Temperature',
      icon: <SunIcon className="w-6 h-6" />,
      color: 'orange',
      expanded: expandedSections.has('🌡️ Temperature'),
      data: [
        { label: 'Current Temp', value: currentTemp ? celsiusToFahrenheit(currentTemp).toFixed(1) : 'N/A', unit: '°F' },
        { label: 'Feels Like', value: getLatestValue(props.apparentTemperature?.values || []) ? celsiusToFahrenheit(getLatestValue(props.apparentTemperature.values)!).toFixed(1) : 'N/A', unit: '°F' },
        { label: 'Wind Chill', value: currentWindChill ? celsiusToFahrenheit(currentWindChill).toFixed(1) : 'N/A', unit: '°F' },
        { label: 'Dewpoint', value: currentDewpoint ? celsiusToFahrenheit(currentDewpoint).toFixed(1) : 'N/A', unit: '°F' },
        { label: 'Max Temp (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let max = -Infinity;
          for (const val of props.temperature.values) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              max = Math.max(max, val.value);
            }
          }
          return max === -Infinity ? 'N/A' : celsiusToFahrenheit(max).toFixed(1);
        })(), unit: '°F' },
        { label: 'Min Temp (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let min = Infinity;
          for (const val of props.temperature.values) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              min = Math.min(min, val.value);
            }
          }
          return min === Infinity ? 'N/A' : celsiusToFahrenheit(min).toFixed(1);
        })(), unit: '°F' },
        { label: 'Relative Humidity', value: currentHumidity?.toString() || 'N/A', unit: '%' },
        { label: 'Heat Index', value: getLatestValue(props.heatIndex?.values || []) ? celsiusToFahrenheit(getLatestValue(props.heatIndex.values)!).toFixed(1) : 'N/A', unit: '°F' },
      ],
    },
    {
      title: '💨 Wind',
      icon: <CloudIcon className="w-6 h-6" />,
      color: 'blue',
      expanded: expandedSections.has('💨 Wind'),
      data: [
        { label: 'Current Wind Speed', value: currentWindSpeed ? kmhToMph(currentWindSpeed).toFixed(1) : 'N/A', unit: 'mph' },
        { label: 'Current Wind Gusts', value: currentWindGust ? kmhToMph(currentWindGust).toFixed(1) : 'N/A', unit: 'mph' },
        { label: 'Wind Direction', value: currentWindDir?.toString() || 'N/A', unit: '°' },
        { label: 'Avg Wind Speed (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let sum = 0;
          let count = 0;
          for (const val of props.windSpeed.values) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              sum += val.value;
              count++;
            }
          }
          return count > 0 ? kmhToMph(sum / count).toFixed(1) : 'N/A';
        })(), unit: 'mph' },
        { label: 'Max Wind Speed (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let max = 0;
          for (const val of props.windSpeed.values) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              max = Math.max(max, val.value);
            }
          }
          return kmhToMph(max).toFixed(1);
        })(), unit: 'mph' },
        { label: 'Max Gust (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let max = 0;
          for (const val of props.windGust.values) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              max = Math.max(max, val.value);
            }
          }
          return kmhToMph(max).toFixed(1);
        })(), unit: 'mph' },
        { label: 'Transport Wind Speed', value: getLatestValue(props.transportWindSpeed?.values || []) ? kmhToMph(getLatestValue(props.transportWindSpeed.values)!).toFixed(1) : 'N/A', unit: 'mph' },
        { label: 'Transport Wind Dir', value: getLatestValue(props.transportWindDirection?.values || [])?.toString() || 'N/A', unit: '°' },
      ],
    },
    {
      title: '👁️ Visibility & Sky',
      icon: <EyeIcon className="w-6 h-6" />,
      color: 'purple',
      expanded: expandedSections.has('👁️ Visibility & Sky'),
      data: [
        { label: 'Current Visibility', value: currentVisibility ? metersToMiles(currentVisibility).toFixed(1) : 'N/A', unit: 'mi' },
        { label: 'Current Sky Cover', value: currentSkyCover?.toString() || 'N/A', unit: '%' },
        { label: 'Cloud Condition', value: currentSkyCover !== null ? (currentSkyCover < 25 ? 'Clear' : currentSkyCover < 50 ? 'Partly Cloudy' : currentSkyCover < 75 ? 'Mostly Cloudy' : 'Overcast') : 'N/A', unit: '' },
        { label: 'Ceiling Height', value: props.ceilingHeight?.values?.[0]?.value ? metersToFeet(props.ceilingHeight.values[0].value).toFixed(0) : 'Unlimited', unit: props.ceilingHeight?.values?.[0]?.value ? 'ft' : '' },
        { label: 'Min Visibility (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let min = Infinity;
          for (const val of props.visibility.values) {
            if (!val.value) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              min = Math.min(min, val.value);
            }
          }
          return min === Infinity ? 'N/A' : metersToMiles(min).toFixed(1);
        })(), unit: 'mi' },
        { label: 'Avg Sky Cover (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let sum = 0;
          let count = 0;
          for (const val of props.skyCover.values) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              sum += val.value;
              count++;
            }
          }
          return count > 0 ? Math.round(sum / count).toString() : 'N/A';
        })(), unit: '%' },
      ],
    },
    {
      title: '⚡ Atmospheric',
      icon: <BeakerIcon className="w-6 h-6" />,
      color: 'yellow',
      expanded: expandedSections.has('⚡ Atmospheric'),
      data: [
        { label: 'Elevation', value: props.elevation?.value ? metersToFeet(props.elevation.value).toFixed(0) : 'N/A', unit: 'ft' },
        { label: 'Current Mixing Height', value: getLatestValue(props.mixingHeight?.values || []) ? metersToFeet(getLatestValue(props.mixingHeight.values)!).toFixed(0) : 'N/A', unit: 'ft' },
        { label: 'Avg Mixing Height (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let sum = 0;
          let count = 0;
          for (const val of props.mixingHeight?.values || []) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              sum += val.value;
              count++;
            }
          }
          return count > 0 ? metersToFeet(sum / count).toFixed(0) : 'N/A';
        })(), unit: 'ft' },
        { label: 'Thunder Probability', value: (getLatestValue(props.probabilityOfThunder?.values || []) || 0).toString(), unit: '%' },
        { label: 'Max Thunder Prob (24h)', value: (() => {
          const now = Date.now();
          const endTime = now + (24 * 3600000);
          let max = 0;
          for (const val of props.probabilityOfThunder?.values || []) {
            if (val.value === null) continue;
            const time = new Date(val.validTime.split('/')[0]).getTime();
            if (time >= now && time <= endTime) {
              max = Math.max(max, val.value);
            }
          }
          return max.toString();
        })(), unit: '%' },
        { label: 'Current Humidity', value: currentHumidity?.toString() || 'N/A', unit: '%' },
      ],
    },
  ];

  const updateTime = new Date(props.updateTime).toLocaleString();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl">
            <BeakerIcon className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Pro View
            </h2>
            <p className="text-sm text-gray-400">Complete NWS Gridpoint Data</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Snow (24h)</div>
            <div className="text-2xl font-bold text-cyan-400">
              {mmToInches(snow24h).toFixed(1)}&quot;
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Temperature</div>
            <div className="text-2xl font-bold text-orange-400">
              {currentTemp ? celsiusToFahrenheit(currentTemp).toFixed(0) : '--'}°F
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Wind Speed</div>
            <div className="text-2xl font-bold text-blue-400">
              {currentWindSpeed ? kmhToMph(currentWindSpeed).toFixed(0) : '--'} mph
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Visibility</div>
            <div className="text-2xl font-bold text-purple-400">
              {currentVisibility ? (currentVisibility / 1609.34).toFixed(1) : '--'} mi
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-4">
          Last Updated: {updateTime}
        </div>
      </div>

      {/* Detailed Sections */}
      {sections.map((section) => (
        <div key={section.title} className="glass-card">
          <button
            onClick={() => toggleSection(section.title)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-${section.color}-500/20 rounded-lg text-${section.color}-400`}>
                {section.icon}
              </div>
              <h3 className="text-xl font-semibold">{section.title}</h3>
            </div>
            {section.expanded ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            )}
          </button>

          {section.expanded && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.data.map((item) => (
                <div
                  key={item.label}
                  className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-all"
                >
                  <div className="text-xs text-gray-400 mb-1">{item.label}</div>
                  <div className="text-lg font-semibold">
                    {item.value}
                    {item.unit && <span className="text-sm text-gray-400 ml-1">{item.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Hourly Snow Forecast */}
      <div className="glass-card">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CloudIcon className="w-6 h-6 text-cyan-400" />
          Hourly Snow Forecast
        </h3>
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {(() => {
              const now = Date.now();
              const oneHourAgo = now - (3600000);
              const futureEntries = props.snowfallAmount.values
                .map((entry, idx) => {
                  const timeStr = entry.validTime.split('/')[0];
                  const time = new Date(timeStr);
                  if (time.getTime() < oneHourAgo) return null;
                  
                  const snowInches = mmToInches(entry.value || 0);
                  return (
                    <div
                      key={idx}
                      className="bg-white/5 rounded-lg p-2 min-w-[70px] text-center border border-white/10"
                    >
                      <div className="text-xs text-gray-400 mb-1">
                        {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs font-semibold text-gray-300 mb-2">
                        {time.toLocaleTimeString([], { hour: 'numeric' })}
                      </div>
                      <div className="text-lg font-bold text-cyan-400">
                        {snowInches > 0 ? snowInches.toFixed(1) : '0'}&quot;
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)
                .slice(0, 48);
              
              if (futureEntries.length === 0) {
                return (
                  <div className="text-center py-4 text-gray-400 w-full">
                    No snow forecast data available for the next 48 hours
                  </div>
                );
              }
              
              return futureEntries;
            })()}
          </div>
        </div>
      </div>

      {/* Hourly Temperature Forecast */}
      <div className="glass-card">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <SunIcon className="w-6 h-6 text-orange-400" />
          Hourly Temperature
        </h3>
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {(() => {
              const now = Date.now();
              const oneHourAgo = now - (3600000);
              const futureEntries = props.temperature.values
                .map((entry, idx) => {
                  const timeStr = entry.validTime.split('/')[0];
                  const time = new Date(timeStr);
                  if (time.getTime() < oneHourAgo) return null;
                  
                  const tempF = entry.value !== null ? celsiusToFahrenheit(entry.value) : null;
                  return (
                    <div
                      key={idx}
                      className="bg-white/5 rounded-lg p-2 min-w-[70px] text-center border border-white/10"
                    >
                      <div className="text-xs text-gray-400 mb-1">
                        {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs font-semibold text-gray-300 mb-2">
                        {time.toLocaleTimeString([], { hour: 'numeric' })}
                      </div>
                      <div className="text-lg font-bold text-orange-400">
                        {tempF !== null ? Math.round(tempF) : '--'}°F
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)
                .slice(0, 48);
              
              if (futureEntries.length === 0) {
                return (
                  <div className="text-center py-4 text-gray-400 w-full">
                    No temperature data available for the next 48 hours
                  </div>
                );
              }
              
              return futureEntries;
            })()}
          </div>
        </div>
      </div>

      {/* Hourly Wind Forecast */}
      <div className="glass-card">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CloudIcon className="w-6 h-6 text-blue-400" />
          Hourly Wind
        </h3>
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {(() => {
              const now = Date.now();
              const oneHourAgo = now - (3600000);
              const futureEntries = props.windSpeed.values
                .map((entry, idx) => {
                  const timeStr = entry.validTime.split('/')[0];
                  const time = new Date(timeStr);
                  if (time.getTime() < oneHourAgo) return null;
                  
                  const windMph = entry.value !== null ? kmhToMph(entry.value) : null;
                  const gustEntry = props.windGust.values[idx];
                  const gustMph = gustEntry?.value !== null ? kmhToMph(gustEntry.value) : null;
                  
                  return (
                    <div
                      key={idx}
                      className="bg-white/5 rounded-lg p-2 min-w-[70px] text-center border border-white/10"
                    >
                      <div className="text-xs text-gray-400 mb-1">
                        {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs font-semibold text-gray-300 mb-2">
                        {time.toLocaleTimeString([], { hour: 'numeric' })}
                      </div>
                      <div className="text-lg font-bold text-blue-400">
                        {windMph !== null ? Math.round(windMph) : '--'}
                      </div>
                      {gustMph && gustMph > 0 && (
                        <div className="text-xs text-blue-300 mt-1">
                          G{Math.round(gustMph)}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">mph</div>
                    </div>
                  );
                })
                .filter(Boolean)
                .slice(0, 48);
              
              if (futureEntries.length === 0) {
                return (
                  <div className="text-center py-4 text-gray-400 w-full">
                    No wind data available for the next 48 hours
                  </div>
                );
              }
              
              return futureEntries;
            })()}
          </div>
        </div>
      </div>

      {/* Hourly Visibility & Sky Cover */}
      <div className="glass-card">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <EyeIcon className="w-6 h-6 text-purple-400" />
          Hourly Visibility & Sky
        </h3>
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {(() => {
              const now = Date.now();
              const oneHourAgo = now - (3600000);
              const futureEntries = props.visibility.values
                .map((entry, idx) => {
                  const timeStr = entry.validTime.split('/')[0];
                  const time = new Date(timeStr);
                  if (time.getTime() < oneHourAgo) return null;
                  
                  const visMiles = entry.value !== null ? metersToMiles(entry.value) : null;
                  const skyEntry = props.skyCover.values[idx];
                  const skyCover = skyEntry?.value ?? null;
                  
                  return (
                    <div
                      key={idx}
                      className="bg-white/5 rounded-lg p-2 min-w-[70px] text-center border border-white/10"
                    >
                      <div className="text-xs text-gray-400 mb-1">
                        {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs font-semibold text-gray-300 mb-2">
                        {time.toLocaleTimeString([], { hour: 'numeric' })}
                      </div>
                      <div className="text-sm font-bold text-purple-400">
                        {visMiles !== null ? visMiles.toFixed(1) : '--'}mi
                      </div>
                      <div className="text-xs text-purple-300 mt-1">
                        {skyCover !== null ? `${skyCover}%` : '--'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {skyCover !== null ? (skyCover < 25 ? 'Clear' : skyCover < 50 ? 'Partly' : skyCover < 75 ? 'Mostly' : 'Overcast') : 'sky'}
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)
                .slice(0, 48);
              
              if (futureEntries.length === 0) {
                return (
                  <div className="text-center py-4 text-gray-400 w-full">
                    No visibility data available for the next 48 hours
                  </div>
                );
              }
              
              return futureEntries;
            })()}
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={fetchGridData}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm border border-white/20 transition-all"
        >
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
}
