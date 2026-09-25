/**
 * The fetch and cache layer.
 *
 * Three bugs, all of which wasted work silently rather than failing loudly:
 *
 *  1. fetchWithRetry spread the caller's options and then overwrote `signal`
 *     with its own timeout controller, so every caller's AbortSignal was
 *     discarded. Both providers thread one through and it went nowhere.
 *  2. usePlanner had no cache at all while useMultiForecast had one, so moving
 *     between Compare and Planner refetched the whole region every time.
 *  3. Nothing ever removed a cache entry — no expiry sweep, no eviction, and
 *     each schema bump orphaned the previous version's entries forever. Once
 *     the quota filled, every write threw into an empty catch and caching
 *     stopped working everywhere, permanently.
 *
 *   yarn test:cache
 */

import { strict as assert } from 'assert';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import {
  forecastKey,
  readForecast,
  writeForecast,
  clearLegacyEntries,
  CACHE_TTL_MS,
  __cacheInternals,
} from '../lib/forecastCache';
import { emptyHourlySeries } from '../lib/types';
import type { NormalizedForecast } from '../lib/types';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// A localStorage that can run out of room, like the real one.

class MemoryStorage {
  private store = new Map<string, string>();
  /** Characters allowed before setItem throws. Infinity = unlimited. */
  quota = Infinity;

