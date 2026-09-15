/**
 * Tests for "near me" ranking and distance formatting.
 *
 *   yarn test:nearby
 */

import { strict as assert } from 'assert';
import { resortsNear, distanceIndex } from '../lib/nearby';
import { formatDistance } from '../lib/units';
import type { Resort } from '../lib/types';

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

function resort(id: string, lat: number, lon: number): Resort {
  return {
    id,
    name: id,
    state: '',
    region: '',
    country: 'US',
    regionCode: 'us-west',
    timezone: 'America/Los_Angeles',
    base_lat: lat,
    base_lon: lon,
    base_elevation: 6000,
    summit_lat: lat,
    summit_lon: lon,
    summit_elevation: 9000,
    webcam_url: null,
    passes: [],
  };
}

// Real resort coordinates, a rider standing in Truckee, CA.
const truckee = { lat: 39.328, lon: -120.183 };
const resorts = [
  resort('mammoth', 37.651, -119.037),
  resort('palisades', 39.197, -120.235),
  resort('zermatt', 46.02, 7.749),
  resort('northstar', 39.274, -120.121),
];

console.log('\n📍 Nearby\n');

test('ranks resorts nearest first', () => {
  const ids = resortsNear(resorts, truckee).map((n) => n.resort.id);
  assert.deepEqual(ids, ['northstar', 'palisades', 'mammoth', 'zermatt']);
});

test('distances are great-circle kilometres', () => {
  const [northstar, palisades] = resortsNear(resorts, truckee);
  // Northstar is ~8km from Truckee, Palisades ~15km; allow for rounding.
  assert.ok(northstar.distanceKm > 6 && northstar.distanceKm < 10, `${northstar.distanceKm}`);
  assert.ok(palisades.distanceKm > 13 && palisades.distanceKm < 17, `${palisades.distanceKm}`);
});

test('respects the limit', () => {
  assert.equal(resortsNear(resorts, truckee, 2).length, 2);
});

test('indexes distance by resort id', () => {
  const index = distanceIndex(resortsNear(resorts, truckee));
  assert.ok(index.zermatt > 9000);
  assert.equal(Object.keys(index).length, 4);
});

test('distance formats in km or miles, whole numbers', () => {
  assert.equal(formatDistance(42.4, 'metric'), '42 km');
  assert.equal(formatDistance(42.4, 'imperial'), '26 mi');
  assert.equal(formatDistance(1609.344, 'imperial'), '1,000 mi');
});

test('under one unit reads as <1 rather than 0', () => {
  assert.equal(formatDistance(0.4, 'metric'), '<1 km');
  assert.equal(formatDistance(1.2, 'imperial'), '<1 mi');
});

console.log(`\n✅ ${passed} assertions passed\n`);
