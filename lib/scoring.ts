/**
 * Single source of truth for condition scoring.
 *
 * There used to be two independent implementations — lib/rideScore.ts for the
 * comparison view and scoreDay() in lib/planner.ts for the planner — written
 * at different times with different weights, thresholds and labels. The same
 * mountain on the same day scored 55 "Fair Groomers" in one view and 43
 * "Marginal" in the other, which is the kind of thing that quietly destroys
 * trust in every other number on the page.
 *
 * Both now call scoreConditions(). The only difference between the views is
 * the window the inputs are measured over: instantaneous for "right now",
 * daily aggregates for the planner.
 */

import type { SnowQuality } from '@/lib/snowLogic';

export interface ScoreInputs {
  /** New snow over the window, in inches. */
  snowIn: number;
  snowQuality: SnowQuality;
  /** Peak gust over the window, mph. */
  maxGustMph: number;
  /** Sustained wind, mph. Optional; refines the wind score. */
  windMph?: number;
  /** Mean cloud cover over the window, 0-100. */
  cloudPct: number;
  /** Representative temperature, °F. Daily max for a day, current for now. */
  tempF: number;
  /**
   * Visibility in metres. Only meaningful instantaneously — the planner has no
   * equivalent, and omitting it must not silently cost points.
   */
  visibilityM?: number | null;
}

export interface ScoreBreakdown {
  score: number;
  snow: number;
  quality: number;
  wind: number;
  visibility: number;
  temperature: number;
}

// Component ceilings. They sum to 100.
const MAX_SNOW = 40;
const MAX_QUALITY = 20;
const MAX_WIND = 22;
const MAX_SKY = 10;
const MAX_TEMP = 8;

/**
 * New snow dominates: it is what people actually plan around.
 *
 * The figure is rounded to the tenth of an inch we display before it is banded.
 * Summing 24 hourly values lands on 11.999999999999996 rather than 12, and
 * without this the card would read 12" while the score quietly used the 8-12"
 * band. Scoring the number the rider can actually see is the only defensible
 * rule for a step function.
 */
function scoreSnow(rawSnowIn: number): number {
  const snowIn = Math.round(rawSnowIn * 10) / 10;
  if (snowIn >= 12) return MAX_SNOW;
  if (snowIn >= 8) return 36;
  if (snowIn >= 6) return 32; // Powder-alert threshold.
  if (snowIn >= 4) return 28;
  if (snowIn >= 2) return 20;
  if (snowIn >= 1) return 14;
  if (snowIn >= 0.5) return 9;
  if (snowIn > 0) return 5;
  return 0;
}

/**
 * With fresh snow this rates the storm; without it, the existing surface —
 * so it carries less weight, because a dry day is judged on its groomers.
 */
function scoreQuality(quality: SnowQuality, hasNewSnow: boolean): number {
  const withSnow: Record<SnowQuality, number> = {
    'Champagne Powder': MAX_QUALITY,
    'Premium Packed': 16,
    'Sierra Cement': 8,
    'Mashtatoes/Slush': 4,
    'Ice Coast': 0,
  };
  const surface: Record<SnowQuality, number> = {
    'Champagne Powder': 12,
    'Premium Packed': 10,
    'Sierra Cement': 5,
    'Mashtatoes/Slush': 3,
    'Ice Coast': 0,
  };

  const table = hasNewSnow ? withSnow : surface;
  return table[quality] ?? (hasNewSnow ? 10 : 8);
}

/**
 * Wind can veto a day outright. Above ~40mph exposed lifts go on hold, and
 * it does not matter how much it snowed if you cannot get up the hill.
 */
function scoreWind(maxGustMph: number, windMph?: number): number {
  let points: number;
  if (maxGustMph >= 55) points = 0;
  else if (maxGustMph >= 45) points = 4;
  else if (maxGustMph >= 40) points = 7; // Wind-hold threshold.
  else if (maxGustMph >= 35) points = 11;
  else if (maxGustMph >= 25) points = 16;
  else if (maxGustMph >= 20) points = 19;
  else points = MAX_WIND;

  // Sustained wind is unpleasant even without gusts closing lifts.
  if (windMph !== undefined && windMph > 15) {
    points -= Math.min(5, (windMph - 15) * 0.3);
  }

  return Math.max(0, Math.round(points));
}

