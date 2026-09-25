/**
 * Model merging, coverage, history and snow phase.
 *
 * Every case here corresponds to something that was wrong in production.
 *
 * The regional high-resolution models are incomplete in ways that fail
 * silently. AROME HD publishes no snowfall, snow depth, freezing level or
 * visibility at all; ICON-D2 stops at 49 hours. Because sumOver() drops nulls
 * before reducing, 168 missing hours summed to a confident "0 in" — so the
 * French Alps reported a dry week mid-storm and the Alpine planner blanked days
 * 3-7. The fix is to merge the global model in hour by hour and to carry
 * coverage so the UI can tell missing from zero.
 *
 *   yarn test:merge
 */

import { strict as assert } from 'assert';
import {
  sumBack,
  sumOverOrNull,
  coverageOver,
  measureCoverage,
  sumOver,
} from '../lib/series';
import { snowToLiquidRatio, applyElevationCorrection } from '../lib/lapseRate';
import { withSnowDepthAndHistory } from '../lib/providers/supplement';
import { buildOutlook } from '../lib/planner';
import { deriveConditions } from '../lib/conditions';
import { emptyHourlySeries } from '../lib/types';
import type { NormalizedForecast, HourlySeries, Resort } from '../lib/types';

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

const HOUR = 3_600_000;
const NOW = Date.parse('2026-01-15T12:00:00Z');

/** Hourly grid spanning [NOW - pastHours, NOW + futureHours). */
function grid(pastHours: number, futureHours: number): number[] {
  const times: number[] = [];
  for (let i = -pastHours; i < futureHours; i++) times.push(NOW + i * HOUR);
  return times;
}

console.log('\n🔀 Model merging, coverage and history\n');

// ---------------------------------------------------------------------------
console.log('Coverage tells missing apart from zero');

const times = grid(0, 168);

test('an all-null series has zero coverage, not a zero sum', () => {
  const nulls: Array<number | null> = new Array(168).fill(null);
  assert.equal(coverageOver(nulls, times, NOW, 168), 0);
  // The trap: this is what the UI used to render as "0 in".
  assert.equal(sumOver(nulls, times, NOW, 168), 0);
  assert.equal(sumOverOrNull(nulls, times, NOW, 168), null);
});

test('a genuinely dry week has full coverage and a zero sum', () => {
  const zeros: Array<number | null> = new Array(168).fill(0);
  assert.equal(coverageOver(zeros, times, NOW, 168), 1);
  assert.equal(sumOverOrNull(zeros, times, NOW, 168), 0);
});

test('a model that stops at 49 hours reports partial coverage', () => {
  // ICON-D2's actual shape: values through hour 49, nulls after.
  const truncated: Array<number | null> = times.map((_, i) => (i < 49 ? 0 : null));
  const coverage = coverageOver(truncated, times, NOW, 168);
  assert.ok(coverage > 0.25 && coverage < 0.3, `expected ~0.29, got ${coverage}`);
  // And day 6 specifically is empty, which is what blanked the planner.
  assert.equal(sumOverOrNull(truncated, times, NOW + 120 * HOUR, 24), null);
});

test('measureCoverage reports every series the UI reads', () => {
  const hourly: HourlySeries = { ...emptyHourlySeries(), time: times };
  for (const key of [
    'temperatureC',
    'snowfallMm',
    'precipMm',
    'windGustKmh',
    'visibilityM',
    'freezingLevelM',
    'snowDepthCm',
  ] as const) {
    hourly[key] = new Array(168).fill(null);
  }
  hourly.snowfallMm = new Array(168).fill(1);

  const coverage = measureCoverage(hourly, NOW);
  assert.equal(coverage.snowfallMm, 1);
  assert.equal(coverage.freezingLevelM, 0);
  assert.ok('visibilityM' in coverage, 'visibility must be measured');
});

// ---------------------------------------------------------------------------
console.log('\nBackward windows — what already fell');

test('sumBack only counts hours before the reference time', () => {
  const t = grid(48, 48);
  // 1mm every hour, past and future.
  const snow: Array<number | null> = t.map(() => 1);
  assert.equal(sumBack(snow, t, NOW, 24), 24);
  assert.equal(sumBack(snow, t, NOW, 48), 48);
  assert.equal(sumOver(snow, t, NOW, 24), 24);
});

