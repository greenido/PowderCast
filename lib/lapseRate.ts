/**
 * Elevation correction for providers that cannot resolve it themselves.
 *
 * The original base/summit toggle was close to a placebo. Base and summit
 * coordinates for a resort sit a few hundred metres apart, well inside a
 * single NWS 2.5km grid cell — Palisades Tahoe's base and summit both resolve
 * to grid REV 28,94 and returned byte-identical forecasts. Even where two
 * cells differ, an NWS gridpoint carries one representative elevation and
 * knows nothing about a 2,000ft vertical.
 *
 * Open-Meteo takes an `elevation` parameter and genuinely downscales, so it
 * needs none of this. For NWS we apply a physical correction instead, and the
 * UI says the summit view is modelled rather than forecast.
 */

import type { NormalizedForecast } from '@/lib/types';

/**
 * Environmental lapse rates, °C per 1000m.
 *
 * Dry adiabatic is about 9.8°C/1000m, saturated about 5°C/1000m. Real
 * mountain air sits in between and depends on humidity, so we interpolate:
 * humid, snowing air cools slowly with height; dry, clear air cools fast.
 */
const DRY_LAPSE_C_PER_KM = 9.0;
const MOIST_LAPSE_C_PER_KM = 5.0;

export function lapseRateCPerKm(humidityPct: number | null): number {
  if (humidityPct === null || !Number.isFinite(humidityPct)) {
    // Standard atmosphere, a reasonable middle when humidity is unknown.
    return 6.5;
  }

  const saturation = Math.max(0, Math.min(1, (humidityPct - 40) / 60));
  return DRY_LAPSE_C_PER_KM - saturation * (DRY_LAPSE_C_PER_KM - MOIST_LAPSE_C_PER_KM);
}

/**
 * Wind speed increases with elevation as terrain roughness falls away and
 * exposure rises. Summits routinely see 1.3-1.8x the wind of the valley
 * floor; this is a conservative approximation, not a boundary-layer model.
 */
function windMultiplier(deltaM: number): number {
  if (deltaM <= 0) return 1;
  return Math.min(1.8, 1 + (deltaM / 1000) * 0.35);
}

/**
 * Shift a forecast from its native elevation to a target elevation.
 *
 * Adjusts temperature and dewpoint by the lapse rate, scales wind for
 * exposure, and reclassifies precipitation as snow where the corrected
 * temperature has dropped below freezing. Returns the input unchanged when
 * there is nothing meaningful to correct.
 */
export function applyElevationCorrection(
  forecast: NormalizedForecast,
  targetElevationM: number
): NormalizedForecast {
  const sourceElevationM = forecast.elevationM;

  // Nothing to correct against, or the difference is within model noise.
  if (sourceElevationM === null || Math.abs(targetElevationM - sourceElevationM) < 100) {
    return forecast;
  }

  const deltaKm = (targetElevationM - sourceElevationM) / 1000;
  const h = forecast.hourly;

  const temperatureC = h.temperatureC.map((t, i) => {
    if (t === null || t === undefined) return t;
    return t - lapseRateCPerKm(h.humidityPct[i] ?? null) * deltaKm;
  });

  const dewpointC = h.dewpointC.map((d, i) => {
    if (d === null || d === undefined) return d;
    // Dewpoint falls more slowly than temperature (~2°C/km).
    return d - 2.0 * deltaKm;
  });

  const multiplier = windMultiplier(targetElevationM - sourceElevationM);
  const scaleWind = (series: Array<number | null>) =>
    series.map((v) => (v === null || v === undefined ? v : v * multiplier));

  // Note: snowfall is deliberately NOT corrected. Precipitation that falls as
  // rain at the base can arrive as snow at the summit, but converting it needs
  // the liquid-equivalent precipitation amount, which this series does not
  // carry. Estimating an accumulation the model never produced would be worse
  // than under-reporting, so the snow figures pass through untouched and the
  // UI labels the corrected view as modelled.

  return {
    ...forecast,
    elevationM: targetElevationM,
    model: forecast.model
      ? `${forecast.model} · elevation-adjusted`
      : 'elevation-adjusted',
    hourly: {
      ...h,
      temperatureC,
      dewpointC,
      windSpeedKmh: scaleWind(h.windSpeedKmh),
      windGustKmh: scaleWind(h.windGustKmh),
    },
  };
}
