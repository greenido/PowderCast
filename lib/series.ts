/**
 * Window helpers over the normalized hourly series.
 *
 * Once a provider has been normalized the data is a regular hourly grid, so
 * these are simple index-range reductions — no interval proration needed. That
 * complexity lives in the NWS provider, where it belongs.
 *
 * Every window looks FORWARD from a reference time. Forecast APIs carry little
 * or no history, so backward windows read stale forecast, not observations.
 */

import type { HourlySeries } from '@/lib/types';

const HOUR_MS = 3_600_000;

/** Indices of hours falling within [from, from + hours). */
function windowIndices(times: number[], from: number, hours: number): number[] {
  const end = from + hours * HOUR_MS;
  const indices: number[] = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i] >= from && times[i] < end) indices.push(i);
  }
  return indices;
}

function collect(
  series: Array<number | null>,
  times: number[],
  from: number,
  hours: number
): number[] {
  const out: number[] = [];
  for (const i of windowIndices(times, from, hours)) {
    const v = series[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function sumOver(
  series: Array<number | null>,
  times: number[],
  from: number,
  hours: number
): number {
  return collect(series, times, from, hours).reduce((a, b) => a + b, 0);
}

export function maxOver(
  series: Array<number | null>,
  times: number[],
  from: number,
  hours: number
): number | null {
  const values = collect(series, times, from, hours);
  return values.length ? Math.max(...values) : null;
}

export function minOver(
  series: Array<number | null>,
  times: number[],
  from: number,
  hours: number
): number | null {
  const values = collect(series, times, from, hours);
  return values.length ? Math.min(...values) : null;
}

export function avgOver(
  series: Array<number | null>,
  times: number[],
  from: number,
  hours: number
): number | null {
  const values = collect(series, times, from, hours);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Value at the hour containing `at`, or the nearest hour if out of range. */
export function valueAt(
  series: Array<number | null>,
  times: number[],
  at: number
): number | null {
  if (!times.length) return null;

  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < times.length; i++) {
    const distance = Math.abs(times[i] - at);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) return null;
  const value = series[bestIndex];
  return value === undefined || !Number.isFinite(value as number) ? null : value;
}

/**
 * Snowfall-weighted mean temperature over a window.
 *
 * Snow quality depends on the temperature while snow is falling, not the
 * window average — a storm that drops 30cm overnight at -12°C followed by a
 * sunny +4°C afternoon is powder, not slush. Returns null when no snow falls.
 */
export function snowWeightedTempC(
  hourly: HourlySeries,
  from: number,
  hours: number
): number | null {
  let weighted = 0;
  let totalSnow = 0;

  for (const i of windowIndices(hourly.time, from, hours)) {
    const snow = hourly.snowfallMm[i];
    const temp = hourly.temperatureC[i];
    if (!snow || snow <= 0) continue;
    if (temp === null || temp === undefined || !Number.isFinite(temp)) continue;

    weighted += temp * snow;
    totalSnow += snow;
  }

  return totalSnow > 0 ? weighted / totalSnow : null;
}

/**
 * Split a window into local days, returning the index ranges for each.
 * Used by the multi-day planner to bucket by local calendar day.
 */
export function groupByLocalDay(
  times: number[],
  timezone: string | undefined,
  from: number,
  days: number
): Array<{ dayKey: string; indices: number[] }> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const end = from + days * 24 * HOUR_MS;
  const groups = new Map<string, number[]>();

  for (let i = 0; i < times.length; i++) {
    if (times[i] < from || times[i] >= end) continue;
    const dayKey = formatter.format(new Date(times[i]));
    const existing = groups.get(dayKey);
    if (existing) existing.push(i);
    else groups.set(dayKey, [i]);
  }

  return Array.from(groups, ([dayKey, indices]) => ({ dayKey, indices })).sort((a, b) =>
    a.dayKey.localeCompare(b.dayKey)
  );
}