  get length() {
    return this.store.size;
  }
  key(i: number): string | null {
    return Array.from(this.store.keys())[i] ?? null;
  }
  getItem(k: string): string | null {
    return this.store.get(k) ?? null;
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  setItem(k: string, v: string) {
    let used = 0;
    for (const [key, value] of this.store) {
      if (key !== k) used += key.length + value.length;
    }
    if (used + k.length + v.length > this.quota) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store.set(k, v);
  }
}

const storage = new MemoryStorage();
(global as unknown as { window: unknown }).window = {};
(global as unknown as { localStorage: MemoryStorage }).localStorage = storage;

const NOW = Date.parse('2026-01-15T12:00:00Z');
const HOUR = 3_600_000;

function forecast(tag = 'x'): NormalizedForecast {
  const series = emptyHourlySeries();
  for (let i = 0; i < 24; i++) {
    series.time.push(NOW + i * HOUR);
    series.temperatureC.push(-5);
    series.snowfallMm.push(2);
  }
  return {
    source: 'open-meteo',
    model: tag,
    elevationM: 2000,
    location: {},
    hourly: series,
    fetchedAt: NOW,
    attribution: 'test',
  };
}

console.log('\n🗄️  Forecast cache and fetch\n');

// ---------------------------------------------------------------------------
console.log('Cache round-trip and expiry');

test('a written forecast reads back', () => {
  storage.clear();
  const key = forecastKey('alta-us', 'base');
  writeForecast(key, forecast('alta'), NOW);

  const hit = readForecast(key, CACHE_TTL_MS, NOW);
  assert.ok(hit, 'expected a cache hit');
  assert.equal(hit!.forecast.model, 'alta');
  assert.equal(hit!.timestamp, NOW);
});

test('an entry past its TTL reads as a miss', () => {
  storage.clear();
  const key = forecastKey('alta-us', 'base');
  writeForecast(key, forecast(), NOW);
  assert.equal(readForecast(key, CACHE_TTL_MS, NOW + CACHE_TTL_MS + 1), null);
});

test('the offline path accepts a cache entry of any age', () => {
  storage.clear();
  const key = forecastKey('alta-us', 'base');
  writeForecast(key, forecast(), NOW);
  const stale = readForecast(key, Infinity, NOW + 30 * 24 * HOUR);
  assert.ok(stale, 'a month-old forecast still beats an error screen');
});

test('corrupt JSON reads as a miss rather than throwing', () => {
  storage.clear();
  const key = forecastKey('alta-us', 'base');
  storage.setItem(key, '{not json');
  assert.equal(readForecast(key, CACHE_TTL_MS, NOW), null);
});

test('an entry missing its forecast reads as a miss', () => {
  storage.clear();
  const key = forecastKey('alta-us', 'base');
  storage.setItem(key, JSON.stringify({ timestamp: NOW }));
  assert.equal(readForecast(key, CACHE_TTL_MS, NOW), null);
});

test("the planner's mid forecast does not collide with base or summit", () => {
  storage.clear();
  writeForecast(forecastKey('alta-us', 'base'), forecast('base'), NOW);
  writeForecast(forecastKey('alta-us', 'summit'), forecast('summit'), NOW);
  writeForecast(forecastKey('alta-us', 'mid'), forecast('mid'), NOW);

  assert.equal(readForecast(forecastKey('alta-us', 'base'), CACHE_TTL_MS, NOW)!.forecast.model, 'base');
  assert.equal(readForecast(forecastKey('alta-us', 'mid'), CACHE_TTL_MS, NOW)!.forecast.model, 'mid');
  assert.equal(readForecast(forecastKey('alta-us', 'summit'), CACHE_TTL_MS, NOW)!.forecast.model, 'summit');
});

// ---------------------------------------------------------------------------
console.log('\nEviction — the cache must not grow without limit');

test('expired entries are swept on the next write', () => {
  storage.clear();
  writeForecast(forecastKey('old-one', 'base'), forecast(), NOW);
  writeForecast(forecastKey('old-two', 'base'), forecast(), NOW);

  // A write an hour and a bit later should clear both.
  const later = NOW + CACHE_TTL_MS + 1;
  writeForecast(forecastKey('fresh', 'base'), forecast(), later);

  assert.equal(storage.getItem(forecastKey('old-one', 'base')), null);
  assert.equal(storage.getItem(forecastKey('old-two', 'base')), null);
  assert.ok(storage.getItem(forecastKey('fresh', 'base')), 'the new entry survives');
});

test('the oldest entries are evicted once the cap is reached', () => {
  storage.clear();
  const { MAX_ENTRIES } = __cacheInternals();

  // Write one more than the cap, each a minute apart.
  for (let i = 0; i <= MAX_ENTRIES; i++) {
    writeForecast(forecastKey(`resort-${i}`, 'base'), forecast(`r${i}`), NOW + i * 60_000);
  }

  assert.equal(
    storage.getItem(forecastKey('resort-0', 'base')),
    null,
    'the oldest entry should have been evicted'
  );
  assert.ok(
    storage.getItem(forecastKey(`resort-${MAX_ENTRIES}`, 'base')),
    'the newest entry must be present'
  );

  const { readIndex } = __cacheInternals();
  assert.ok(
    Object.keys(readIndex()).length <= MAX_ENTRIES,
    'the index must respect the cap too'
  );
});

test('a full quota does not kill caching forever', () => {
  storage.clear();
  storage.quota = Infinity;

  // Fill with entries, then shrink the quota to simulate a full origin.
  for (let i = 0; i < 20; i++) {
    writeForecast(forecastKey(`resort-${i}`, 'base'), forecast(`r${i}`), NOW + i * 60_000);
  }

  let used = 0;
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)!;
    used += k.length + storage.getItem(k)!.length;
  }
  storage.quota = used + 200; // Barely any headroom.

  // This write must fail, recover by evicting, and then succeed.
  const key = forecastKey('newcomer', 'base');
  writeForecast(key, forecast('newcomer'), NOW + 21 * 60_000);

  const hit = readForecast(key, CACHE_TTL_MS, NOW + 21 * 60_000);
  assert.ok(hit, 'the write must succeed after evicting room for itself');
  assert.equal(hit!.forecast.model, 'newcomer');

  // And the cache must keep working afterwards — this is the actual bug.
  const second = forecastKey('another', 'base');
  writeForecast(second, forecast('another'), NOW + 22 * 60_000);
  assert.ok(
    readForecast(second, CACHE_TTL_MS, NOW + 22 * 60_000),
    'caching must not be permanently dead after one quota error'
  );

  storage.quota = Infinity;
});

test('entries from an older schema version are removed', () => {
  storage.clear();
  storage.setItem('pc_forecast_v2_alta-us_base', JSON.stringify({ conditions: {} }));
  storage.setItem('pc_forecast_v3_alta-us_base', JSON.stringify({ conditions: {} }));
  storage.setItem('unrelated_app_key', 'keep me');
  writeForecast(forecastKey('alta-us', 'base'), forecast(), NOW);

  clearLegacyEntries();

  assert.equal(storage.getItem('pc_forecast_v2_alta-us_base'), null);
  assert.equal(storage.getItem('pc_forecast_v3_alta-us_base'), null);
  assert.equal(storage.getItem('unrelated_app_key'), 'keep me', 'only our own prefixes');
  assert.ok(storage.getItem(forecastKey('alta-us', 'base')), 'current entries survive');
});

