/**
 * Region-aware snow vocabulary.
 *
 * The original labels are US slang: "Sierra Cement" is a Tahoe joke, "Ice
 * Coast" is a New England one, and neither means anything to a rider in the
 * Dolomites. Alpine riders have their own precise vocabulary — Pulverschnee,
 * Sulz, Firn — and Japanese riders have theirs.
 *
 * The underlying classification is unchanged and physical (temperature during
 * snowfall); only the name and description are localized to the region.
 */

import type { SnowQuality } from '@/lib/snowLogic';
import type { RegionCode } from '@/lib/types';

export interface SnowLabel {
  label: string;
  description: string;
  emoji: string;
  color: string;
  /** Local-language term, shown as a subtitle where it differs. */
  localTerm?: string;
}

type Vocabulary = Record<SnowQuality, SnowLabel>;

const US: Vocabulary = {
  'Champagne Powder': {
    label: 'Champagne Powder',
    description: 'Ultra light and dry. Perfect face shots!',
    emoji: '❄️',
    color: 'text-cyan-400',
  },
  'Premium Packed': {
    label: 'Premium Packed',
    description: 'Classic powder conditions. Great all-mountain riding.',
    emoji: '🏂',
    color: 'text-blue-400',
  },
  'Sierra Cement': {
    label: 'Sierra Cement',
    description: 'Heavy and wet. Ideal for jumps and park features.',
    emoji: '💪',
    color: 'text-orange-400',
  },
  'Mashtatoes/Slush': {
    label: 'Mashed Potatoes',
    description: 'Spring conditions. Stay loose and have fun!',
    emoji: '☀️',
    color: 'text-yellow-400',
  },
  'Ice Coast': {
    label: 'Ice Coast',
    description: 'Variable and firm. Sharp edges recommended.',
    emoji: '🧊',
    color: 'text-gray-400',
  },
};

const ALPS: Vocabulary = {
  'Champagne Powder': {
    label: 'Deep Powder',
    localTerm: 'Pulverschnee',
    description: 'Cold, dry and bottomless. Off-piste day.',
    emoji: '❄️',
    color: 'text-cyan-400',
  },
  'Premium Packed': {
    label: 'Packed Powder',
    localTerm: 'Griffiger Schnee',
    description: 'Grippy and fast. Excellent piste conditions.',
    emoji: '🏂',
    color: 'text-blue-400',
  },
  'Sierra Cement': {
    label: 'Heavy Snow',
    localTerm: 'Pappschnee',
    description: 'Wet and dense. Tiring off-piste, fine on groomers.',
    emoji: '💪',
    color: 'text-orange-400',
  },
  'Mashtatoes/Slush': {
    label: 'Spring Slush',
    localTerm: 'Sulz',
    description: 'Softening fast. Ride the morning, stop by lunch.',
    emoji: '☀️',
    color: 'text-yellow-400',
  },
  'Ice Coast': {
    label: 'Hard Pack',
    localTerm: 'Harsch',
    description: 'Refrozen and firm. Sharp edges essential.',
    emoji: '🧊',
    color: 'text-gray-400',
  },
};

const JAPAN: Vocabulary = {
  'Champagne Powder': {
    label: 'JaPow',
    localTerm: '深雪 (miyuki)',
    description: 'The reason you flew here. Deep, dry, relentless.',
    emoji: '❄️',
    color: 'text-cyan-400',
  },
  'Premium Packed': {
    label: 'Packed Powder',
    description: 'Consistent and grippy. Great tree riding.',
    emoji: '🏂',
    color: 'text-blue-400',
  },
  'Sierra Cement': {
    label: 'Heavy Coastal Snow',
    localTerm: '重い雪 (omoi yuki)',
    description: 'Dense maritime snow. Great base builder.',
    emoji: '💪',
    color: 'text-orange-400',
  },
  'Mashtatoes/Slush': {
    label: 'Spring Slush',
    localTerm: '春雪 (haruyuki)',
    description: 'Warm and soft. Corn snow in the morning.',
    emoji: '☀️',
    color: 'text-yellow-400',
  },
  'Ice Coast': {
    label: 'Firm Pack',
    description: 'Refrozen. Uncommon here — check the upper mountain.',
    emoji: '🧊',
    color: 'text-gray-400',
  },
};

const VOCABULARIES: Partial<Record<RegionCode, Vocabulary>> = {
  'us-west': US,
  'us-rockies': US,
  'us-east': US,
  canada: US,
  alps: ALPS,
  dolomites: ALPS,
  pyrenees: ALPS,
  scandinavia: ALPS,
  japan: JAPAN,
};

export function snowLabel(quality: SnowQuality, region: RegionCode | undefined): SnowLabel {
  const vocabulary = (region && VOCABULARIES[region]) || US;
  return vocabulary[quality] ?? US[quality];
}

// ---------------------------------------------------------------------------

export interface FirnWindow {
  isFirn: boolean;
  /** Local hour the corn is expected to be at its best. */
  bestHour?: number;
  description: string;
}

/**
 * Detect a firn / spring-corn cycle.
 *
 * When overnight temperatures drop below freezing and the day climbs above it,
 * the surface refreezes and then thaws into corn — the best spring riding
 * there is, and it has a window of maybe two hours. Alpine riders plan whole
 * days around this and no US-centric snow classifier describes it.
 *
 * Takes hourly temperatures in °F over the next 24h, oldest first.
 */
export function detectFirnWindow(
  hourlyTempsF: Array<{ hour: number; temperature: number }>
): FirnWindow {
  if (hourlyTempsF.length < 12) {
    return { isFirn: false, description: '' };
  }

  const overnight = hourlyTempsF.filter((h) => h.hour >= 22 || h.hour <= 7);
  const daytime = hourlyTempsF.filter((h) => h.hour >= 9 && h.hour <= 16);

  if (overnight.length === 0 || daytime.length === 0) {
    return { isFirn: false, description: '' };
  }

  const coldestOvernight = Math.min(...overnight.map((h) => h.temperature));
  const warmestDay = Math.max(...daytime.map((h) => h.temperature));

  // Needs a genuine freeze overnight and a genuine thaw during the day.
  if (coldestOvernight > 30 || warmestDay < 36) {
    return { isFirn: false, description: '' };
  }

  // Corn arrives shortly after the surface crosses freezing — find that hour.
  const thawHour = daytime.find((h) => h.temperature >= 34)?.hour;

  return {
    isFirn: true,
    bestHour: thawHour,
    description: thawHour
      ? `Overnight freeze then thaw — corn snow expected from about ${formatHour(thawHour)}. Ride it before it turns to slush.`
      : 'Overnight freeze then thaw — classic spring corn cycle setting up.',
  };
}

function formatHour(hour: number): string {
  if (hour === 0) return 'midnight';
  if (hour === 12) return 'noon';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}
