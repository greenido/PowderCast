/**
 * Elevation handling.
 *
 * The original "Dual-Point Forecasting" feature was close to a placebo:
 * Palisades Tahoe's base (39.1967,-120.2356) and summit (39.1978,-120.2389)
 * both resolve to NWS grid REV 28,94 and returned byte-identical forecasts.
 * These tests pin the fix in both directions — a provider that resolves
 * elevation is left alone, and one that cannot gets a lapse-rate correction.
 *
 *   yarn test:elevation
 */

import { strict as assert } from 'assert';
import { applyElevationCorrection, lapseRateCPerKm } from '../lib/lapseRate';
import { resortPoint, haversineMeters } from '../lib/resortGeo';
import { deriveConditions } from '../lib/conditions';
import type { NormalizedForecast, Resort } from '../lib/types';
import { emptyHourlySeries } from '../lib/types';

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

const HOUR = 3_600_000;
const START = Date.parse('2026-01-15T00:00:00Z');

function forecastAt(elevationM: number | null, tempC = 0, humidity = 70): NormalizedForecast {
  const series = emptyHourlySeries();
  for (let i = 0; i < 48; i++) {
    series.time.push(START + i * HOUR);
    series.temperatureC.push(tempC);
    series.dewpointC.push(tempC - 3);
    series.humidityPct.push(humidity);
    series.snowfallMm.push(0);
    series.precipProbPct.push(0);
    series.windSpeedKmh.push(20);
    series.windGustKmh.push(40);
    series.windDirectionDeg.push(270);
    series.cloudCoverPct.push(50);
    series.visibilityM.push(20000);
    series.freezingLevelM.push(2000);
    series.snowDepthCm.push(50);
  }
  return {
    source: 'nws',
    elevationM,
    location: {},
    hourly: series,
    fetchedAt: START,
    attribution: 'test',
  };
}

console.log('\n⛰️  Elevation handling\n');

// ---------------------------------------------------------------------------
console.log('The original bug');

test('Palisades base and summit are inside one NWS grid cell', () => {
  // ~300m apart. NWS cells are 2.5km, so both land in the same cell and any
  // coordinate-only "dual point" forecast is the same forecast twice.
  const distance = haversineMeters(39.1967, -120.2356, 39.1978, -120.2389);
  assert.ok(distance < 2500, `${distance.toFixed(0)}m apart — same 2.5km cell`);
});

test('resortPoint distinguishes base and summit by elevation', () => {
  const resort: Resort = {
    id: 'x', name: 'X', state: '', region: '', country: 'US',
    regionCode: 'us-west', timezone: 'America/Los_Angeles',
    base_lat: 39.1967, base_lon: -120.2356, base_elevation: 6200,
    summit_lat: 39.1978, summit_lon: -120.2389, summit_elevation: 9050,
    webcam_url: null,
  };

  const base = resortPoint(resort, 'base');
  const summit = resortPoint(resort, 'summit');

  assert.ok(summit.elevationM > base.elevationM + 800, 'elevations must differ materially');
  assert.ok(Math.abs(base.elevationM - 1889) < 5, `6200ft should be ~1889m, got ${base.elevationM.toFixed(0)}`);
});

// ---------------------------------------------------------------------------
console.log('\nLapse rate');

test('humid air cools more slowly with height than dry air', () => {
  assert.ok(
    lapseRateCPerKm(95) < lapseRateCPerKm(20),
    'saturated lapse rate must be shallower than dry'
  );
});

test('lapse rates stay physical', () => {
  for (const humidity of [0, 25, 50, 75, 100, null]) {
    const rate = lapseRateCPerKm(humidity);
    assert.ok(rate >= 4 && rate <= 10, `${rate} °C/km is not a real lapse rate`);
  }
});

test('climbing 1000m cools the air by roughly the lapse rate', () => {
  const valley = forecastAt(1000, 5, 70);
  const summit = applyElevationCorrection(valley, 2000);

  const valleyTemp = valley.hourly.temperatureC[0]!;
  const summitTemp = summit.hourly.temperatureC[0]!;
  const drop = valleyTemp - summitTemp;

  assert.ok(drop > 4 && drop < 10, `expected a 4-10°C drop over 1000m, got ${drop.toFixed(1)}`);
});

test('descending warms the air', () => {
  const summit = forecastAt(3000, -10, 70);
  const base = applyElevationCorrection(summit, 1500);
  assert.ok(base.hourly.temperatureC[0]! > summit.hourly.temperatureC[0]!);
});

test('wind increases with elevation but stays bounded', () => {
  const valley = forecastAt(1000);
  const summit = applyElevationCorrection(valley, 3000);

  const ratio = summit.hourly.windGustKmh[0]! / valley.hourly.windGustKmh[0]!;
  assert.ok(ratio > 1, 'summit wind should exceed valley wind');
  assert.ok(ratio <= 1.8, `${ratio.toFixed(2)}x is beyond the modelled ceiling`);
});

test('a trivial elevation difference is left untouched', () => {
  const original = forecastAt(2000, 0);
  const corrected = applyElevationCorrection(original, 2050);
  assert.equal(corrected, original, 'sub-100m differences are model noise');
});

test('unknown source elevation is left untouched', () => {
  const original = forecastAt(null, 0);
  assert.equal(applyElevationCorrection(original, 3000), original);
});

test('snowfall is not fabricated by the correction', () => {
  // We do not carry liquid-equivalent precipitation, so rain->snow conversion
  // is not attempted. Better to under-report than to invent accumulation.
  const valley = forecastAt(1000, 3, 90);
  const summit = applyElevationCorrection(valley, 2500);
  assert.deepEqual(summit.hourly.snowfallMm, valley.hourly.snowfallMm);
});

test('corrected forecasts are labelled as adjusted', () => {
  const corrected = applyElevationCorrection(forecastAt(1000, 0), 2500);
  assert.ok(
    (corrected.model ?? '').includes('elevation-adjusted'),
    'the UI relies on this label to say the view is modelled'
  );
  assert.equal(corrected.elevationM, 2500);
});

// ---------------------------------------------------------------------------
console.log('\nEnd to end');

test('base and summit produce genuinely different conditions', () => {
  const valley = forecastAt(1889, 2, 70); // Palisades base, 6200ft
  const summit = applyElevationCorrection(valley, 2758); // 9050ft

  const baseConditions = deriveConditions(valley, START);
  const summitConditions = deriveConditions(summit, START);

  assert.notEqual(
    Math.round(baseConditions.currentTemp),
    Math.round(summitConditions.currentTemp),
    'this equality was the original bug'
  );
  assert.ok(
    summitConditions.currentTemp < baseConditions.currentTemp,
    'the summit must be colder'
  );
  assert.ok(
    summitConditions.maxWindGust24h > baseConditions.maxWindGust24h,
    'the summit must be windier'
  );
});

test('a base above freezing can have a summit below it', () => {
  // The case that decides whether it is raining on you: +2°C in the valley,
  // 900m higher it is below freezing and snowing.
  const valley = forecastAt(1500, 2, 85);
  const summit = applyElevationCorrection(valley, 2400);

  assert.ok(valley.hourly.temperatureC[0]! > 0, 'valley above freezing');
  assert.ok(
    summit.hourly.temperatureC[0]! < 0,
    `summit should be below freezing, got ${summit.hourly.temperatureC[0]!.toFixed(1)}°C`
  );
});

console.log(`\n✅ ${passed} assertions passed\n`);
