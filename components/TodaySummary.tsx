'use client';

import type { ProcessedWeatherData } from '@/lib/nwsTypes';
import type { Resort } from '@/lib/types';
import { calculateRideScore, getRideScoreLabel } from '@/lib/rideScore';
import { snowLabel } from '@/lib/snowVocabulary';
import { useUnits } from '@/hooks/useUnits';
import { formatElevation, formatSnow, formatTemp, formatWind } from '@/lib/units';

interface TodaySummaryProps {
  weather: ProcessedWeatherData;
  resort: Resort;
  elevation: 'base' | 'summit';
}

interface Tile {
  label: string;
  value: string;
  detail: string;
  /** Tailwind text colour for the value when it needs attention. */
  tone?: string;
}

/**
 * The answer first: is today worth it, and why.
 *
 * On a phone the first number used to sit a screen and a half down, behind
 * a dozen cards that each answer one narrow question. This is the same Ride
 * Score the comparison view ranks by, plus the four inputs a rider checks
 * before committing — so the rest of the page is detail, not the headline.
 */
export default function TodaySummary({ weather, resort, elevation }: TodaySummaryProps) {
  const { units } = useUnits();
  const { score } = calculateRideScore(weather);
  const band = getRideScoreLabel(score);
  const quality = snowLabel(weather.snowQuality, resort.regionCode);

  const elevationFt = elevation === 'base' ? resort.base_elevation : resort.summit_elevation;
  const feelsLikeDiffers = Math.abs(weather.windChill - weather.currentTemp) >= 3;

  const tiles: Tile[] = [
    {
      label: 'New snow 24h',
      value: formatSnow(weather.snow24h, units),
      // What already fell outranks the 7-day total here: it is the one number
      // on this tile that has actually happened, and it is still on the hill.
      detail:
        weather.observedSnow48h !== null && weather.observedSnow48h >= 1
          ? `${formatSnow(weather.observedSnow48h, units)} fell in the last 48h`
          : `${formatSnow(weather.snow7day, units)} over 7 days`,
      tone: weather.powderAlert ? 'text-cyan-300' : undefined,
    },
    {
      label: 'Temperature',
      value: formatTemp(weather.currentTemp, units),
      detail: feelsLikeDiffers
        ? `Feels like ${formatTemp(weather.windChill, units)}`
        : `${formatTemp(weather.minTemp24h, units)} to ${formatTemp(weather.maxTemp24h, units)}`,
      tone: weather.frostbiteRisk ? 'text-sky-300' : undefined,
    },
    {
      label: 'Gusts',
      value: formatWind(weather.currentWindGust, units),
      detail: weather.windHoldRisk
        ? 'Lift hold risk'
        : `Up to ${formatWind(weather.maxWindGust24h, units)} today`,
      tone: weather.windHoldRisk ? 'text-orange-300' : undefined,
    },
    snowLineTile(weather, resort, units),
  ];

  return (
    <section
      className={`glass-card border ${band.borderColor}`}
      aria-label={`Today at ${resort.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="metric-label">
            Today · {elevation === 'base' ? 'Base' : 'Summit'} {formatElevation(elevationFt, units)}
          </h3>
          <div className="mt-2 flex items-baseline gap-3">
            <span className={`text-5xl font-bold tabular-nums tracking-tight ${band.color}`}>
              {score}
            </span>
            <span className="text-lg font-bold text-white sm:text-xl">{band.label}</span>
          </div>
          <p className="mt-1 text-sm text-gray-400">{band.summary}</p>
        </div>

        <div
          className="max-w-[45%] shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-right text-xs font-semibold"
          title={quality.description}
        >
          <div className="text-lg leading-none">{quality.emoji}</div>
          <div className={`mt-1 ${quality.color}`}>{quality.label}</div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {tile.label}
            </dt>
            <dd className={`mt-0.5 text-xl font-bold tabular-nums ${tile.tone ?? 'text-white'}`}>
              {tile.value}
            </dd>
            <dd className="text-xs text-gray-400">{tile.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Snow line where the provider supplies a freezing level (Open-Meteo), sky
 * otherwise (NWS) — the NWS gridpoints carry no freezing level.
 */
function snowLineTile(
  weather: ProcessedWeatherData,
  resort: Resort,
  units: 'metric' | 'imperial'
): Tile {
  const level = weather.freezingLevelFt;

  if (level === null) {
    return {
      label: 'Sky',
      value: weather.bluebirdDay ? 'Bluebird' : `${Math.round(weather.currentSkyCover)}%`,
      detail: weather.bluebirdDay ? 'Clear and calm' : 'Cloud cover',
      tone: weather.bluebirdDay ? 'text-yellow-300' : undefined,
    };
  }

  if (level <= resort.base_elevation) {
    return {
      label: 'Snow line',
      value: formatElevation(level, units),
      detail: 'Snow to the base',
      tone: 'text-cyan-300',
    };
  }

  if (level >= resort.summit_elevation) {
    return {
      label: 'Snow line',
      value: formatElevation(level, units),
      detail: 'Above the summit',
      tone: 'text-red-300',
    };
  }

  return {
    label: 'Snow line',
    value: formatElevation(level, units),
    detail: 'Rain below this',
    tone: 'text-yellow-300',
  };
}
