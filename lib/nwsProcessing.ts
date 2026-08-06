/**
 * Pure processing helpers for NWS gridpoint data.
 *
 * Extracted from useNWSWeather so the math can be unit-tested without React.
 *
 * Two things about the NWS gridpoint API drive most of the design here:
 *
 * 1. It is a FORECAST series, not an observation series. The values run from
 *    roughly 12:00Z today out to ~7 days ahead. Any "look backward from now"
 *    window therefore reads stale forecast, not what actually happened, and
 *    shrinks to nothing right after 12:00Z each day. Everything looks forward.
 *
 * 2. Values are irregular ISO-8601 intervals, not hourly points.
 *    `snowfallAmount` typically arrives as PT6H blocks, `windGust`/`skyCover`
 *    as PT3H, `temperature` as PT1H. A block must be prorated across the hours
 *    it actually covers rather than attributed to its start hour.
 *
 * Units, as reported by the API's own `uom` fields:
 *    snowfallAmount  wmoUnit:mm      (NOT cm)
 *    temperature     wmoUnit:degC
 *    windSpeed/Gust  wmoUnit:km_h-1
 *    visibility      wmoUnit:m
 *    skyCover        wmoUnit:percent
 */

import type { NWSGridDataValue } from '@/lib/nwsTypes';
import { mmToInches, celsiusToFahrenheit, kmhToMph } from '@/lib/unitConversion';

export interface Interval {
  start: number;
  end: number;
  value: number;
}

const HOUR_MS = 3_600_000;

/**
 * Parse an ISO-8601 duration (the part after the "/" in a validTime).
 * Handles PT6H, PT30M, P1D, P1DT12H. Falls back to one hour.
 */
export function parseDurationMs(duration: string): number {
  const match = duration.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );
  if (!match) return HOUR_MS;

  const [, days, hours, minutes, seconds] = match;
  const ms =
    (parseFloat(days ?? '0') * 24 + parseFloat(hours ?? '0')) * HOUR_MS +
    parseFloat(minutes ?? '0') * 60_000 +
    parseFloat(seconds ?? '0') * 1_000;

  return ms > 0 ? ms : HOUR_MS;
}

/**
 * Turn NWS `{ validTime: "<iso>/<duration>", value }` entries into absolute
 * intervals, dropping nulls. Returns them sorted by start time.
 */
export function toIntervals(values: NWSGridDataValue[] | undefined): Interval[] {
  if (!values) return [];

  const intervals: Interval[] = [];
  for (const val of values) {
    if (val.value === null || val.value === undefined) continue;

    const [startStr, durationStr] = val.validTime.split('/');
    const start = new Date(startStr).getTime();
    if (Number.isNaN(start)) continue;

    intervals.push({
      start,
      end: start + parseDurationMs(durationStr ?? 'PT1H'),
      value: val.value,
    });
  }

  return intervals.sort((a, b) => a.start - b.start);
}

/** Milliseconds of overlap between an interval and [windowStart, windowEnd]. */
function overlapMs(interval: Interval, windowStart: number, windowEnd: number): number {
  return Math.max(0, Math.min(interval.end, windowEnd) - Math.max(interval.start, windowStart));
}

/**
 * Sum an accumulating quantity (snowfall, precipitation) over a forward window,
 * prorating each block by how much of it falls inside the window.
 *
 * A PT6H block holding 30mm that only overlaps the window by 2 hours
 * contributes 10mm, not 30mm.
 */
export function sumAccumulationForward(
  values: NWSGridDataValue[] | undefined,
  from: number,
  hours: number
): number {
  const windowEnd = from + hours * HOUR_MS;
  let total = 0;

  for (const interval of toIntervals(values)) {
    if (interval.end <= from) continue;
    if (interval.start >= windowEnd) break;

    const duration = interval.end - interval.start;
    if (duration <= 0) continue;

    total += interval.value * (overlapMs(interval, from, windowEnd) / duration);
  }

  return total;
}

/** Maximum value across all intervals overlapping a forward window. */
export function getMaxForward(
  values: NWSGridDataValue[] | undefined,
  from: number,
  hours: number
): number | null {
  const windowEnd = from + hours * HOUR_MS;
  let max: number | null = null;

  for (const interval of toIntervals(values)) {
    if (interval.end <= from) continue;
    if (interval.start >= windowEnd) break;
    max = max === null ? interval.value : Math.max(max, interval.value);
  }

  return max;
}