test('sumBack is null without history rather than zero', () => {
  // An NWS gridpoint with no supplement: the series starts at NOW.
  const t = grid(0, 168);
  const snow: Array<number | null> = t.map(() => 0);
  assert.equal(sumBack(snow, t, NOW, 48), null);
});

test('the boundary hour belongs to the past, not the future', () => {
  const t = [NOW - HOUR, NOW, NOW + HOUR];
  const snow: Array<number | null> = [5, 100, 7];
  assert.equal(sumBack(snow, t, NOW, 1), 5);
  assert.equal(sumOver(snow, t, NOW, 1), 100);
});

// ---------------------------------------------------------------------------
console.log('\nSnow-to-liquid ratio');

test('above +2C it is rain, not snow', () => {
  assert.equal(snowToLiquidRatio(3), 0);
  assert.equal(snowToLiquidRatio(2.1), 0);
});

test('ratio peaks in the dendritic growth band near -15C', () => {
  const peak = snowToLiquidRatio(-13);
  assert.ok(peak >= snowToLiquidRatio(-1), 'cold snow is fluffier than wet snow');
  assert.ok(peak >= snowToLiquidRatio(-25), 'very cold air holds less moisture');
});

test('ratio rises monotonically from 0C to the peak', () => {
  const temps = [0.5, -1, -3, -5, -8, -12];
  for (let i = 1; i < temps.length; i++) {
    assert.ok(
      snowToLiquidRatio(temps[i]) >= snowToLiquidRatio(temps[i - 1]),
      `${temps[i]}C should be at least as fluffy as ${temps[i - 1]}C`
    );
  }
});

test('a non-finite temperature yields no snow rather than NaN', () => {
  assert.equal(snowToLiquidRatio(NaN), 0);
});

// ---------------------------------------------------------------------------
console.log('\nSnow phase across elevation');

function nwsLike(tempC: number, precipMm: number, snowfallMm: number): NormalizedForecast {
  const series = emptyHourlySeries();
  for (let i = 0; i < 24; i++) {
    series.time.push(NOW + i * HOUR);
    series.temperatureC.push(tempC);
    series.dewpointC.push(tempC - 2);
    series.humidityPct.push(90);
    series.snowfallMm.push(snowfallMm);
    series.precipMm.push(precipMm);
    series.precipProbPct.push(100);
    series.windSpeedKmh.push(20);
    series.windGustKmh.push(35);
    series.windDirectionDeg.push(270);
    series.cloudCoverPct.push(100);
    series.visibilityM.push(3000);
    series.freezingLevelM.push(1800);
    series.snowDepthCm.push(null);
  }
  return {
    source: 'nws',
    model: 'NDFD',
    elevationM: 1900,
    location: {},
    hourly: series,
    fetchedAt: NOW,
    attribution: 'test',
  };
}

test('rain at the base becomes snow at the summit', () => {
  // +3C at the grid elevation: NWS forecasts 2mm/h of rain and no snow.
  const base = nwsLike(3, 2, 0);
  assert.equal(sumOver(base.hourly.snowfallMm, base.hourly.time, NOW, 24), 0);

  // 900m higher the air is below freezing, so that moisture is snow.
  const summit = applyElevationCorrection(base, 2800);
  const total = sumOver(summit.hourly.snowfallMm, summit.hourly.time, NOW, 24);
  assert.ok(total > 0, 'summit must accumulate snow from the rain forecast');
  // 48mm of water at roughly 10:1 or better.
  assert.ok(total > 300, `expected a substantial total, got ${total}mm`);
});

test('snow at the summit becomes rain at a base above +2C', () => {
  // A grid cell at 1900m forecasting snow at -2C. At 90% humidity the lapse
  // rate is ~5.7C/km, so a base 1200m lower sits near +5C — rain.
  const high = nwsLike(-2, 2, 20);
  const low = applyElevationCorrection(high, 700);
  assert.equal(
    sumOver(low.hourly.snowfallMm, low.hourly.time, NOW, 24),
    0,
    'the three-hour drive to ride a Slurpee: a warm base must not report summit snow'
  );
});

