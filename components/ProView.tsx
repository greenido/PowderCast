'use client';

import { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloudIcon,
  SunIcon,
  BeakerIcon,
  EyeIcon,
  MapIcon,
} from '@heroicons/react/24/solid';
import type { NormalizedForecast } from '@/lib/types';
import { sumOver, maxOver, minOver, avgOver, valueAt } from '@/lib/series';
import { useUnits } from '@/hooks/useUnits';
import {
  formatSnow,
  formatTemp,
  formatWind,
  formatElevation,
  formatVisibility,
  formatDepth,
} from '@/lib/units';
import { mmToInches, celsiusToFahrenheit, kmhToMph, metersToFeet } from '@/lib/unitConversion';
import { degreesToCompass } from '@/lib/resortGeo';

interface ProViewProps {
  forecast: NormalizedForecast | null;
}

interface Field {
  label: string;
  value: string;
}

interface Section {
  title: string;
  icon: React.ReactNode;
  color: string;
  fields: Field[];
}

const NA = '—';

/**
 * Raw forecast inspector.
 *
 * Reads the normalized SI series rather than a provider's own payload. The
 * previous version fetched the NWS gridpoint URL and parsed `properties.*`
 * directly, which threw for every resort served by Open-Meteo — 529 of 722,
 * i.e. all of the Alps, Dolomites, Pyrenees and Japan.
 *
 * Working from the normalized model means one code path for every provider,
 * no second network request, and unit handling shared with the rest of the app.
 */
