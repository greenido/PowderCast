// Unit conversion utilities for weather data

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9/5) + 32;
}

/**
 * Convert Fahrenheit to Celsius
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * 5/9;
}

/**
 * Convert centimeters to inches
 */
export function cmToInches(cm: number): number {
  return cm * 0.393701;
}

/**
 * Convert inches to centimeters
 */
export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

/**
 * Convert meters to feet
 */
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

/**
 * Convert km/h to mph
 */
export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

/**
 * Convert m/s to mph
 */
export function msToMph(ms: number): number {
  return ms * 2.23694;
}

/**
 * Parse wind speed string from NWS (e.g., "15 to 20 mph")
 * Returns the maximum value
 */
export function parseWindSpeed(windSpeedStr: string): number {
  const numbers = windSpeedStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 0;
  
  // If range (e.g., "15 to 20"), return the max
  if (numbers.length > 1) {
    return parseInt(numbers[numbers.length - 1]);
  }
  
  return parseInt(numbers[0]);
}

/**
 * Calculate wind chill (Fahrenheit)
 */
export function calculateWindChill(tempF: number, windMph: number): number {
  // Wind chill only applies when temp <= 50°F and wind >= 3 mph
  if (tempF > 50 || windMph < 3) return tempF;
  
  return 35.74 + (0.6215 * tempF) - (35.75 * Math.pow(windMph, 0.16)) + 
         (0.4275 * tempF * Math.pow(windMph, 0.16));
}

/**
 * Format temperature for display
 */
export function formatTemp(temp: number): string {
  return `${Math.round(temp)}°F`;
}

/**
 * Format snow accumulation for display
 */
export function formatSnow(inches: number): string {
  if (inches < 0.1) return '0"';
  if (inches < 1) return `${inches.toFixed(1)}"`;
  return `${Math.round(inches)}"`;
}

/**
 * Format wind speed for display
 */
export function formatWind(mph: number): string {
  return `${Math.round(mph)} mph`;
}

/**
 * Format visibility for display
 */
export function formatVisibility(meters: number): string {
  const miles = meters * 0.000621371;
  if (miles >= 10) return '10+ mi';
  return `${miles.toFixed(1)} mi`;
}