test('snow falling through the freezing level is cut, not zeroed', () => {
  // The in-between case, and the one that used to be reported as full summit
  // snow at the base: -6C aloft corrects to about +0.8C 1200m lower, which is
  // wet snow. Less of it, and heavier — not rain, and not a powder day.
  const high = nwsLike(-6, 2, 20);
  const low = applyElevationCorrection(high, 700);
  const highTotal = sumOver(high.hourly.snowfallMm, high.hourly.time, NOW, 24);
  const lowTotal = sumOver(low.hourly.snowfallMm, low.hourly.time, NOW, 24);
  assert.ok(lowTotal > 0, 'just above freezing is still snow');
  assert.ok(
    lowTotal < highTotal * 0.6,
    `wet snow packs down: expected well under ${highTotal}mm, got ${lowTotal}mm`
  );
});

test("the model's own snow amount survives, rescaled for density", () => {
  // Already snowing at -3C; 400m higher it is colder, so the same moisture
  // makes slightly more snow — but not an order of magnitude more.
  const base = nwsLike(-3, 2, 20);
  const summit = applyElevationCorrection(base, 2400);
  const baseTotal = sumOver(base.hourly.snowfallMm, base.hourly.time, NOW, 24);
  const summitTotal = sumOver(summit.hourly.snowfallMm, summit.hourly.time, NOW, 24);
  assert.ok(summitTotal >= baseTotal, 'colder air should not lose snow');
  assert.ok(
    summitTotal < baseTotal * 2.5,
    `density rescale must stay physical: ${baseTotal} -> ${summitTotal}`
  );
});

test('no precipitation figure leaves snowfall untouched', () => {
  const base = nwsLike(-3, 0, 20);
  base.hourly.precipMm = new Array(24).fill(null);
  const summit = applyElevationCorrection(base, 2800);
  assert.equal(sumOver(summit.hourly.snowfallMm, summit.hourly.time, NOW, 24), 20 * 24);
});

// ---------------------------------------------------------------------------
console.log('\nModel spread');

function withEnsemble(
  a: number,
  b: number,
  hours = 24
): NormalizedForecast {
  const series = emptyHourlySeries();
  for (let i = 0; i < 168; i++) {
    series.time.push(NOW + i * HOUR);
    series.temperatureC.push(-5);
    series.dewpointC.push(-8);
    series.humidityPct.push(90);
    series.snowfallMm.push(i < hours ? (a + b) / 2 : 0);
    series.precipMm.push(0);
    series.precipProbPct.push(80);
    series.windSpeedKmh.push(15);
    series.windGustKmh.push(30);
    series.windDirectionDeg.push(270);
    series.cloudCoverPct.push(80);
    series.visibilityM.push(5000);
    series.freezingLevelM.push(1000);
    series.snowDepthCm.push(100);
  }
  const member = (perHour: number) =>
    series.time.map((_, i) => (i < hours ? perHour : 0));

  return {
    source: 'open-meteo',
    model: 'test',
    elevationM: 2000,
    location: {},
    hourly: series,
    ensemble: [
      { model: 'regional', label: 'Regional', snowfallMm: member(a) },
      { model: 'best_match', label: 'Global', snowfallMm: member(b) },
    ],
    coverage: { snowfallMm: 1 },
    fetchedAt: NOW,
    attribution: 'test',
  };
}

test('agreeing models report a tight range', () => {
  // ~9.5in vs ~10.5in over 24h.
  const derived = deriveConditions(withEnsemble(10, 11), NOW);
  const range = derived.snowRange24h;
  assert.ok(range, 'expected a range');
  assert.equal(range!.models, 2);
  assert.ok(range!.agree, 'a 1in spread on 10in should read as agreement');
});

test('disagreeing models report a wide range', () => {
  // ~2in vs ~16in.
  const derived = deriveConditions(withEnsemble(2, 17), NOW);
  const range = derived.snowRange24h;
  assert.ok(range, 'expected a range');
  assert.ok(!range!.agree, 'a 7x spread must not read as agreement');
  assert.ok(range!.lowIn < range!.highIn);
});

test('a model with no data is dropped rather than counted as zero', () => {
  const forecast = withEnsemble(10, 10);
  // AROME's real shape: present in the ensemble, null throughout.
  forecast.ensemble![0].snowfallMm = new Array(168).fill(null);
  assert.equal(
    deriveConditions(forecast, NOW).snowRange24h,
    null,
    'one answering model is no spread, not a 0-to-10in spread'
  );
});

