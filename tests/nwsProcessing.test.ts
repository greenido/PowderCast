/**
 * Unit tests for NWS gridpoint processing.
 *
 * These run against synthetic data plus a captured real-API fixture — no
 * network. Every case here corresponds to a bug that shipped, so please add a
 * case rather than loosening one.
 *
 *   yarn test:processing
 */

import { strict as assert } from 'assert';
import {
  parseDurationMs,
  toIntervals,
  sumAccumulationForward,
  getMaxForward,
  getAverageForward,
  getRangeForward,
  getValueAt,
  getSnowWeightedTempC,
  buildHourlyBuckets,
} from '../lib/nwsProcessing';
import { mmToInches, cmToInches } from '../lib/unitConversion';
import { determineSnowQuality } from '../lib/snowLogic';

const HOUR = 3_600_000;
const T0 = Date.parse('2026-01-15T12:00:00Z');

function iso(offsetHours: number): string {
  return new Date(T0 + offsetHours * HOUR).toISOString();
}

/** Build an NWS-shaped value list: [startHourOffset, durationHours, value] */
function series(entries: Array<[number, number, number | null]>) {
  return entries.map(([offset, duration, value]) => ({
    validTime: `${iso(offset)}/PT${duration}H`,
    value,
  }));
}

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

console.log('\n🧪 NWS processing\n');

// ---------------------------------------------------------------------------
console.log('Duration parsing');

test('parses PT6H', () => assert.equal(parseDurationMs('PT6H'), 6 * HOUR));
test('parses PT1H', () => assert.equal(parseDurationMs('PT1H'), HOUR));
test('parses PT30M', () => assert.equal(parseDurationMs('PT30M'), 30 * 60_000));
test('parses P1D', () => assert.equal(parseDurationMs('P1D'), 24 * HOUR));
test('parses P1DT12H', () => assert.equal(parseDurationMs('P1DT12H'), 36 * HOUR));
test('falls back to 1h on garbage', () => assert.equal(parseDurationMs('nonsense'), HOUR));

test('toIntervals drops nulls and sorts', () => {
  const intervals = toIntervals(series([[6, 1, 5], [0, 1, null], [3, 1, 2]]));
  assert.equal(intervals.length, 2);
  assert.equal(intervals[0].value, 2);
  assert.equal(intervals[1].value, 5);
});

// ---------------------------------------------------------------------------
console.log('\nSnowfall units — the 10x regression');

test('NWS snowfall is millimetres, not centimetres', () => {
  // 50mm of snow is ~2 inches. Treating it as cm yields ~19.7" — the bug that
  // made every Powder Alert fire.
  assert.ok(Math.abs(mmToInches(50) - 1.9685) < 0.001, 'mmToInches(50) should be ~1.97"');
  assert.ok(cmToInches(50) > 19, 'cmToInches(50) is ~19.7" — wrong for NWS data');
});

test('24h snow total converts to a realistic inch value', () => {
  // Four PT6H blocks of 25mm = 100mm = ~3.9 inches.
  const snow = series([[0, 6, 25], [6, 6, 25], [12, 6, 25], [18, 6, 25]]);
  const inches = mmToInches(sumAccumulationForward(snow, T0, 24));
  assert.ok(Math.abs(inches - 3.937) < 0.01, `expected ~3.94", got ${inches.toFixed(2)}"`);
});

// ---------------------------------------------------------------------------
console.log('\nInterval proration');

test('a PT6H block straddling the window edge is prorated', () => {
  // One 60mm block covering hours 22-28. Only 2 of its 6 hours land inside a
  // 24h window, so it should contribute 20mm, not 60mm.
  const snow = series([[22, 6, 60]]);
  assert.equal(sumAccumulationForward(snow, T0, 24), 20);
});

test('a block fully inside the window contributes in full', () => {
  assert.equal(sumAccumulationForward(series([[6, 6, 60]]), T0, 24), 60);
});

test('a block entirely outside the window contributes nothing', () => {
  assert.equal(sumAccumulationForward(series([[48, 6, 60]]), T0, 24), 0);
});

