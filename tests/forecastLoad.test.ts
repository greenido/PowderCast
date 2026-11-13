/**
 * How fast a resort page gets its forecast, and what it costs NWS.
 *
 * A US resort page used to:
 *  - retry a stalled NWS call for up to ~33s, twice over, before falling back
 *  - fail the whole NWS forecast when only the prose narrative 500'd
 *  - wait for NWS to finish before even starting the Open-Meteo supplement
 *  - fetch the same NWS points/grid/narrative twice, once for the base view
 *    and once for the week strip's mid-mountain outlook
 *
 * Offline: fetch is stubbed throughout.
 */

import { strict as assert } from 'assert';
import { sharedFetchJson, __resetSharedFetch } from '../lib/sharedFetch';
import { NWSProvider } from '../lib/providers/nws';
import { fetchForecast } from '../lib/providers';

let passed = 0;
async function testAsync(name: string, fn: () => Promise<void>) {
  __resetSharedFetch();
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
// Stubbed network

const realFetch = global.fetch;
const realWarn = console.warn;
let requests: string[] = [];

type Handler = (url: string, init: RequestInit) => Promise<Response> | Response;

function stub(handler: Handler) {
  requests = [];
  global.fetch = (async (url: string, init: RequestInit = {}) => {
    requests.push(url);
    return handler(url, init);
  }) as unknown as typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as unknown as Response;
}

/** Pending until the request's signal aborts, like a real stalled request. */
function hang(init: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () =>
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    );
  });
}

const count = (fragment: string) => requests.filter((u) => u.includes(fragment)).length;

const HOUR = 3_600_000;
const NOW_HOUR = Math.floor(Date.now() / HOUR) * HOUR;
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', '+00:00');

const POINT = {
  properties: {
    forecast: 'https://api.weather.gov/gridpoints/REV/57,17/forecast',
    forecastGridData: 'https://api.weather.gov/gridpoints/REV/57,17',
    timeZone: 'America/Los_Angeles',
    relativeLocation: { properties: { city: 'Mammoth Lakes', state: 'CA' } },
  },
};

const GRID = {
  properties: {
    elevation: { value: 2500 },
    temperature: { values: [{ validTime: `${iso(NOW_HOUR)}/PT168H`, value: -5 }] },
    snowfallAmount: { values: [{ validTime: `${iso(NOW_HOUR)}/PT6H`, value: 60 }] },
  },
};

const NARRATIVE = {
  properties: { periods: [{ number: 1, name: 'Tonight', detailedForecast: 'Snow.' }] },
};

/** Open-Meteo in its single-model shape, enough for the supplement or a full forecast. */
function openMeteo() {
  const time: number[] = [];
  for (let i = -48; i < 168; i++) time.push((NOW_HOUR + i * HOUR) / 1000);
  const fill = (v: number) => time.map(() => v);
  return {
    elevation: 2457,
    hourly: {
      time,
      temperature_2m: fill(-3),
      snowfall: fill(0.5),
      snow_depth: fill(1.2),
    },
  };
}

/** A healthy upstream. `override` replaces the response for matching URLs. */
function upstream(override?: (url: string, init: RequestInit) => Promise<Response> | null): Handler {
  return async (url, init) => {
    const custom = override?.(url, init);
    if (custom) return custom;
    if (url.includes('open-meteo')) return json(openMeteo());
    if (url.includes('/points/')) return json(POINT);
    if (url.endsWith('/forecast')) return json(NARRATIVE);
    if (url.includes('/gridpoints/')) return json(GRID);
    throw new Error(`unexpected URL ${url}`);
  };
}

const MAMMOTH = { lat: 37.6395, lon: -119.0262, timezone: 'America/Los_Angeles' };

