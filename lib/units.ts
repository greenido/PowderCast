/**
 * Unit-system-aware formatting.
 *
 * Every value in RiderConditions is imperial (the app's original audience).
 * These helpers take that imperial value and render it in whichever system
 * the rider prefers, so components never branch on units themselves.
 *
 * An Austrian rider reading "6 inches of snow at 28°F" gets nothing from it.
 */

export type UnitSystem = 'imperial' | 'metric';

const MM_PER_INCH = 25.4;
const CM_PER_INCH = 2.54;
const KM_PER_MILE = 1.609344;
const M_PER_FOOT = 0.3048;

/** Countries that actually use imperial for weather. It is a short list. */
const IMPERIAL_COUNTRIES = new Set(['US']);

/**
 * Default for a resort's country. A US resort shows °F, an Alpine one °C —
 * matching the signage on the mountain and the local forecast riders compare
 * against. An explicit user choice always wins over this.
 */
export function defaultUnitsForCountry(country: string | undefined): UnitSystem {
  return country && IMPERIAL_COUNTRIES.has(country) ? 'imperial' : 'metric';
}

export function formatTemp(tempF: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${Math.round(((tempF - 32) * 5) / 9)}°C`;
  }
  return `${Math.round(tempF)}°F`;
}

/** Bare number, for layouts that render the unit separately. */
export function tempValue(tempF: number, units: UnitSystem): number {
  return units === 'metric' ? Math.round(((tempF - 32) * 5) / 9) : Math.round(tempF);
}

export function tempUnit(units: UnitSystem): string {
  return units === 'metric' ? '°C' : '°F';
}

/**
 * Snowfall. Metric riders talk in centimetres, and the difference between
 * 2cm and 20cm is the difference between a normal Tuesday and a powder day —
 * so keep a decimal below 10cm rather than rounding it away.
 */
export function formatSnow(inches: number, units: UnitSystem): string {
  // Both systems round to zero at the same physical amount (0.1" = 0.254cm),
  // so a trace reads identically no matter which units you are in.
  const ZERO_THRESHOLD_IN = 0.1;

  if (units === 'metric') {
    if (inches < ZERO_THRESHOLD_IN) return '0 cm';
    const cm = inches * CM_PER_INCH;
    if (cm < 10) return `${cm.toFixed(1)} cm`;
    return `${Math.round(cm)} cm`;
  }

  if (inches < ZERO_THRESHOLD_IN) return '0"';
  if (inches < 1) return `${inches.toFixed(1)}"`;
  return `${Math.round(inches)}"`;
}

export function snowValue(inches: number, units: UnitSystem): number {
  const value = units === 'metric' ? inches * CM_PER_INCH : inches;
  return value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
}

export function snowUnit(units: UnitSystem): string {
  return units === 'metric' ? 'cm' : 'in';
}

export function formatWind(mph: number, units: UnitSystem): string {
  return units === 'metric'
    ? `${Math.round(mph * KM_PER_MILE)} km/h`
    : `${Math.round(mph)} mph`;
}

export function windValue(mph: number, units: UnitSystem): number {
  return Math.round(units === 'metric' ? mph * KM_PER_MILE : mph);
}

export function windUnit(units: UnitSystem): string {
  return units === 'metric' ? 'km/h' : 'mph';
}

export function formatElevation(feet: number, units: UnitSystem): string {
  return units === 'metric'
    ? `${Math.round(feet * M_PER_FOOT).toLocaleString()} m`
    : `${Math.round(feet).toLocaleString()} ft`;
}

export function elevationValue(feet: number, units: UnitSystem): number {
  return Math.round(units === 'metric' ? feet * M_PER_FOOT : feet);
}

export function elevationUnit(units: UnitSystem): string {
  return units === 'metric' ? 'm' : 'ft';
}

/** Visibility, given metres (the raw provider unit). */
export function formatVisibility(meters: number, units: UnitSystem): string {
  if (units === 'metric') {
    const km = meters / 1000;
    if (km >= 16) return '16+ km';
    return `${km.toFixed(1)} km`;
  }

  const miles = meters / (KM_PER_MILE * 1000);
  if (miles >= 10) return '10+ mi';
  return `${miles.toFixed(1)} mi`;
}

/** Snow depth for the base-depth card. */
export function formatDepth(inches: number, units: UnitSystem): string {
  return units === 'metric'
    ? `${Math.round(inches * CM_PER_INCH)} cm`
    : `${Math.round(inches)}"`;
}

export { MM_PER_INCH, CM_PER_INCH };
