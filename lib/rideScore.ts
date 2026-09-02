/**
 * Instantaneous "right now" score for a resort.
 *
 * A thin adapter over lib/scoring.ts — the scoring itself is shared with the
 * planner so the two views cannot disagree about the same day.
 */

import type { ProcessedWeatherData } from '@/lib/nwsTypes';
import { scoreConditions, scoreLabel, type ScoreBreakdown, type ScoreLabel } from '@/lib/scoring';

export type { ScoreBreakdown as RideScoreBreakdown } from '@/lib/scoring';

export function calculateRideScore(weather: ProcessedWeatherData): ScoreBreakdown {
  return scoreConditions({
    snowIn: weather.snow24h,
    snowQuality: weather.snowQuality,
    maxGustMph: weather.maxWindGust24h,
    windMph: weather.currentWindSpeed,
    cloudPct: weather.currentSkyCover,
    tempF: weather.currentTemp,
    visibilityM: weather.currentVisibility,
  });
}

export function getRideScoreLabel(score: number): ScoreLabel {
  return scoreLabel(score);
}
