/**
 * Provider normalization tests.
 *
 * These DO hit the network — they verify the contract with two live upstreams,
 * which is the thing most likely to drift silently. Keep them out of any
 * fast/pre-commit loop.
 *
 *   yarn test:providers
 */

import { strict as assert } from 'assert';
import { NWSProvider } from '../lib/providers/nws';
import { OpenMeteoProvider } from '../lib/providers/openMeteo';
import { selectProviders } from '../lib/providers';
import { deriveConditions } from '../lib/conditions';
import type { NormalizedForecast } from '../lib/types';

let passed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

/** Assert an hourly series is internally consistent. */
function assertWellFormed(f: NormalizedForecast, label: string) {
  const h = f.hourly;
  assert.ok(h.time.length > 24, `${label}: expected >24 hours, got ${h.time.length}`);

  for (let i = 1; i < h.time.length; i++) {
    assert.ok(h.time[i] > h.time[i - 1], `${label}: timestamps must ascend`);
  }

  const fields: Array<keyof typeof h> = [
    'temperatureC',
    'snowfallMm',
    'windSpeedKmh',
    'windGustKmh',
    'cloudCoverPct',
  ];
  for (const field of fields) {
    const series = h[field] as Array<number | null>;
    assert.equal(
      series.length,
      h.time.length,
      `${label}: ${String(field)} length ${series.length} != time length ${h.time.length}`
    );
  }

  // Physical plausibility — catches unit errors, which is the whole point.
  for (const t of h.temperatureC) {
    if (t === null) continue;
    assert.ok(t > -70 && t < 60, `${label}: temperature ${t}°C out of range`);
  }
  for (const s of h.snowfallMm) {
    if (s === null) continue;
    assert.ok(s >= 0 && s < 200, `${label}: hourly snowfall ${s}mm out of range`);
  }
  for (const w of h.windGustKmh) {
    if (w === null) continue;
    assert.ok(w >= 0 && w < 400, `${label}: gust ${w} km/h out of range`);
  }
  for (const c of h.cloudCoverPct) {
    if (c === null) continue;
    assert.ok(c >= 0 && c <= 100, `${label}: cloud cover ${c}% out of range`);
  }
}

