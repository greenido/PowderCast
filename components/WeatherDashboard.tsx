'use client';

import type { ProcessedWeatherData } from '@/lib/nwsTypes';
import type { Resort } from '@/lib/database';
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

interface WeatherDashboardProps {
  weatherData: ProcessedWeatherData;
  selectedResort: Resort;
  showProView: boolean;
  error: string | null;
}

export default function WeatherDashboard({
  weatherData,
  selectedResort,
  showProView,
  error,
}: WeatherDashboardProps) {
  return (
    <>
      {showProView ? (
        <ProView gridpointUrl={weatherData.gridDataUrl} />
      ) : (
        <>
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

          <DetailedForecast periods={weatherData.periods} />

          <HourlySnowForecast hourlyData={weatherData.hourlySnowForecast} />

          <FutureSnowWidget hourlyData={weatherData.hourlySnowForecast} />

          {/* Snow Quality & Webcams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SnowQualityTag
              quality={weatherData.snowQuality}
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
        </>
      )}

      {error && (
        <div className="text-center text-sm text-gray-500 italic">
          ⚠️ {error}
        </div>
      )}
      <div className="text-center text-xs text-gray-600">
        Data provided by the National Weather Service • Updated: {new Date().toLocaleString()}
      </div>
    </>
  );
}
