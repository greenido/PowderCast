/**
 * One cache for every view.
 *
 * Previously useForecast and useMultiForecast shared a cache and usePlanner had
 * none, so moving between Compare and Planner on the same region refetched ten
 * resorts — up to four upstream calls each — every time. Worse, nothing ever
 * removed an entry: no expiry sweep, no eviction, and the v2 -> v3 prefix bump
 * orphaned every older entry permanently. Entries run 20-44KB, so a few regions
 * of browsing fills a 5MB quota, and once it is full every write throws into an
 * empty catch. Caching then stops working everywhere, silently, forever.
 *
 * What is stored is the normalized forecast alone. Conditions are derived on
 * read instead of written alongside, which is both a third smaller and more
 * correct: deriveConditions() anchors all its windows to `now`, so conditions
 * frozen at write time meant a 55-minute-old entry showed a "next 24 hours"
 * window that started 55 minutes ago.
 */

import type { NormalizedForecast } from '@/lib/types';

/**
 * v4 stores the forecast alone. The bump also discards every v3 entry, which
 * held a conditions blob this code no longer reads.
 */
const PREFIX = 'pc_forecast_v4';
const INDEX_KEY = `${PREFIX}_index`;
const LEGACY_PREFIXES = ['pc_forecast_v2', 'pc_forecast_v3'];

export const CACHE_TTL_MS = 3_600_000; // 1 hour

/**
 * Hard cap on entries, well under a 5MB quota at 20-44KB each. Pruning at a
 * limit we choose beats discovering the browser's limit by exception.
 */
const MAX_ENTRIES = 80;

/** Fraction of the cache dropped when a write hits quota anyway. */
const PANIC_EVICTION = 0.5;

/**
 * Which forecast this is. The planner reasons about mid-mountain, which is
 * neither of the two the resort page offers, and keying them together would
 * serve a base forecast to a view asking about the summit.
 */
export type ElevationTag = 'base' | 'summit' | 'mid';

interface CacheEntry {
  forecast: NormalizedForecast;
  timestamp: number;
}

/** key -> write time. Kept separately so eviction never parses 80 blobs. */
type CacheIndex = Record<string, number>;

export function forecastKey(resortId: string, elevation: ElevationTag): string {
  return `${PREFIX}_${resortId}_${elevation}`;
}

function available(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readIndex(): CacheIndex {
  if (!available()) return {};
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CacheIndex) : {};
  } catch {
    return {};
  }
}

function writeIndex(index: CacheIndex) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // The index is a convenience; losing it costs eviction accuracy, not data.
  }
}

function drop(key: string, index: CacheIndex) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing useful to do, and nothing depends on it succeeding.
  }
  delete index[key];
}

/**
 * Remove expired entries, then the oldest entries over the cap.
 *
 * Eviction is by write time rather than last access: with a one-hour TTL the
 * two orders barely differ, and touching every entry on read to maintain an
 * access order would mean a localStorage write on every cache hit.
 */
function prune(index: CacheIndex, now: number): CacheIndex {
  for (const [key, timestamp] of Object.entries(index)) {
    if (now - timestamp > CACHE_TTL_MS) drop(key, index);
  }

  const remaining = Object.entries(index).sort((a, b) => a[1] - b[1]);
  const excess = remaining.length - MAX_ENTRIES;
  for (let i = 0; i < excess; i++) {
    drop(remaining[i][0], index);
  }

  return index;
}

/**
 * Delete entries written by earlier schema versions.
 *
 * Each prefix bump correctly stopped *reading* old entries but never removed
 * them, so they sat in the quota forever holding data no code could use. Runs
 * once per page load, not per write — it is the only operation here that walks
 * the whole of localStorage.
 */
let legacyCleared = false;
export function clearLegacyEntries() {
  if (legacyCleared || !available()) return;
  legacyCleared = true;

  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        doomed.push(key);
      }
    }
    for (const key of doomed) localStorage.removeItem(key);
    if (doomed.length) {
      console.info(`[forecastCache] removed ${doomed.length} entries from an older schema`);
    }
  } catch {
    // Private mode or a locked-down origin. Nothing here is load-bearing.
  }
}

/**
 * Read a cached forecast.
 *
 * `maxAgeMs` of Infinity is the offline path: a stale forecast beats an error
 * screen on a chairlift with one bar.
 */
export function readForecast(
  key: string,
  maxAgeMs: number = CACHE_TTL_MS,
  now: number = Date.now()
): CacheEntry | null {
  if (!available()) return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as Partial<CacheEntry>;
    if (!entry?.forecast?.hourly || typeof entry.timestamp !== 'number') return null;
    if (now - entry.timestamp > maxAgeMs) return null;

    return entry as CacheEntry;
  } catch {
    return null;
  }
}

/**
 * Cache a forecast, pruning first and recovering from a full quota.
 *
 * A failed write is survivable — it costs a refetch — but a write that fails
 * *forever* is not, which is what the previous empty catch produced.
 */
export function writeForecast(
  key: string,
  forecast: NormalizedForecast,
  now: number = Date.now()
): void {
  if (!available()) return;

  const index = prune(readIndex(), now);
  const payload = JSON.stringify({ forecast, timestamp: now });

  try {
    localStorage.setItem(key, payload);
    index[key] = now;
    writeIndex(index);
    return;
  } catch {
    // Quota, most likely — and possibly from something other than this cache.
  }

  // Drop the oldest half and try once more.
  const oldest = Object.entries(index).sort((a, b) => a[1] - b[1]);
  const evict = Math.ceil(oldest.length * PANIC_EVICTION);
  for (let i = 0; i < evict; i++) drop(oldest[i][0], index);

  try {
    localStorage.setItem(key, payload);
    index[key] = now;
  } catch {
    // Still no room: the origin's quota is being used by something else, or
    // storage is denied outright. Serving without a cache is correct here.
  }
  writeIndex(index);
}

/** Test seam. Not used by the app. */
export function __cacheInternals() {
  return { PREFIX, INDEX_KEY, MAX_ENTRIES, readIndex };
}