test('a single-model forecast reports no range at all', () => {
  const forecast = withEnsemble(10, 10);
  delete forecast.ensemble;
  assert.equal(deriveConditions(forecast, NOW).snowRange24h, null);
});

test('zero coverage marks the snow forecast unavailable', () => {
  const forecast = withEnsemble(10, 10);
  forecast.coverage = { snowfallMm: 0 };
  assert.equal(deriveConditions(forecast, NOW).snowForecastAvailable, false);
});

test('a provider without coverage is trusted rather than blanked', () => {
  const forecast = withEnsemble(10, 10);
  delete forecast.coverage;
  assert.equal(deriveConditions(forecast, NOW).snowForecastAvailable, true);
});

// ---------------------------------------------------------------------------
console.log('\nThe planner cannot invent a day');

/** ICON-D2's real shape: 168 timestamps, values only through hour 49. */
function truncated(liveHours: number): NormalizedForecast {
  const series = emptyHourlySeries();
  for (let i = 0; i < 168; i++) {
    const live = i < liveHours;
    series.time.push(NOW + i * HOUR);
    series.temperatureC.push(live ? -4 : null);
    series.dewpointC.push(live ? -7 : null);
    series.humidityPct.push(live ? 85 : null);
    series.snowfallMm.push(live ? 3 : null);
    series.precipMm.push(live ? 0.3 : null);
    series.precipProbPct.push(live ? 80 : null);
    series.windSpeedKmh.push(live ? 30 : null);
    series.windGustKmh.push(live ? 70 : null);
    series.windDirectionDeg.push(live ? 270 : null);
    series.cloudCoverPct.push(live ? 95 : null);
    series.visibilityM.push(live ? 800 : null);
    series.freezingLevelM.push(live ? 1200 : null);
    series.snowDepthCm.push(live ? 120 : null);
  }
  return {
    source: 'open-meteo',
    model: 'truncated',
    elevationM: 2000,
    location: {},
    hourly: series,
    fetchedAt: NOW,
    attribution: 'test',
  };
}

const probeResort = { id: 'x', name: 'Probe', timezone: 'Europe/Vienna' } as Resort;

test('days beyond the model horizon are marked as having no data', () => {
  const outlook = buildOutlook(probeResort, truncated(49), NOW, 7);
  assert.equal(outlook.days.length, 7);
  assert.ok(outlook.days[0].hasData, 'day 1 is inside the horizon');
  assert.ok(outlook.days[1].hasData, 'day 2 is inside the horizon');

  const beyond = outlook.days.slice(3);
  for (const day of beyond) {
    assert.equal(day.hasData, false, `${day.dayKey} has no forecast and must say so`);
  }
});

test('a day with no data is not scored as Fair out of nothing', () => {
  // This is the bug: empty value lists fell back to defaults that all happened
  // to be favourable (32F, no gusts, no cloud), scoring a confident 45.
  const outlook = buildOutlook(probeResort, truncated(49), NOW, 7);
  const lastDay = outlook.days[outlook.days.length - 1];
  assert.equal(lastDay.hasData, false);
  assert.ok(
    lastDay.score < 30,
    `a dataless day must not reach a respectable score, got ${lastDay.score}`
  );
});

test('a dataless day cannot be the recommended best day', () => {
  const outlook = buildOutlook(probeResort, truncated(49), NOW, 7);
  assert.ok(outlook.best, 'a best day should still be picked from the days that exist');
  assert.ok(outlook.best!.hasData, 'the best day must be one that was actually forecast');
});

