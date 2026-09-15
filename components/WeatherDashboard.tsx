'use client';

import type { ProcessedWeatherData } from '@/lib/nwsTypes';
import type { Resort, NormalizedForecast } from '@/lib/types';
import AlertsSection from '@/components/AlertsSection';
import SnowAccumulationCard from '@/components/SnowAccumulationCard';
import WindGustsCard from '@/components/WindGustsCard';
import VisibilityCard from '@/components/VisibilityCard';
import HumidityCard from '@/components/HumidityCard';
import TempRangeCard from '@/components/TempRangeCard';
import DetailedForecast from '@/components/DetailedForecast';
import HourlySnowForecast from '@/components/HourlySnowForecast';
import FutureSnowWidget from '@/components/FutureSnowWidget';
import SnowQualityTag from '@/components/SnowQualityTag';
import WebcamViewer from '@/components/WebcamViewer';
import ProView from '@/components/ProView';
import DataFreshness from '@/components/DataFreshness';
import FreezingLevelCard from '@/components/FreezingLevelCard';
import BaseDepthCard from '@/components/BaseDepthCard';
import WindAspectCard from '@/components/WindAspectCard';
import TodaySummary from '@/components/TodaySummary';

interface WeatherDashboardProps {
  weatherData: ProcessedWeatherData;
  /** Normalized series behind weatherData, for the raw Pro View. */
  forecast: NormalizedForecast | null;
  selectedResort: Resort;
  elevation: 'base' | 'summit';
  showProView: boolean;
  error: string | null;
  lastFetchTime: number | null;
  onRefresh: () => void;
  loading: boolean;
}

export default function WeatherDashboard({
  weatherData,
  forecast,
  selectedResort,
  elevation,
  showProView,
  error,
  lastFetchTime,
  onRefresh,
  loading,
}: WeatherDashboardProps) {
  return (
    <>
      {showProView ? (
        <ProView forecast={forecast} />
      ) : (
        <>
          <TodaySummary
            weather={weatherData}
            resort={selectedResort}
            elevation={elevation}
          />

          <AlertsSection
            snow24h={weatherData.snow24h}
            bluebirdDay={weatherData.bluebirdDay}
            currentSkyCover={weatherData.currentSkyCover}
            currentWindSpeed={weatherData.currentWindSpeed}
            currentTemp={weatherData.currentTemp}
          />

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

          {/* Weather Details: Humidity/Dewpoint and Temp/Precip */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HumidityCard
              humidity={weatherData.currentHumidity}
              dewpoint={weatherData.currentDewpoint}
              temperature={weatherData.currentTemp}
            />
            <TempRangeCard
              maxTemp24h={weatherData.maxTemp24h}
              minTemp24h={weatherData.minTemp24h}
              currentTemp={weatherData.currentTemp}
              maxPrecipProb24h={weatherData.maxPrecipProb24h}
            />
          </div>

          {/* Mountain intelligence — snow line, base depth, wind loading.
              Each card hides itself when its provider does not supply the
              underlying field, so the row collapses gracefully on NWS. */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <FreezingLevelCard
              freezingLevelFt={weatherData.freezingLevelFt}
              resort={selectedResort}
            />
            <BaseDepthCard snowDepthIn={weatherData.snowDepthIn} />
            <WindAspectCard
              windDirectionDeg={weatherData.currentWindDirection}
              windSpeedMph={weatherData.currentWindSpeed}
              gustMph={weatherData.currentWindGust}
            />
          </div>

          {/* Prose forecast — NWS only. */}
          {weatherData.periods.length > 0 && (
            <DetailedForecast periods={weatherData.periods} />
          )}

          <HourlySnowForecast hourlyData={weatherData.hourlySnowForecast} />

          <FutureSnowWidget hourlyData={weatherData.hourlySnowForecast} />

          {/* Snow Quality & Webcams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SnowQualityTag
              quality={weatherData.snowQuality}
              temperature={weatherData.precipTemp}
              regionCode={selectedResort.regionCode}
              hourly={weatherData.hourlySnowForecast}
            />
            <WebcamViewer resort={selectedResort} />
          </div>
        </>
      )}

      {error && (
        <div className="text-center text-sm text-gray-500 italic">
          ⚠️ {error}
        </div>
      )}
      <div className="flex flex-col items-center justify-center gap-2 mt-6">
        <DataFreshness
          lastFetchTime={lastFetchTime}
          onRefresh={onRefresh}
          loading={loading}
        />
        <div className="text-center text-[10px] text-gray-600 uppercase tracking-wider mt-2 font-semibold">
          Data provided by {weatherData.attribution}
          {weatherData.model && (
            <span className="normal-case tracking-normal"> · {weatherData.model}</span>
          )}
        </div>
      </div>
    </>
  );
}