// ---------------------------------------------------------------------------
console.log('\nAbort and retry');

const realFetch = global.fetch;
let calls = 0;

function stub(handler: (url: string, init: RequestInit) => Promise<Response>) {
  calls = 0;
  global.fetch = ((url: string, init: RequestInit = {}) => {
    calls++;
    return handler(url, init);
  }) as unknown as typeof fetch;
}

function response(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => ({}),
  } as unknown as Response;
}

/** Resolves only when the passed signal aborts, like a real pending request. */
function neverResolves(init: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
  });
}

(async () => {
  await testAsync("the caller's signal actually reaches fetch", async () => {
    let seen: AbortSignal | null = null;
    stub(async (_url, init) => {
      seen = init.signal ?? null;
      return response(200);
    });

    const controller = new AbortController();
    await fetchWithRetry('https://example.test/a', { signal: controller.signal });
    assert.ok(seen, 'fetch must receive a signal');
  });

  await testAsync('aborting the caller signal rejects the request', async () => {
    stub((_url, init) => neverResolves(init));

    const controller = new AbortController();
    const promise = fetchWithRetry('https://example.test/b', {
      signal: controller.signal,
      maxRetries: 2,
    });
    controller.abort();

    await assert.rejects(promise, (err: Error) => err.name === 'AbortError');
  });

  await testAsync('an aborted request is not retried', async () => {
    stub((_url, init) => neverResolves(init));

    const controller = new AbortController();
    const promise = fetchWithRetry('https://example.test/c', {
      signal: controller.signal,
      maxRetries: 2,
    });
    controller.abort();
    await promise.catch(() => {});

    assert.equal(calls, 1, 'cancelling means stop, not try again twice more');
  });

  await testAsync('an already-aborted signal never reaches the network', async () => {
    stub(async () => response(200));

    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      fetchWithRetry('https://example.test/d', { signal: controller.signal }),
      (err: Error) => err.name === 'AbortError'
    );
    assert.equal(calls, 0, 'no request should be made at all');
  });

  await testAsync('a 429 is retried — Open-Meteo rate-limits with it', async () => {
    stub(async () => response(429));
    // Exhausting the retries throws rather than returning the last response;
    // the providers only ever check res.ok, so this is the existing contract.
    await assert.rejects(
      fetchWithRetry('https://example.test/e', { maxRetries: 1, timeoutMs: 50 }),
      /429/
    );
    assert.equal(calls, 2, 'one retry after the rate limit');
  });

  await testAsync('a 500 is retried', async () => {
    stub(async () => response(500));
    await assert.rejects(
      fetchWithRetry('https://example.test/f', { maxRetries: 1, timeoutMs: 50 }),
      /500/
    );
    assert.equal(calls, 2);
  });

  await testAsync('a retried request still honours an abort mid-backoff', async () => {
    stub(async () => response(500));
    const controller = new AbortController();
    const promise = fetchWithRetry('https://example.test/i', {
      maxRetries: 3,
      timeoutMs: 50,
      signal: controller.signal,
    });
    // Abort while the first backoff is sleeping.
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(promise, (err: Error) => err.name === 'AbortError');
    assert.ok(calls <= 2, `backoff must be interruptible, saw ${calls} attempts`);
  });

  await testAsync('a 404 is not retried', async () => {
    stub(async () => response(404));
    const res = await fetchWithRetry('https://example.test/g', { maxRetries: 2 });
    assert.equal(res.status, 404);
    assert.equal(calls, 1, 'a 404 will not become a 200 on the second try');
  });

  await testAsync('a successful response is returned without retrying', async () => {
    stub(async () => response(200));
    const res = await fetchWithRetry('https://example.test/h', { maxRetries: 2 });
    assert.equal(res.ok, true);
    assert.equal(calls, 1);
  });

  global.fetch = realFetch;
  console.log(`\n✅ ${passed} assertions passed\n`);
})();
