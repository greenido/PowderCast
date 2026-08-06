/**
 * Raw unit conversions.
 *
 * Pure numeric conversion only. Display formatting that depends on the rider's
 * chosen unit system lives in lib/units.ts — keep the two separate so a
 * component can never accidentally render a fixed-unit string.
 */

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

export function cmToInches(cm: number): number {
  return cm * 0.393701;
}

/**
 * NWS grid data reports `snowfallAmount` in millimetres (`wmoUnit:mm`), NOT
 * centimetres. Running those values through cmToInches overstates snowfall by
 * exactly 10x, so always use this for raw NWS snow values.
 */
export function mmToInches(mm: number): number {
  return mm / 25.4;
}

export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

export function msToMph(ms: number): number {
  return ms * 2.23694;
}

/**
 * Parse a wind speed string from an NWS narrative period, e.g. "15 to 20 mph".
 * Returns the upper bound.
 */
export function parseWindSpeed(windSpeedStr: string): number {
  const numbers = windSpeedStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 0;
  return parseInt(numbers[numbers.length - 1], 10);
}

/** NWS wind chill formula. Returns °F. */
export function calculateWindChill(tempF: number, windMph: number): number {
  // Wind chill is only defined at or below 50°F with wind of at least 3 mph.
  if (tempF > 50 || windMph < 3) return tempF;

  return (
    35.74 +
    0.6215 * tempF -
    35.75 * Math.pow(windMph, 0.16) +
    0.4275 * tempF * Math.pow(windMph, 0.16)
  );
}
