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
import RecentSnowCard from '@/components/RecentSnowCard';
import WindAspectCard from '@/components/WindAspectCard';
import TodaySummary from '@/components/TodaySummary';
import ResortWeekStrip from '@/components/ResortWeekStrip';
import DashboardSection from '@/components/DashboardSection';
import { useUnits } from '@/hooks/useUnits';
import { formatSnow, formatTemp, formatWind } from '@/lib/units';

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
  const { units } = useUnits();

  return (
    <>
      {showProView ? (
        <ProView forecast={forecast} />
      ) : (
        /* The verdict and the week sit in a sticky left column on desktop, so
           they stay in view while the details scroll. On a phone it is one
           column: verdict, week, alerts, then the collapsible details. */
        <div className="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-6">
            <TodaySummary
              weather={weatherData}
              resort={selectedResort}
              elevation={elevation}
            />
            <ResortWeekStrip resort={selectedResort} />
          </div>

          <div className="space-y-4">
            <AlertsSection
              snow24h={weatherData.snow24h}
              bluebirdDay={weatherData.bluebirdDay}
              currentSkyCover={weatherData.currentSkyCover}
              currentWindSpeed={weatherData.currentWindSpeed}
              currentTemp={weatherData.currentTemp}
            />

            <DashboardSection
              title="Snow"
              emoji="❄️"
              hint={`${formatSnow(weatherData.snow24h, units)} next 24h · ${formatSnow(weatherData.snow7day, units)} 7 days`}
              defaultOpen
            >
              {/* Snow line, what already fell and base depth each hide
                  themselves when the provider does not supply the field, so
                  the grid collapses gracefully. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <SnowAccumulationCard
                  snow24h={weatherData.snow24h}
                  snow7day={weatherData.snow7day}
                  range24h={weatherData.snowRange24h}
                  range7day={weatherData.snowRange7day}
                  available={weatherData.snowForecastAvailable}
                />
                <FreezingLevelCard
                  freezingLevelFt={weatherData.freezingLevelFt}
                  resort={selectedResort}
                />
                <RecentSnowCard
                  observedSnow24h={weatherData.observedSnow24h}
                  observedSnow48h={weatherData.observedSnow48h}
                />
                <BaseDepthCard snowDepthIn={weatherData.snowDepthIn} />
              </div>
              <HourlySnowForecast hourlyData={weatherData.hourlySnowForecast} />
              <FutureSnowWidget hourlyData={weatherData.hourlySnowForecast} />
              <SnowQualityTag
                quality={weatherData.snowQuality}
                temperature={weatherData.precipTemp}
                regionCode={selectedResort.regionCode}
                hourly={weatherData.hourlySnowForecast}
              />
            </DashboardSection>

            <DashboardSection
              title="Wind & visibility"
              emoji="💨"
              hint={`Gusts to ${formatWind(weatherData.maxWindGust24h, units)}${
                weatherData.windHoldRisk ? ' · hold risk' : ''
              }`}
              defaultOpen={weatherData.windHoldRisk}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <WindGustsCard
                  currentWindSpeed={weatherData.currentWindSpeed}
                  currentWindGust={weatherData.currentWindGust}
                  maxWindGust24h={weatherData.maxWindGust24h}
                  maxWindGust7day={weatherData.maxWindGust7day}
                />
                <WindAspectCard
                  windDirectionDeg={weatherData.currentWindDirection}
                  windSpeedMph={weatherData.currentWindSpeed}
                  gustMph={weatherData.currentWindGust}
                />
                <VisibilityCard
                  visibility={weatherData.currentVisibility}
                  skyCover={weatherData.currentSkyCover}
                  shortForecast={weatherData.periods[0]?.shortForecast || 'N/A'}
                />
              </div>
            </DashboardSection>

            <DashboardSection
              title="Temperature & humidity"
              emoji="🌡️"
              hint={`${formatTemp(weatherData.minTemp24h, units)} to ${formatTemp(
                weatherData.maxTemp24h,
                units
              )} · ${Math.round(weatherData.currentHumidity)}% humidity`}
              defaultOpen={weatherData.frostbiteRisk}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <TempRangeCard
                  maxTemp24h={weatherData.maxTemp24h}
                  minTemp24h={weatherData.minTemp24h}
                  currentTemp={weatherData.currentTemp}
                  maxPrecipProb24h={weatherData.maxPrecipProb24h}
                />
                <HumidityCard
                  humidity={weatherData.currentHumidity}
                  dewpoint={weatherData.currentDewpoint}
                  temperature={weatherData.currentTemp}
                />
              </div>
            </DashboardSection>

            {/* Prose forecast — NWS only. */}
            {weatherData.periods.length > 0 && (
              <DashboardSection
                title="Forecast discussion"
                emoji="📝"
                hint={weatherData.periods[0]?.shortForecast}
              >
                <DetailedForecast periods={weatherData.periods} />
              </DashboardSection>
            )}

            <WebcamViewer resort={selectedResort} />
          </div>
        </div>
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
