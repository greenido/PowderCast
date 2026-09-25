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
 * Snow-to-liquid ratio: mm of settled snow per mm of liquid-equivalent
 * precipitation, as a function of temperature.
 *
 * The "10:1 rule" is a convenient fiction. Crystal growth is most efficient
 * around -15°C, where a millimetre of water arrives as nearly two centimetres
 * of dendrites; near freezing the same millimetre packs into 4-6mm of wet
 * mush, and above about +2°C it is simply rain. This is a coarse
 * Kuchera-style approximation of that curve -- enough to tell powder from
 * Slurpee, not enough to claim a density forecast.
 *
 * Returns 0 when it is too warm to snow, which is the load-bearing case: it is
 * how a base at +4°C stops reporting the summit's snowfall.
 */
export function snowToLiquidRatio(tempC: number): number {
  if (!Number.isFinite(tempC)) return 0;
  if (tempC > 2) return 0; // Rain.
  if (tempC > 1) return 4; // Sleet and slush.
  if (tempC > 0) return 6;
  if (tempC > -2) return 8;
  if (tempC > -4) return 10;
  if (tempC > -7) return 13;
  if (tempC > -10) return 15;
  if (tempC > -15) return 18; // Dendritic growth peak.
  if (tempC > -20) return 15;
  return 12; // Too cold to hold much moisture.
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

  // Snowfall, re-phased for the target elevation.
  //
  // This used to pass through untouched, because converting rain to snow needs
  // the liquid-equivalent amount and the series did not carry it. It does now
  // (NWS publishes quantitativePrecipitation), so the two cases that actually
  // decide a day can be answered: rain at the base arriving as snow at the
  // summit, and the reverse -- the three-hour drive to ride a Slurpee.
  //
  // Where the model already forecasts snow, its own number is kept and only
  // re-scaled for the density change with height; the ratio is only used to
  // build an amount from scratch when the model said rain at its own
  // elevation. Inventing more snow than the model's moisture allows would be a
  // worse failure than under-reporting.
  const snowfallMm = h.snowfallMm.map((native, i) => {
    const precip = h.precipMm[i];
    const nativeTempC = h.temperatureC[i];
    const targetTempC = temperatureC[i];

    // No moisture figure, or no temperature to phase it with: leave it alone.
    if (
      precip === null ||
      precip === undefined ||
      !Number.isFinite(precip) ||
      targetTempC === null ||
      targetTempC === undefined
    ) {
      return native;
    }

    const targetRatio = snowToLiquidRatio(targetTempC);
    if (targetRatio === 0) return 0; // Rain at the target elevation.

    const nativeRatio =
      nativeTempC === null || nativeTempC === undefined
        ? 0
        : snowToLiquidRatio(nativeTempC);

    // The model forecast snow here: keep its amount, adjust only for density.
    if (nativeRatio > 0 && native !== null && native !== undefined && native > 0) {
      return native * (targetRatio / nativeRatio);
    }

    // The model forecast rain (or nothing) here, but it is below freezing at
    // the target. Build the accumulation from the moisture it did forecast.
    return precip * targetRatio;
  });

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
      snowfallMm,
      windSpeedKmh: scaleWind(h.windSpeedKmh),
      windGustKmh: scaleWind(h.windGustKmh),
    },
  };
}
