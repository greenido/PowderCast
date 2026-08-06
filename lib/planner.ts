/**
 * Multi-day, multi-resort planning.
 *
 * Answers the question riders actually have — "where should I go this
 * weekend?" — by scoring every resort on every day of the forecast window and
 * ranking the whole grid.
 */

import type { NormalizedForecast, Resort } from '@/lib/types';
import { groupByLocalDay } from '@/lib/series';
import { mmToInches, celsiusToFahrenheit, kmhToMph } from '@/lib/unitConversion';
import { determineSnowQuality } from '@/lib/snowLogic';
import type { SnowQuality } from '@/lib/snowLogic';

export interface DayOutlook {
  /** Local calendar day, YYYY-MM-DD. */
  dayKey: string;
  /** Midday-ish timestamp, for formatting a weekday name. */
  timestamp: number;
  snowfallIn: number;
  maxTempF: number;
  minTempF: number;
  maxGustMph: number;
  avgCloudPct: number;
  snowQuality: SnowQuality;
  /** 0-100, same spirit as Ride Score but computed per day. */
  score: number;
}

export interface ResortOutlook {
  resort: Resort;
  days: DayOutlook[];
  /** Highest-scoring day in the window. */
  best: DayOutlook | null;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * Score a single day.
 *
 * Deliberately close to lib/rideScore.ts in spirit but daily rather than
 * instantaneous: new snow dominates, wind can veto, and temperature and sky
 * adjust at the margin.
 */
function scoreDay(day: Omit<DayOutlook, 'score'>): number {
  // New snow — up to 45. This is what people plan trips around.
  let snow = 0;
  if (day.snowfallIn >= 12) snow = 45;
  else if (day.snowfallIn >= 8) snow = 40;
  else if (day.snowfallIn >= 4) snow = 32;
  else if (day.snowfallIn >= 2) snow = 22;
  else if (day.snowfallIn >= 0.5) snow = 12;

  // Quality of that snow — up to 20.
  const qualityPoints: Record<SnowQuality, number> = {
    'Champagne Powder': 20,
    'Premium Packed': 16,
    'Sierra Cement': 8,
    'Mashtatoes/Slush': 4,
    'Ice Coast': 0,
  };
  const quality = day.snowfallIn > 0.5 ? qualityPoints[day.snowQuality] : 8;

  // Wind — up to 20, and a strong veto. A 60mph day closes the good lifts
  // regardless of how much it snowed.
  let wind = 20;
  if (day.maxGustMph >= 55) wind = 0;
  else if (day.maxGustMph >= 45) wind = 4;
  else if (day.maxGustMph >= 35) wind = 10;
  else if (day.maxGustMph >= 25) wind = 15;

  // Sky — up to 8. Bluebird is lovely but not why you book a trip.
  const sky = day.avgCloudPct < 25 ? 8 : day.avgCloudPct < 60 ? 5 : 2;

  // Temperature comfort — up to 7.
  const temp = day.maxTempF;
  const tempPoints =
    temp >= 15 && temp <= 32 ? 7 : temp >= 5 && temp <= 38 ? 5 : temp > 38 ? 2 : 1;

  return Math.round(Math.min(100, snow + quality + wind + sky + tempPoints));
}

export function buildOutlook(
  resort: Resort,
  forecast: NormalizedForecast,
  now: number = Date.now(),
  days = 7
): ResortOutlook {
  const h = forecast.hourly;
  const groups = groupByLocalDay(h.time, resort.timezone, now, days);

  const outlookDays: DayOutlook[] = groups.map((group) => {
    const pick = (series: Array<number | null>) =>
      group.indices
        .map((i) => series[i])
        .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));

    const snowMm = pick(h.snowfallMm);
    const temps = pick(h.temperatureC);
    const gusts = pick(h.windGustKmh);
    const clouds = pick(h.cloudCoverPct);

    const snowfallIn = mmToInches(snowMm.reduce((a, b) => a + b, 0));

    // Snowfall-weighted temperature, same reasoning as the live conditions:
    // classify by the temperature while it is actually snowing.
    let weighted = 0;
    let totalSnow = 0;
    for (const i of group.indices) {
      const s = h.snowfallMm[i];
      const t = h.temperatureC[i];
      if (s && s > 0 && t !== null && t !== undefined) {
        weighted += t * s;
        totalSnow += s;
      }
    }
    const classifyTempC = totalSnow > 0 ? weighted / totalSnow : mean(temps);

    const base = {
      dayKey: group.dayKey,
      timestamp: h.time[group.indices[Math.floor(group.indices.length / 2)]],
      snowfallIn,
      maxTempF: temps.length ? celsiusToFahrenheit(Math.max(...temps)) : 32,
      minTempF: temps.length ? celsiusToFahrenheit(Math.min(...temps)) : 32,
      maxGustMph: gusts.length ? kmhToMph(Math.max(...gusts)) : 0,
      avgCloudPct: mean(clouds),
      snowQuality: determineSnowQuality(celsiusToFahrenheit(classifyTempC)),
    };

    return { ...base, score: scoreDay(base) };
  });

  // A 7*24h window from "now" straddles 8 local calendar days (a partial today
  // and a partial final day). Keep the first `days` so the grid matches its
  // label and the trailing stub — often only an hour or two — is dropped.
  const windowDays = outlookDays.slice(0, days);

  const best = windowDays.reduce<DayOutlook | null>(
    (bestSoFar, day) => (!bestSoFar || day.score > bestSoFar.score ? day : bestSoFar),
    null
  );

  return { resort, days: windowDays, best };
}

/** Rank resorts by their best day, then by total snow in the window. */
export function rankOutlooks(outlooks: ResortOutlook[]): ResortOutlook[] {
  return [...outlooks].sort((a, b) => {
    const scoreDiff = (b.best?.score ?? 0) - (a.best?.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;

    const snowA = a.days.reduce((sum, d) => sum + d.snowfallIn, 0);
    const snowB = b.days.reduce((sum, d) => sum + d.snowfallIn, 0);
    return snowB - snowA;
  });
}

export function scoreTone(score: number): { bg: string; text: string; label: string } {
  if (score >= 80) return { bg: 'bg-cyan-500/25', text: 'text-cyan-200', label: 'Epic' };
  if (score >= 65) return { bg: 'bg-emerald-500/20', text: 'text-emerald-200', label: 'Great' };
  if (score >= 45) return { bg: 'bg-yellow-500/15', text: 'text-yellow-200', label: 'Fair' };
  if (score >= 30) return { bg: 'bg-orange-500/15', text: 'text-orange-200', label: 'Marginal' };
  return { bg: 'bg-white/5', text: 'text-gray-400', label: 'Poor' };
}