async function main() {
  console.log('\n🌐 Provider normalization (live network)\n');

  const nws = new NWSProvider();
  const om = new OpenMeteoProvider();

  // Alta, Utah — covered by both providers, so we can cross-check.
  const alta = { lat: 40.5883, lon: -111.6378, elevationM: 2600 };
  // Chamonix, France — Open-Meteo only.
  const chamonix = { lat: 45.9237, lon: 6.8694, elevationM: 2500 };
  // Niseko, Japan.
  const niseko = { lat: 42.8048, lon: 140.6874, elevationM: 1000 };

  console.log('Routing');

  await test('US coordinates route to NWS with Open-Meteo fallback', () => {
    const sel = selectProviders(alta.lat, alta.lon);
    assert.equal(sel.primary.id, 'nws');
    assert.equal(sel.fallback?.id, 'open-meteo');
  });

  await test('Alpine coordinates route to Open-Meteo', () => {
    assert.equal(selectProviders(chamonix.lat, chamonix.lon).primary.id, 'open-meteo');
  });

  await test('Japanese coordinates route to Open-Meteo', () => {
    assert.equal(selectProviders(niseko.lat, niseko.lon).primary.id, 'open-meteo');
  });

  await test('NWS does not claim coverage outside the US', () => {
    assert.equal(nws.covers(chamonix.lat, chamonix.lon), false);
    assert.equal(nws.covers(niseko.lat, niseko.lon), false);
    assert.equal(nws.covers(alta.lat, alta.lon), true);
  });

  console.log('\nNWS normalization');

  const nwsForecast = await nws.fetchForecast(alta);
  await test('NWS returns a well-formed hourly series', () =>
    assertWellFormed(nwsForecast, 'nws'));
  await test('NWS supplies narrative periods', () =>
    assert.ok((nwsForecast.narrative?.length ?? 0) > 0));
  await test('NWS reports its source and attribution', () => {
    assert.equal(nwsForecast.source, 'nws');
    assert.ok(nwsForecast.attribution.includes('National Weather Service'));
  });

  console.log('\nOpen-Meteo normalization');

  const omForecast = await om.fetchForecast(alta);
  await test('Open-Meteo returns a well-formed hourly series', () =>
    assertWellFormed(omForecast, 'open-meteo'));
  await test('Open-Meteo honours the requested elevation', () => {
    assert.ok(
      omForecast.elevationM !== null &&
        Math.abs(omForecast.elevationM - alta.elevationM) < 500,
      `requested ${alta.elevationM}m, model reported ${omForecast.elevationM}m`
    );
  });
  await test('Open-Meteo supplies freezing level', () => {
    const known = omForecast.hourly.freezingLevelM.filter((v) => v !== null);
    assert.ok(known.length > 0, 'expected freezing level data');
  });
  await test('Open-Meteo supplies snow depth', () => {
    const known = omForecast.hourly.snowDepthCm.filter((v) => v !== null);
    assert.ok(known.length > 0, 'expected snow depth data');
  });

  console.log('\nCross-provider agreement at the same point');

  await test('both providers agree on temperature within 8°C', () => {
    // Different models genuinely disagree; this catches unit errors (a °F/°C
    // mixup would show ~30 degrees of divergence), not forecast skill.
    const target = Date.now() + 6 * 3_600_000;
    const pick = (f: NormalizedForecast) => {
      let best = 0;
      for (let i = 0; i < f.hourly.time.length; i++) {
        if (Math.abs(f.hourly.time[i] - target) < Math.abs(f.hourly.time[best] - target)) {
          best = i;
        }
      }
      return f.hourly.temperatureC[best];
    };

    const a = pick(nwsForecast);
    const b = pick(omForecast);
    assert.ok(a !== null && b !== null, 'both providers should have data');
    assert.ok(
      Math.abs(a! - b!) < 8,
      `NWS ${a!.toFixed(1)}°C vs Open-Meteo ${b!.toFixed(1)}°C — suspicious divergence`
    );
  });

  await test('7-day snow totals stay within an order of magnitude', () => {
    // This is the assertion that would have caught the original 10x bug.
    const sum = (f: NormalizedForecast) =>
      f.hourly.snowfallMm.reduce<number>((acc, v) => acc + (v ?? 0), 0);

    const a = sum(nwsForecast);
    const b = sum(omForecast);
    if (a < 1 && b < 1) return; // No snow forecast anywhere — nothing to compare.

    const ratio = Math.max(a, b) / Math.max(1, Math.min(a, b));
    assert.ok(
      ratio < 10,
      `NWS ${a.toFixed(1)}mm vs Open-Meteo ${b.toFixed(1)}mm — ratio ${ratio.toFixed(1)}x suggests a unit error`
    );
  });

  console.log('\nInternational coverage');

  for (const [label, point] of [
    ['Chamonix (French Alps)', chamonix],
    ['Niseko (Japan)', niseko],
  ] as const) {
    const forecast = await om.fetchForecast(point);
    await test(`${label} returns a well-formed forecast`, () =>
      assertWellFormed(forecast, label));
    await test(`${label} derives conditions without throwing`, () => {
      const conditions = deriveConditions(forecast);
      assert.ok(Number.isFinite(conditions.currentTemp));
      assert.ok(conditions.snow7day >= 0);
    });
    console.log(`      model: ${forecast.model}`);
  }

  console.log(
    failures.length
      ? `\n❌ ${failures.length} failed: ${failures.join(', ')}\n`
      : `\n✅ ${passed} assertions passed\n`
  );
}

main().catch((err) => {
  console.error('\n💥 Test run crashed:', err);
  process.exit(1);
});