(async () => {
  console.warn = () => {};

  console.log('\nsharedFetchJson');

  await testAsync('concurrent callers share one request', async () => {
    stub(async () => json({ n: 1 }));
    const [a, b] = await Promise.all([
      sharedFetchJson('https://example.test/a'),
      sharedFetchJson('https://example.test/a'),
    ]);
    assert.deepEqual(a, { n: 1 });
    assert.deepEqual(b, { n: 1 });
    assert.equal(requests.length, 1);
  });

  await testAsync('a body is reused within its TTL, and refetched without one', async () => {
    stub(async () => json({ n: 1 }));
    await sharedFetchJson('https://example.test/b', { ttlMs: 60_000 });
    await sharedFetchJson('https://example.test/b', { ttlMs: 60_000 });
    assert.equal(requests.length, 1, 'second call inside the TTL is served from memory');

    await sharedFetchJson('https://example.test/c');
    await sharedFetchJson('https://example.test/c');
    assert.equal(requests.length, 3, 'with no TTL only in-flight requests are shared');
  });

  await testAsync('a failure is not cached', async () => {
    let fail = true;
    stub(async () => (fail ? json({}, 500) : json({ ok: true })));
    await assert.rejects(
      sharedFetchJson('https://example.test/d', { ttlMs: 60_000, maxRetries: 0 }),
      /HTTP 500/
    );
    fail = false;
    assert.deepEqual(await sharedFetchJson('https://example.test/d', { ttlMs: 60_000 }), {
      ok: true,
    });
    assert.equal(requests.length, 2);
  });

  await testAsync("one caller's abort does not cancel another caller's request", async () => {
    let release!: () => void;
    let networkAborted = false;
    stub((_url, init) => {
      init.signal?.addEventListener('abort', () => (networkAborted = true));
      return new Promise((resolve) => (release = () => resolve(json({ n: 2 }))));
    });

    const leaving = new AbortController();
    const first = sharedFetchJson('https://example.test/e', { signal: leaving.signal });
    const second = sharedFetchJson('https://example.test/e');

    leaving.abort();
    await assert.rejects(first, (err: Error) => err.name === 'AbortError');
    assert.equal(networkAborted, false, 'the other caller is still waiting');

    release();
    assert.deepEqual(await second, { n: 2 });
  });

  await testAsync('the request is cancelled once every caller has left', async () => {
    let networkAborted = false;
    stub((_url, init) => {
      init.signal?.addEventListener('abort', () => (networkAborted = true));
      return hang(init);
    });

    const a = new AbortController();
    const b = new AbortController();
    const pa = sharedFetchJson('https://example.test/f', { signal: a.signal });
    const pb = sharedFetchJson('https://example.test/f', { signal: b.signal });
    a.abort();
    b.abort();
    await Promise.allSettled([pa, pb]);
    assert.equal(networkAborted, true);
  });

  console.log('\nNWS provider');

  await testAsync('a failing narrative no longer fails the forecast', async () => {
    stub(upstream((url) => (url.endsWith('/forecast') ? Promise.resolve(json({}, 500)) : null)));
    const forecast = await new NWSProvider().fetchForecast(MAMMOTH);
    assert.equal(forecast.source, 'nws');
    assert.equal(forecast.narrative, undefined);
    assert.equal(forecast.hourly.temperatureC[0], -5);
  });

  await testAsync('the narrative is included when it answers', async () => {
    stub(upstream());
    const forecast = await new NWSProvider().fetchForecast(MAMMOTH);
    assert.equal(forecast.narrative?.[0]?.name, 'Tonight');
  });

  await testAsync('a stalled NWS gives up at the budget, not after retries', async () => {
    stub(upstream((url, init) => (url.includes('/gridpoints/') ? hang(init) : null)));
    const started = Date.now();
    await assert.rejects(new NWSProvider(150).fetchForecast(MAMMOTH), /did not answer/);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 1_000, `expected ~150ms, took ${elapsed}ms`);
    assert.equal(count('/gridpoints/REV/57,17'), 2, 'grid and narrative, each tried once');
  });

  await testAsync('a caller abort still surfaces as an AbortError', async () => {
    stub(upstream((url, init) => (url.includes('/gridpoints/') ? hang(init) : null)));
    const controller = new AbortController();
    const pending = new NWSProvider().fetchForecast({ ...MAMMOTH, signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(pending, (err: Error) => err.name === 'AbortError');
  });

  console.log('\nfetchForecast');

  await testAsync('an NWS 500 falls through to Open-Meteo without retrying', async () => {
    stub(
      upstream((url) =>
        url.includes('/gridpoints/') && !url.endsWith('/forecast')
          ? Promise.resolve(json({}, 500))
          : null
      )
    );
    const forecast = await fetchForecast({ ...MAMMOTH, elevationM: 2457 });
    assert.equal(forecast.source, 'open-meteo');
    assert.equal(count('/gridpoints/REV/57,17'), 2, 'grid once, narrative once: no retries');
  });

  await testAsync('the supplement starts before NWS answers', async () => {
    let releasePoint!: () => void;
    stub(
      upstream((url) =>
        url.includes('/points/')
          ? new Promise((resolve) => (releasePoint = () => resolve(json(POINT))))
          : null
      )
    );
    const pending = fetchForecast({ ...MAMMOTH, elevationM: 2457 });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(count('open-meteo'), 1, 'supplement requested while /points is pending');

    releasePoint();
    const forecast = await pending;
    assert.equal(forecast.source, 'nws');
    assert.ok(forecast.hourly.snowDepthCm.some((v) => v !== null), 'snow depth grafted');
  });

  await testAsync('base and mid-mountain share one set of NWS requests', async () => {
    stub(upstream());
    await Promise.all([
      fetchForecast({ ...MAMMOTH, elevationM: 2457 }),
      fetchForecast({ ...MAMMOTH, elevationM: 2908 }),
    ]);
    assert.equal(count('/points/'), 1);
    assert.equal(count('/gridpoints/REV/57,17/forecast'), 1);
    assert.equal(count('/gridpoints/REV/57,17'), 2, 'one grid + one narrative');
    assert.equal(count('open-meteo'), 2, 'the supplement is per elevation, as it should be');
  });

  console.log('\nStored NWS grid cells');

  const STORED = { ...MAMMOTH, nwsGrid: { office: 'REV', x: 57, y: 17 } };

  await testAsync('a stored grid cell skips the /points lookup', async () => {
    stub(upstream());
    const forecast = await new NWSProvider().fetchForecast(STORED);
    assert.equal(count('/points/'), 0);
    assert.equal(forecast.hourly.temperatureC[0], -5);
    assert.equal(forecast.location?.timezone, 'America/Los_Angeles');
  });

  await testAsync('grid and supplement start together with a stored cell', async () => {
    stub(upstream());
    await fetchForecast({ ...STORED, elevationM: 2457 });
    assert.deepEqual(
      requests.slice(0, 3).map((u) => (u.includes('open-meteo') ? 'om' : 'nws')).sort(),
      ['nws', 'nws', 'om'],
      'grid, narrative and supplement are all first-wave requests'
    );
  });

  await testAsync('a stale stored cell falls back to /points', async () => {
    stub(
      upstream((url) =>
        url.includes('/gridpoints/BOI/1,1') ? Promise.resolve(json({}, 404)) : null
      )
    );
    const forecast = await new NWSProvider().fetchForecast({
      ...MAMMOTH,
      nwsGrid: { office: 'BOI', x: 1, y: 1 },
    });
    assert.equal(forecast.source, 'nws');
    assert.equal(count('/points/'), 1);
    assert.equal(forecast.sourceUrl, POINT.properties.forecastGridData);
  });

  await testAsync('a 500 on a stored cell is an outage, not a stale cell', async () => {
    stub(
      upstream((url) =>
        url.includes('/gridpoints/') && !url.endsWith('/forecast')
          ? Promise.resolve(json({}, 500))
          : null
      )
    );
    await assert.rejects(new NWSProvider().fetchForecast(STORED), /gridpoint failed/);
    assert.equal(count('/points/'), 0, 'no point lookup can fix a 500');
  });

  global.fetch = realFetch;
  console.warn = realWarn;
  console.log(`\n✅ ${passed} assertions passed\n`);
})();
