/**
 * Derives the rider-facing condition model from a normalized forecast.
 *
 * This is the single place raw SI values become the numbers on screen, and the
 * only place unit conversion happens for computed metrics.
 */

import type { NormalizedForecast, NarrativePeriod } from '@/lib/types';
import {
  mmToInches,
  celsiusToFahrenheit,
  kmhToMph,
  metersToFeet,
  calculateWindChill,
} from '@/lib/unitConversion';
import {
  determineSnowQuality,
  isPowderAlert,
  isBluebirdDay,
  hasFrostbiteRisk,
  hasWindHoldRisk,
} from '@/lib/snowLogic';
import type { SnowQuality } from '@/lib/snowLogic';
import { sumOver, maxOver, minOver, avgOver, valueAt, snowWeightedTempC } from '@/lib/series';

export interface HourlySnowData {
  time: string;
  hour: number;
  snowfall: number; // inches
  temperature: number; // °F
  windSpeed: number; // mph
  snowQuality: SnowQuality;
}

/**
 * Imperial-facing display model. Field names match the original
 * ProcessedWeatherData so existing components keep working; new fields are
 * additive and nullable where a provider may not supply them.
 */
export interface RiderConditions {
  currentTemp: number;
  currentWindSpeed: number;
  currentWindGust: number;
  currentWindDirection: number | null;
  currentVisibility: number;
  currentSkyCover: number;
  currentHumidity: number;
  currentDewpoint: number;

  snow24h: number;
  snow48h: number;
  snow7day: number;

  maxWindGust24h: number;
  maxWindGust7day: number;
  avgWindSpeed: number;

  maxTemp24h: number;
  minTemp24h: number;
  maxPrecipProb24h: number;

  /** Height of the snow/rain line in feet, null when unavailable. */
  freezingLevelFt: number | null;
  /** Settled base depth in inches, null when the provider omits it. */
  snowDepthIn: number | null;

  snowQuality: SnowQuality;
  windHoldRisk: boolean;
  frostbiteRisk: boolean;
  bluebirdDay: boolean;
  powderAlert: boolean;
  precipTemp: number | null;
  windChill: number;

  hourlySnowForecast: HourlySnowData[];

  periods: NarrativePeriod[];
  source: string;
  model?: string;
  attribution: string;
  gridDataUrl: string;
  forecastElevationFt: number | null;
}

export function deriveConditions(
  forecast: NormalizedForecast,
  now: number = Date.now()
): RiderConditions {
  const h = forecast.hourly;
  const t = h.time;

  // --- Current conditions -------------------------------------------------
  const currentTempC = valueAt(h.temperatureC, t, now);
  const currentTemp = currentTempC === null ? 32 : celsiusToFahrenheit(currentTempC);

  const windKmh = valueAt(h.windSpeedKmh, t, now);
  const currentWindSpeed = windKmh === null ? 0 : kmhToMph(windKmh);

  const gustKmh = valueAt(h.windGustKmh, t, now);
  const currentWindGust = gustKmh === null ? currentWindSpeed : kmhToMph(gustKmh);

  const dewpointC = valueAt(h.dewpointC, t, now);
  const currentDewpoint =
    dewpointC === null ? currentTemp - 5 : celsiusToFahrenheit(dewpointC);

  // --- Accumulation (mm in, inches out) -----------------------------------
  const snow24h = mmToInches(sumOver(h.snowfallMm, t, now, 24));
  const snow48h = mmToInches(sumOver(h.snowfallMm, t, now, 48));
  const snow7day = mmToInches(sumOver(h.snowfallMm, t, now, 168));

  // --- Snow quality -------------------------------------------------------
  // Weighted by snowfall so the classification reflects conditions while snow
  // is falling. Falls back to the current temp when nothing is forecast, which
  // describes the existing surface rather than a storm.
  const precipTempC = snowWeightedTempC(h, now, 24);
  const precipTemp = precipTempC === null ? null : celsiusToFahrenheit(precipTempC);
  const snowQuality: SnowQuality = determineSnowQuality(precipTemp ?? currentTemp);

  // --- Everything else ----------------------------------------------------
  const currentSkyCover = valueAt(h.cloudCoverPct, t, now) ?? 0;
  const windChill = calculateWindChill(currentTemp, currentWindSpeed);
  const maxWindGust24h = kmhToMph(maxOver(h.windGustKmh, t, now, 24) ?? 0);

  const freezingLevelM = valueAt(h.freezingLevelM, t, now);
  const snowDepthCm = valueAt(h.snowDepthCm, t, now);

  const tempMaxC = maxOver(h.temperatureC, t, now, 24);
  const tempMinC = minOver(h.temperatureC, t, now, 24);

  const hourlySnowForecast = buildHourly(forecast, now, 48);

  return {
    currentTemp,
    currentWindSpeed,
    currentWindGust,
    currentWindDirection: valueAt(h.windDirectionDeg, t, now),
    currentVisibility: valueAt(h.visibilityM, t, now) ?? 16_000,
    currentSkyCover,
    currentHumidity: valueAt(h.humidityPct, t, now) ?? 50,
    currentDewpoint,

    snow24h,
    snow48h,
    snow7day,

    maxWindGust24h,
    maxWindGust7day: kmhToMph(maxOver(h.windGustKmh, t, now, 168) ?? 0),
    avgWindSpeed: kmhToMph(avgOver(h.windSpeedKmh, t, now, 24) ?? 0),

    maxTemp24h: tempMaxC === null ? currentTemp : celsiusToFahrenheit(tempMaxC),
    minTemp24h: tempMinC === null ? currentTemp : celsiusToFahrenheit(tempMinC),
    maxPrecipProb24h: maxOver(h.precipProbPct, t, now, 24) ?? 0,

    freezingLevelFt: freezingLevelM === null ? null : metersToFeet(freezingLevelM),
    snowDepthIn: snowDepthCm === null ? null : snowDepthCm / 2.54,

    snowQuality,
    windHoldRisk: hasWindHoldRisk(maxWindGust24h),
    frostbiteRisk: hasFrostbiteRisk(windChill),
    bluebirdDay: isBluebirdDay(currentSkyCover, currentWindSpeed),
    powderAlert: isPowderAlert(snow24h),
    precipTemp,
    windChill,

    hourlySnowForecast,

    periods: forecast.narrative ?? [],
    source: forecast.source,
    model: forecast.model,
    attribution: forecast.attribution,
    gridDataUrl: forecast.sourceUrl ?? '',
    forecastElevationFt:
      forecast.elevationM === null ? null : metersToFeet(forecast.elevationM),
  };
}

function buildHourly(
  forecast: NormalizedForecast,
  now: number,
  hours: number
): HourlySnowData[] {
  const h = forecast.hourly;
  const out: HourlySnowData[] = [];

  for (let i = 0; i < h.time.length && out.length < hours; i++) {
    if (h.time[i] < now - 3_600_000) continue;

    const tempC = h.temperatureC[i];
    const tempF = tempC === null || tempC === undefined ? 32 : celsiusToFahrenheit(tempC);
    const windKmh = h.windSpeedKmh[i];
    const date = new Date(h.time[i]);

    out.push({
      time: date.toISOString(),
      hour: date.getHours(),
      snowfall: parseFloat(mmToInches(h.snowfallMm[i] ?? 0).toFixed(2)),
      temperature: Math.round(tempF),
      windSpeed: Math.round(kmhToMph(windKmh ?? 0)),
      snowQuality: determineSnowQuality(tempF),
    });
  }

  return out;
}