/** Duration-weighted mean across a forward window. */
export function getAverageForward(
  values: NWSGridDataValue[] | undefined,
  from: number,
  hours: number
): number | null {
  const windowEnd = from + hours * HOUR_MS;
  let weighted = 0;
  let totalWeight = 0;

  for (const interval of toIntervals(values)) {
    if (interval.end <= from) continue;
    if (interval.start >= windowEnd) break;

    const weight = overlapMs(interval, from, windowEnd);
    weighted += interval.value * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weighted / totalWeight : null;
}

/** Min and max across a forward window. */
export function getRangeForward(
  values: NWSGridDataValue[] | undefined,
  from: number,
  hours: number
): { min: number; max: number } | null {
  const windowEnd = from + hours * HOUR_MS;
  let min = Infinity;
  let max = -Infinity;

  for (const interval of toIntervals(values)) {
    if (interval.end <= from) continue;
    if (interval.start >= windowEnd) break;
    min = Math.min(min, interval.value);
    max = Math.max(max, interval.value);
  }

  return max === -Infinity ? null : { min, max };
}

/**
 * Value of the interval containing `at`.
 *
 * The series starts around 12:00Z, so reading `values[0]` for "current
 * conditions" returns data that can be many hours stale depending on the time
 * of day. Falls back to the nearest interval when nothing contains `at`.
 */
export function getValueAt(
  values: NWSGridDataValue[] | undefined,
  at: number
): number | null {
  const intervals = toIntervals(values);
  if (intervals.length === 0) return null;

  for (const interval of intervals) {
    if (at >= interval.start && at < interval.end) return interval.value;
  }

  // Nothing covers `at` — snap to whichever interval is closest in time.
  let closest = intervals[0];
  let bestDistance = Infinity;
  for (const interval of intervals) {
    const distance =
      at < interval.start ? interval.start - at : at - interval.end;
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = interval;
    }
  }

  return closest.value;
}

/**
 * Mean temperature (°C) during the hours snow is actually forecast to fall,
 * weighted by how much snow falls in each block.
 *
 * This is what snow-quality classification actually wants. Averaging the whole
 * 24h window blends in dry, sunny hours and drags the answer toward the daily
 * mean; averaging *backward* over a forecast-only series is meaningless.
 * Returns null when no snow is forecast.
 */
export function getSnowWeightedTempC(
  snowValues: NWSGridDataValue[] | undefined,
  tempValues: NWSGridDataValue[] | undefined,
  from: number,
  hours: number
): number | null {
  const windowEnd = from + hours * HOUR_MS;
  let weightedTemp = 0;
  let totalSnow = 0;

  for (const snow of toIntervals(snowValues)) {
    if (snow.end <= from) continue;
    if (snow.start >= windowEnd) break;
    if (snow.value <= 0) continue;

    const duration = snow.end - snow.start;
    if (duration <= 0) continue;

    const snowInWindow = snow.value * (overlapMs(snow, from, windowEnd) / duration);
    if (snowInWindow <= 0) continue;

    const tempDuringSnow = getAverageForward(
      tempValues,
      Math.max(snow.start, from),
      (Math.min(snow.end, windowEnd) - Math.max(snow.start, from)) / HOUR_MS
    );
    if (tempDuringSnow === null) continue;

    weightedTemp += tempDuringSnow * snowInWindow;
    totalSnow += snowInWindow;
  }

  return totalSnow > 0 ? weightedTemp / totalSnow : null;
}

export interface HourlyBucket {
  time: string;
  hour: number;
  snowfallIn: number;
  temperatureF: number;
  windSpeedMph: number;
}

/**
 * Bucket the forecast into hourly slots for the snow chart.
 *
 * Snowfall blocks are prorated across the hours they span, so a PT6H block of
 * 30mm shows as ~0.2" in each of six hours rather than 1.2" in one hour
 * followed by five empty ones.
 */
export function buildHourlyBuckets(
  snowValues: NWSGridDataValue[] | undefined,
  tempValues: NWSGridDataValue[] | undefined,
  windValues: NWSGridDataValue[] | undefined,
  from: number,
  hours: number
): HourlyBucket[] {
  // Align to the top of the hour so buckets line up with wall-clock hours.
  const startHour = Math.floor(from / HOUR_MS) * HOUR_MS;
  const buckets: HourlyBucket[] = [];

  for (let i = 0; i < hours; i++) {
    const hourStart = startHour + i * HOUR_MS;

    const snowMm = sumAccumulationForward(snowValues, hourStart, 1);
    const tempC = getAverageForward(tempValues, hourStart, 1);
    const windKmh = getAverageForward(windValues, hourStart, 1);

    buckets.push({
      time: new Date(hourStart).toISOString(),
      hour: new Date(hourStart).getHours(),
      snowfallIn: parseFloat(mmToInches(snowMm).toFixed(2)),
      temperatureF: tempC === null ? 32 : Math.round(celsiusToFahrenheit(tempC)),
      windSpeedMph: windKmh === null ? 0 : Math.round(kmhToMph(windKmh)),
    });
  }

  return buckets;
}