test('7-day total exceeds 24h total for a multi-day storm', () => {
  const snow = series(
    Array.from({ length: 28 }, (_, i) => [i * 6, 6, 10] as [number, number, number])
  );
  const day = sumAccumulationForward(snow, T0, 24);
  const week = sumAccumulationForward(snow, T0, 168);
  assert.ok(week > day * 5, `7-day (${week}) should dwarf 24h (${day})`);
});

// ---------------------------------------------------------------------------
console.log('\nForward windows (the API has no history)');

test('getMaxForward reads ahead, not behind', () => {
  // Gusts ramp up tomorrow. A backward-looking window would miss this entirely.
  const gusts = series([[0, 3, 20], [12, 3, 40], [21, 3, 95]]);
  assert.equal(getMaxForward(gusts, T0, 24), 95);
});

test('getMaxForward ignores intervals that ended before now', () => {
  const gusts = series([[-12, 3, 200], [3, 3, 30]]);
  assert.equal(getMaxForward(gusts, T0, 24), 30);
});

test('getAverageForward weights by interval duration', () => {
  // 6 hours at 10 and 2 hours at 50 → (6*10 + 2*50) / 8 = 20, not 30.
  const wind = series([[0, 6, 10], [6, 2, 50]]);
  assert.equal(getAverageForward(wind, T0, 8), 20);
});

test('getRangeForward returns min and max', () => {
  const temps = series([[0, 1, -12], [1, 1, -4], [2, 1, -18]]);
  assert.deepEqual(getRangeForward(temps, T0, 24), { min: -18, max: -4 });
});

test('empty series yields null, not a misleading zero', () => {
  assert.equal(getMaxForward([], T0, 24), null);
  assert.equal(getAverageForward(undefined, T0, 24), null);
  assert.equal(getRangeForward([], T0, 24), null);
});

// ---------------------------------------------------------------------------
console.log('\nCurrent conditions freshness');

test('getValueAt reads the interval covering now, not values[0]', () => {
  // Series starts at 12:00Z; "now" is 21:00Z. values[0] would report 5 mph
  // when the wind is actually gusting 60.
  const gusts = series([[0, 3, 5], [3, 3, 10], [6, 3, 15], [9, 3, 60]]);
  assert.equal(getValueAt(gusts, T0 + 9.5 * HOUR), 60);
});

test('getValueAt snaps to the nearest interval when nothing covers now', () => {
  const gusts = series([[6, 3, 42]]);
  assert.equal(getValueAt(gusts, T0), 42);
});

test('getValueAt on an empty series returns null', () => {
  assert.equal(getValueAt([], T0), null);
});

// ---------------------------------------------------------------------------
console.log('\nSnow quality classification');

test('snow-weighted temp comes back in Celsius', () => {
  // Snow falls only in the cold block. The warm, dry afternoon must not drag
  // the classification temperature upward.
  const snow = series([[0, 6, 40], [6, 6, 0], [12, 6, 0]]);
  const temps = series([[0, 6, -14], [6, 6, 2], [12, 6, 6]]);
  const result = getSnowWeightedTempC(snow, temps, T0, 24);
  assert.equal(result, -14);
});

test('snow-weighted temp is null when no snow is forecast', () => {
  const snow = series([[0, 6, 0], [6, 6, 0]]);
  const temps = series([[0, 6, -14], [6, 6, -10]]);
  assert.equal(getSnowWeightedTempC(snow, temps, T0, 24), null);
});

test('a Celsius value must never reach determineSnowQuality directly', () => {
  // -14°C is 7°F — genuinely Champagne Powder. But +12°C is 54°F, which is
  // rain. Passing raw Celsius classified both as Champagne Powder.
  assert.equal(determineSnowQuality(7), 'Champagne Powder');
  assert.equal(determineSnowQuality(54), 'Mashtatoes/Slush');
  assert.equal(
    determineSnowQuality(12),
    'Champagne Powder',
    'raw Celsius 12 misclassifies — hence the conversion at the call site'
  );
});