export default function ProView({ forecast }: ProViewProps) {
  const { units } = useUnits();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['❄️ Snow & Precipitation']));
  const [showHourly, setShowHourly] = useState(false);

  if (!forecast) {
    return (
      <div className="glass-card py-10 text-center">
        <BeakerIcon className="mx-auto mb-3 h-10 w-10 text-gray-500" />
        <p className="text-sm text-gray-400">
          Raw forecast data isn&apos;t loaded yet. Refresh the conditions to fetch it.
        </p>
      </div>
    );
  }

  const h = forecast.hourly;
  const t = h.time;
  const now = Date.now();

  const toggle = (title: string) => {
    const next = new Set(expanded);
    if (next.has(title)) next.delete(title);
    else next.add(title);
    setExpanded(next);
  };

  // --- helpers that keep "no data" distinct from "zero" ---------------------
  const temp = (c: number | null) => (c === null ? NA : formatTemp(celsiusToFahrenheit(c), units));
  const wind = (kmh: number | null) => (kmh === null ? NA : formatWind(kmhToMph(kmh), units));
  const height = (m: number | null) => (m === null ? NA : formatElevation(metersToFeet(m), units));
  const pct = (v: number | null) => (v === null ? NA : `${Math.round(v)}%`);
  const snow = (mm: number) => formatSnow(mmToInches(mm), units);

  const sections: Section[] = [
    {
      title: '❄️ Snow & Precipitation',
      icon: <CloudIcon className="h-5 w-5" />,
      color: 'cyan',
      fields: [
        { label: 'Next 24h snow', value: snow(sumOver(h.snowfallMm, t, now, 24)) },
        { label: 'Next 48h snow', value: snow(sumOver(h.snowfallMm, t, now, 48)) },
        { label: 'Next 7-day snow', value: snow(sumOver(h.snowfallMm, t, now, 168)) },
        {
          label: 'Peak hourly rate',
          value: snow(maxOver(h.snowfallMm, t, now, 168) ?? 0) + '/h',
        },
        {
          label: 'Hours with snow (7d)',
          value: String(
            h.snowfallMm.filter((v, i) => t[i] >= now && (v ?? 0) > 0).length
          ),
        },
        {
          label: 'Snow depth on ground',
          value:
            valueAt(h.snowDepthCm, t, now) === null
              ? `${NA} (not published by ${forecast.source})`
              : formatDepth(valueAt(h.snowDepthCm, t, now)! / 2.54, units),
        },
        { label: 'Current precip probability', value: pct(valueAt(h.precipProbPct, t, now)) },
        { label: 'Max precip probability (24h)', value: pct(maxOver(h.precipProbPct, t, now, 24)) },
      ],
    },
    {
      title: '🌡️ Temperature',
      icon: <SunIcon className="h-5 w-5" />,
      color: 'orange',
      fields: [
        { label: 'Current', value: temp(valueAt(h.temperatureC, t, now)) },
        { label: 'Dewpoint', value: temp(valueAt(h.dewpointC, t, now)) },
        { label: 'Max (24h)', value: temp(maxOver(h.temperatureC, t, now, 24)) },
        { label: 'Min (24h)', value: temp(minOver(h.temperatureC, t, now, 24)) },
        { label: 'Mean (24h)', value: temp(avgOver(h.temperatureC, t, now, 24)) },
        { label: 'Max (7d)', value: temp(maxOver(h.temperatureC, t, now, 168)) },
        { label: 'Min (7d)', value: temp(minOver(h.temperatureC, t, now, 168)) },
        { label: 'Relative humidity', value: pct(valueAt(h.humidityPct, t, now)) },
      ],
    },
    {
      title: '💨 Wind',
      icon: <MapIcon className="h-5 w-5" />,
      color: 'blue',
      fields: [
        { label: 'Current speed', value: wind(valueAt(h.windSpeedKmh, t, now)) },
        { label: 'Current gusts', value: wind(valueAt(h.windGustKmh, t, now)) },
        {
          label: 'Direction',
          value:
            valueAt(h.windDirectionDeg, t, now) === null
              ? NA
              : `${degreesToCompass(valueAt(h.windDirectionDeg, t, now)!)} (${Math.round(
                  valueAt(h.windDirectionDeg, t, now)!
                )}°)`,
        },
        { label: 'Mean speed (24h)', value: wind(avgOver(h.windSpeedKmh, t, now, 24)) },
        { label: 'Max speed (24h)', value: wind(maxOver(h.windSpeedKmh, t, now, 24)) },
        { label: 'Max gust (24h)', value: wind(maxOver(h.windGustKmh, t, now, 24)) },
        { label: 'Max gust (7d)', value: wind(maxOver(h.windGustKmh, t, now, 168)) },
      ],
    },
    {
      title: '👁️ Visibility & Sky',
      icon: <EyeIcon className="h-5 w-5" />,
      color: 'purple',
      fields: [
        {
          label: 'Current visibility',
          value:
            valueAt(h.visibilityM, t, now) === null
              ? NA
              : formatVisibility(valueAt(h.visibilityM, t, now)!, units),
        },
        {
          label: 'Min visibility (24h)',
          value:
            minOver(h.visibilityM, t, now, 24) === null
              ? NA
              : formatVisibility(minOver(h.visibilityM, t, now, 24)!, units),
        },
        { label: 'Current cloud cover', value: pct(valueAt(h.cloudCoverPct, t, now)) },
        { label: 'Mean cloud cover (24h)', value: pct(avgOver(h.cloudCoverPct, t, now, 24)) },
        {
          label: 'Sky condition',
          value: describeSky(valueAt(h.cloudCoverPct, t, now)),
        },
        { label: 'Freezing level', value: height(valueAt(h.freezingLevelM, t, now)) },
        { label: 'Min freezing level (24h)', value: height(minOver(h.freezingLevelM, t, now, 24)) },
        { label: 'Max freezing level (24h)', value: height(maxOver(h.freezingLevelM, t, now, 24)) },
      ],
    },
    {
      title: '📡 Source',
      icon: <BeakerIcon className="h-5 w-5" />,
      color: 'gray',
      fields: [
        { label: 'Provider', value: forecast.source },
        { label: 'Model', value: forecast.model ?? NA },
        { label: 'Forecast elevation', value: height(forecast.elevationM) },
        { label: 'Hourly points', value: String(t.length) },
        {
          label: 'Series start',
          value: t.length ? new Date(t[0]).toLocaleString() : NA,
        },
        {
          label: 'Series end',
          value: t.length ? new Date(t[t.length - 1]).toLocaleString() : NA,
        },
        { label: 'Fetched', value: new Date(forecast.fetchedAt).toLocaleString() },
        { label: 'Attribution', value: forecast.attribution },
      ],
    },
  ];

  const futureIndices = t.map((_, i) => i).filter((i) => t[i] >= now - 3_600_000);

  return (
    <div className="space-y-4">
      <div className="glass-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">🔬 Pro View</h2>
            <p className="mt-1 text-sm text-gray-400">
              Every value in the normalized forecast, straight from{' '}
              <span className="text-cyan-400">{forecast.model ?? forecast.source}</span>.
            </p>
          </div>
          <button
            onClick={() => setShowHourly(!showHourly)}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            {showHourly ? 'Hide hourly table' : 'Show hourly table'}
          </button>
        </div>
      </div>

      {sections.map((section) => {
        const isOpen = expanded.has(section.title);
        return (
          <div key={section.title} className="glass-card p-0">
            <button
              onClick={() => toggle(section.title)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
            >
              <span className="flex items-center gap-3 font-semibold text-white">
                <span className={`text-${section.color}-400`}>{section.icon}</span>
                {section.title}
              </span>
              {isOpen ? (
                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {isOpen && (
              <div className="grid grid-cols-1 gap-px border-t border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
                {section.fields.map((field) => (
                  <div key={field.label} className="bg-slate-900/60 px-5 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">
                      {field.label}
                    </div>
                    <div className="mt-0.5 break-words text-sm font-semibold text-white">
                      {field.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showHourly && (
        <div className="glass-card overflow-x-auto p-0">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-3 py-3 text-right">Temp</th>
                <th className="px-3 py-3 text-right">Snow</th>
                <th className="px-3 py-3 text-right">Wind</th>
                <th className="px-3 py-3 text-right">Gust</th>
                <th className="px-3 py-3 text-right">Dir</th>
                <th className="px-3 py-3 text-right">Cloud</th>
                <th className="px-3 py-3 text-right">Freezing</th>
              </tr>
            </thead>
            <tbody>
              {futureIndices.slice(0, 72).map((i) => (
                <tr key={t[i]} className="border-b border-white/5 last:border-b-0">
                  <td className="px-4 py-2 text-gray-300">
                    {new Date(t[i]).toLocaleString(undefined, {
                      weekday: 'short',
                      hour: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white">
                    {temp(h.temperatureC[i] ?? null)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      (h.snowfallMm[i] ?? 0) > 0 ? 'font-semibold text-cyan-300' : 'text-gray-500'
                    }`}
                  >
                    {snow(h.snowfallMm[i] ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-300">
                    {wind(h.windSpeedKmh[i] ?? null)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      kmhToMph(h.windGustKmh[i] ?? 0) >= 40
                        ? 'font-semibold text-orange-300'
                        : 'text-gray-300'
                    }`}
                  >
                    {wind(h.windGustKmh[i] ?? null)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400">
                    {h.windDirectionDeg[i] === null || h.windDirectionDeg[i] === undefined
                      ? NA
                      : degreesToCompass(h.windDirectionDeg[i]!)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400">
                    {pct(h.cloudCoverPct[i] ?? null)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400">
                    {height(h.freezingLevelM[i] ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function describeSky(cloudPct: number | null): string {
  if (cloudPct === null) return NA;
  if (cloudPct < 25) return 'Clear';
  if (cloudPct < 50) return 'Partly cloudy';
  if (cloudPct < 75) return 'Mostly cloudy';
  return 'Overcast';
}