test('a complete forecast marks every day as having data', () => {
  const outlook = buildOutlook(probeResort, truncated(168), NOW, 7);
  for (const day of outlook.days) {
    assert.ok(day.hasData, `${day.dayKey} should have data`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nGrafting snow depth and history onto NWS');

const realFetch = global.fetch;

function stubOpenMeteo(body: unknown, ok = true) {
  global.fetch = (async () =>
    ({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Server Error',
      json: async () => body,
    }) as unknown as Response) as typeof fetch;
}

/** Open-Meteo shape: 2 days back plus forward, hourly, seconds. */
function supplementBody(startOffsetHours: number, count: number) {
  const time: number[] = [];
  const snowfall: number[] = [];
  const snow_depth: number[] = [];
  const temperature_2m: number[] = [];
  for (let i = 0; i < count; i++) {
    time.push((NOW + (startOffsetHours + i) * HOUR) / 1000);
    snowfall.push(1); // 1cm/h => 10mm/h
    snow_depth.push(1.5); // 1.5m => 150cm
    temperature_2m.push(-4);
  }
  return { hourly: { time, snowfall, snow_depth, temperature_2m } };
}

(async () => {
  await testAsync('snow depth is grafted onto the forecast hours', async () => {
    stubOpenMeteo(supplementBody(-48, 216));
    const forecast = nwsLike(-4, 1, 5);
    assert.equal(forecast.hourly.snowDepthCm[0], null, 'NWS starts with no depth');

    const merged = await withSnowDepthAndHistory(forecast, { lat: 39.2, lon: -120.2 });
    const derived = deriveConditions(merged, NOW);
    assert.equal(derived.snowDepthIn !== null, true, 'base depth must now exist');
    assert.ok(
      Math.abs(derived.snowDepthIn! - 150 / 2.54) < 1,
      `expected ~59in, got ${derived.snowDepthIn}`
    );
  });

  await testAsync('history is prepended and every series stays aligned', async () => {
    stubOpenMeteo(supplementBody(-48, 216));
    const forecast = nwsLike(-4, 1, 5);
    const before = forecast.hourly.time.length;

    const merged = await withSnowDepthAndHistory(forecast, { lat: 39.2, lon: -120.2 });
    const h = merged.hourly;

    assert.equal(h.time.length, before + 48, 'expected 48 past hours');
    for (const key of [
      'temperatureC',
      'snowfallMm',
      'precipMm',
      'windGustKmh',
      'freezingLevelM',
      'snowDepthCm',
      'visibilityM',
      'cloudCoverPct',
    ] as const) {
      assert.equal(
        h[key].length,
        h.time.length,
        `${key} must stay the same length as time, or index i means two things`
      );
    }

    // Ascending, no duplicated hour where the two providers meet.
    for (let i = 1; i < h.time.length; i++) {
      assert.ok(h.time[i] > h.time[i - 1], `time must ascend at index ${i}`);
    }

    const derived = deriveConditions(merged, NOW);
    assert.ok(derived.observedSnow48h !== null, 'observed snow must be known');
    // 48h at 10mm/h = 480mm ≈ 18.9in.
    assert.ok(
      Math.abs(derived.observedSnow48h! - 480 / 25.4) < 0.5,
      `expected ~18.9in observed, got ${derived.observedSnow48h}`
    );
  });

  await testAsync('the forward forecast is not overwritten by the supplement', async () => {
    stubOpenMeteo(supplementBody(-48, 216));
    const forecast = nwsLike(-4, 1, 5);
    const forwardBefore = sumOver(forecast.hourly.snowfallMm, forecast.hourly.time, NOW, 24);

    const merged = await withSnowDepthAndHistory(forecast, { lat: 39.2, lon: -120.2 });
    const forwardAfter = sumOver(merged.hourly.snowfallMm, merged.hourly.time, NOW, 24);
    assert.equal(
      forwardAfter,
      forwardBefore,
      'NWS remains authoritative for the forecast; the graft is history only'
    );
  });

  await testAsync('a failed supplement returns the forecast untouched', async () => {
    stubOpenMeteo({}, false);
    const forecast = nwsLike(-4, 1, 5);
    const merged = await withSnowDepthAndHistory(forecast, { lat: 39.2, lon: -120.2 });
    assert.equal(merged.hourly.time.length, forecast.hourly.time.length);
    assert.equal(deriveConditions(merged, NOW).observedSnow48h, null);
  });

  await testAsync('a thrown supplement does not take the forecast down', async () => {
    global.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    const forecast = nwsLike(-4, 1, 5);
    const merged = await withSnowDepthAndHistory(forecast, { lat: 39.2, lon: -120.2 });
    assert.equal(merged.hourly.time.length, forecast.hourly.time.length);
  });

  global.fetch = realFetch;
  console.log(`\n✅ ${passed} assertions passed\n`);
})();