test('warm wet storm classifies as Sierra Cement, not powder', () => {
  const snow = series([[0, 6, 40]]);
  const temps = series([[0, 6, -0.5]]); // -0.5°C = 31°F
  const tempC = getSnowWeightedTempC(snow, temps, T0, 24)!;
  const tempF = (tempC * 9) / 5 + 32;
  assert.equal(determineSnowQuality(tempF), 'Sierra Cement');
});

// ---------------------------------------------------------------------------
console.log('\nHourly bucketing');

test('a PT6H block spreads across all six hours', () => {
  const snow = series([[0, 6, 60]]);
  const buckets = buildHourlyBuckets(snow, [], [], T0, 8);
  const withSnow = buckets.filter((b) => b.snowfallIn > 0);
  assert.equal(withSnow.length, 6, 'all six hours should show snow');
  // 60mm / 6h = 10mm/h = 0.39"
  assert.ok(Math.abs(withSnow[0].snowfallIn - 0.39) < 0.01);
});

test('hourly totals reconcile with the window total', () => {
  const snow = series([[0, 6, 30], [6, 6, 45], [12, 6, 15]]);
  const buckets = buildHourlyBuckets(snow, [], [], T0, 24);
  const hourlySum = buckets.reduce((acc, b) => acc + b.snowfallIn, 0);
  const windowTotal = mmToInches(sumAccumulationForward(snow, T0, 24));

  // Each bucket is rounded to 2dp for display, so the sum can drift by up to
  // half a cent of an inch per bucket. Anything beyond that is a real error.
  const roundingBudget = buckets.length * 0.005;
  assert.ok(
    Math.abs(hourlySum - windowTotal) <= roundingBudget,
    `hourly sum ${hourlySum.toFixed(2)} vs window ${windowTotal.toFixed(2)} ` +
      `(budget ${roundingBudget.toFixed(2)})`
  );
});

test('hourly temps are converted to Fahrenheit', () => {
  const temps = series([[0, 1, 0]]); // 0°C
  const buckets = buildHourlyBuckets([], temps, [], T0, 1);
  assert.equal(buckets[0].temperatureF, 32);
});

test('hourly winds are converted to mph', () => {
  const wind = series([[0, 1, 100]]); // 100 km/h
  const buckets = buildHourlyBuckets([], [], wind, T0, 1);
  assert.equal(buckets[0].windSpeedMph, 62);
});

// ---------------------------------------------------------------------------
console.log('\nReal captured API fixture');

const fixture = require('./fixtures/nws-gridpoint-REV-28-94.json');
const fx = fixture.properties;
const fixtureStart = Date.parse(fx.snowfallAmount.values[0].validTime.split('/')[0]);

test('fixture confirms snowfallAmount is reported in mm', () => {
  assert.equal(fx.snowfallAmount.uom, 'wmoUnit:mm');
});

test('fixture confirms temperature is reported in degC', () => {
  assert.equal(fx.temperature.uom, 'wmoUnit:degC');
});

test('fixture confirms wind is reported in km/h', () => {
  assert.equal(fx.windGust.uom, 'wmoUnit:km_h-1');
});

test('fixture snowfall arrives in multi-hour blocks', () => {
  const durations = fx.snowfallAmount.values.map(
    (v: { validTime: string }) => v.validTime.split('/')[1]
  );
  assert.ok(
    durations.some((d: string) => d !== 'PT1H'),
    'blocks are not hourly — proration is required'
  );
});

test('fixture processes without throwing and yields sane magnitudes', () => {
  const snowIn = mmToInches(sumAccumulationForward(fx.snowfallAmount.values, fixtureStart, 24));
  assert.ok(snowIn >= 0 && snowIn < 60, `24h snow ${snowIn}" should be physically plausible`);

  const gustKmh = getMaxForward(fx.windGust.values, fixtureStart, 24);
  assert.ok(gustKmh === null || (gustKmh >= 0 && gustKmh < 300), 'gusts plausible');

  const range = getRangeForward(fx.temperature.values, fixtureStart, 24);
  assert.ok(range !== null && range.min <= range.max, 'temp range ordered');
});

console.log(`\n✅ ${passed} assertions passed\n`);
