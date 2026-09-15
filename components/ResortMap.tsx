'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Resort } from '@/lib/types';
import type { LatLon } from '@/lib/nearby';
import { scoreLabel } from '@/lib/scoring';

export interface MapPoint {
  resort: Resort;
  /** Ride Score, or null while the forecast is still loading. */
  score: number | null;
}

interface ResortMapProps {
  points: MapPoint[];
  /** The rider's position, drawn as a "you are here" dot when known. */
  origin?: LatLon | null;
  onSelectResort: (resort: Resort) => void;
}

const PENDING = '#475569';
const YOU = '#22d3ee';

/**
 * Resorts on a map, coloured by Ride Score.
 *
 * A grid of cards ranks mountains; a map shows which of them are actually on
 * the way. Loaded via next/dynamic with ssr disabled — Leaflet touches
 * `window` at import time — so it costs nothing until someone opens a
 * comparison.
 *
 * Markers are circle markers rather than Leaflet's default icons: those are
 * PNGs resolved relative to the stylesheet, which breaks under a bundler and
 * a GitHub Pages base path.
 */
export default function ResortMap({ points, origin, onSelectResort }: ResortMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectResort);

  useEffect(() => {
    onSelectRef.current = onSelectResort;
  }, [onSelectResort]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      // An embedded map that grabs the wheel traps desktop page scrolling.
      scrollWheelZoom: false,
      worldCopyJump: true,
    });

    // Standard OpenStreetMap tiles: keyless, which a static app needs (CARTO's
    // dark basemap now watermarks keyless requests). `pc-dark-tiles` inverts
    // them to sit in the app's dark theme — see globals.css.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: 'pc-dark-tiles',
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Stable across renders that only refresh scores, so the view does not jump.
  const extentKey = points.map((p) => p.resort.id).join(',') + (origin ? `@${origin.lat},${origin.lon}` : '');

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    for (const { resort, score } of points) {
      const band = score === null ? null : scoreLabel(score);
      L.circleMarker([resort.base_lat, resort.base_lon], {
        radius: 9,
        color: '#0f172a',
        weight: 2,
        fillColor: band?.hex ?? PENDING,
        fillOpacity: 0.95,
      })
        .bindTooltip(
          `<strong>${escapeHtml(resort.name)}</strong><br/>${
            band ? `${score} · ${band.short}` : 'Loading…'
          }`,
          { direction: 'top', offset: [0, -8] }
        )
        .on('click', () => onSelectRef.current(resort))
        .addTo(layer);
    }

    if (origin) {
      L.circleMarker([origin.lat, origin.lon], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: YOU,
        fillOpacity: 1,
      })
        .bindTooltip('You', { direction: 'top', offset: [0, -6] })
        .addTo(layer);
    }
  }, [points, origin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const coords: L.LatLngTuple[] = points.map((p) => [p.resort.base_lat, p.resort.base_lon]);
    if (origin) coords.push([origin.lat, origin.lon]);
    if (coords.length === 0) {
      map.setView([45, 0], 2);
      return;
    }

    map.fitBounds(L.latLngBounds(coords), { padding: [32, 32], maxZoom: 10 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extentKey]);

  return (
    <div
      ref={containerRef}
      // `isolate` keeps Leaflet's pane z-indexes (400-1000) inside the map, so
      // they cannot paint over the phone tab bar or the favorites modal.
      className="isolate h-72 w-full overflow-hidden rounded-2xl border border-white/10 sm:h-96"
      role="region"
      aria-label="Map of resorts, coloured by Ride Score"
    />
  );
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