/** Flat light and fog matter, but never as much as snow or wind. */
function scoreSky(cloudPct: number, visibilityM?: number | null): number {
  let points: number;
  if (cloudPct < 25) points = MAX_SKY;
  else if (cloudPct < 50) points = 8;
  else if (cloudPct < 75) points = 6;
  else points = 4;

  // Only deduct when visibility is actually known.
  if (visibilityM !== undefined && visibilityM !== null) {
    if (visibilityM < 1000) points -= 4;
    else if (visibilityM < 5000) points -= 2;
  }

  return Math.max(0, points);
}

/** Comfort, not survivability — frostbite risk is surfaced separately. */
function scoreTemp(tempF: number): number {
  if (tempF >= 15 && tempF <= 32) return MAX_TEMP;
  if (tempF >= 5 && tempF <= 38) return 6;
  if (tempF > 38 && tempF <= 45) return 3;
  if (tempF >= -5 && tempF < 5) return 3;
  return 0;
}

export function scoreConditions(inputs: ScoreInputs): ScoreBreakdown {
  const hasNewSnow = Math.round(inputs.snowIn * 10) / 10 >= 0.5;

  const snow = scoreSnow(inputs.snowIn);
  const quality = scoreQuality(inputs.snowQuality, hasNewSnow);
  const wind = scoreWind(inputs.maxGustMph, inputs.windMph);
  const visibility = scoreSky(inputs.cloudPct, inputs.visibilityM);
  const temperature = scoreTemp(inputs.tempF);

  return {
    score: Math.max(0, Math.min(100, snow + quality + wind + visibility + temperature)),
    snow,
    quality,
    wind,
    visibility,
    temperature,
  };
}

// ---------------------------------------------------------------------------
// Labels — shared so a score reads the same wherever it appears.

export interface ScoreLabel {
  /** Full label with emoji, for cards. */
  label: string;
  /** One word, for dense grids and legends. */
  short: string;
  /** One line explaining the score, rather than a hardcoded platitude. */
  summary: string;
  color: string;
  bgColor: string;
  borderColor: string;
  /** The band colour as a hex value, for canvas and map markers outside Tailwind. */
  hex: string;
}

const BANDS: Array<{ min: number; label: ScoreLabel }> = [
  {
    min: 80,
    label: {
      label: 'Epic Conditions 💎',
      short: 'Epic',
      summary: 'Drop everything and go.',
      color: 'text-cyan-300',
      bgColor: 'bg-cyan-500/15',
      borderColor: 'border-cyan-400/30',
      hex: '#67e8f9',
    },
  },
  {
    min: 65,
    label: {
      label: 'Great 🏂',
      short: 'Great',
      summary: 'A genuinely good day on the hill.',
      color: 'text-emerald-300',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-400/30',
      hex: '#6ee7b7',
    },
  },
  {
    min: 45,
    label: {
      label: 'Fair Groomers 🏔️',
      short: 'Fair',
      summary: 'Solid groomer riding, nothing special off-piste.',
      color: 'text-yellow-300',
      bgColor: 'bg-yellow-500/15',
      borderColor: 'border-yellow-400/30',
      hex: '#fde047',
    },
  },
  {
    min: 30,
    label: {
      label: 'Marginal ⚠️',
      short: 'Marginal',
      summary: 'Rideable, but wind, warmth or firm snow will be noticeable.',
      color: 'text-orange-300',
      bgColor: 'bg-orange-500/15',
      borderColor: 'border-orange-400/30',
      hex: '#fdba74',
    },
  },
  {
    min: 0,
    label: {
      label: 'Poor 🧊',
      short: 'Poor',
      summary: 'Hard pack, high wind or no snow. Consider another day.',
      color: 'text-gray-400',
      bgColor: 'bg-white/5',
      borderColor: 'border-white/10',
      hex: '#9ca3af',
    },
  },
];

export function scoreLabel(score: number): ScoreLabel {
  return (BANDS.find((band) => score >= band.min) ?? BANDS[BANDS.length - 1]).label;
}
