/**
 * Resort payload validation.
 *
 * resorts.json is fetched at runtime from a static host, so the browser can
 * hand us a copy cached from an older release. A record missing `country`
 * previously reached normalize() and threw inside a render, blanking the whole
 * page. These tests pin the guard.
 *
 *   yarn test:schema
 */

import { strict as assert } from 'assert';
import { sanitizeResort, sanitizeResorts } from '../lib/resortSchema';

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

/** A record in the pre-2.0 schema: no country, regionCode, timezone or passes. */
const LEGACY_RECORD = {
  id: 'northstar-ca',
  name: 'Northstar California',
  state: 'CA',
  region: 'Lake Tahoe',
  base_lat: 39.2704,
  base_lon: -120.1215,
  base_elevation: 6330,
  summit_lat: 39.2766,
  summit_lon: -120.1184,
  summit_elevation: 8610,
  webcam_url: 'https://example.com/cams',
  created_at: '2026-02-18 23:53:07',
};

console.log('\n🛡️  Resort schema validation\n');

// ---------------------------------------------------------------------------
console.log('The crash');

test('a legacy record without country is repaired, not dropped', () => {
  const resort = sanitizeResort(LEGACY_RECORD);
  assert.ok(resort, 'legacy records must survive');
  assert.equal(resort!.country, 'US');
});

test('every field the search reads is a string after sanitizing', () => {
  // score() calls toLowerCase on these. Any undefined here throws in render.
  const resort = sanitizeResort(LEGACY_RECORD)!;
  for (const field of ['name', 'state', 'region', 'country'] as const) {
    assert.equal(typeof resort[field], 'string', `${field} must be a string`);
  }
});

test('a record with no optional fields at all still sanitizes', () => {
  const resort = sanitizeResort({
    id: 'x',
    name: 'Bare Mountain',
    base_lat: 45,
    base_lon: 7,
  });
  assert.ok(resort);
  assert.equal(typeof resort!.state, 'string');
  assert.equal(typeof resort!.region, 'string');
  assert.equal(typeof resort!.country, 'string');
  assert.equal(typeof resort!.timezone, 'string');
  assert.ok(Array.isArray(resort!.passes));
});

// ---------------------------------------------------------------------------
console.log('\nRejecting unusable records');

test('rejects records missing id or name', () => {
  assert.equal(sanitizeResort({ name: 'X', base_lat: 45, base_lon: 7 }), null);
  assert.equal(sanitizeResort({ id: 'x', base_lat: 45, base_lon: 7 }), null);
});

test('rejects records without usable coordinates', () => {
  assert.equal(sanitizeResort({ id: 'x', name: 'X' }), null);
  assert.equal(sanitizeResort({ id: 'x', name: 'X', base_lat: 'north', base_lon: 7 }), null);
  assert.equal(sanitizeResort({ id: 'x', name: 'X', base_lat: NaN, base_lon: 7 }), null);
});

test('rejects out-of-range coordinates', () => {
  assert.equal(sanitizeResort({ id: 'x', name: 'X', base_lat: 200, base_lon: 7 }), null);
  assert.equal(sanitizeResort({ id: 'x', name: 'X', base_lat: 45, base_lon: 999 }), null);
});

test('rejects non-objects without throwing', () => {
  for (const junk of [null, undefined, 'a string', 42, []]) {
    assert.equal(sanitizeResort(junk), null);
  }
});

// ---------------------------------------------------------------------------
console.log('\nInference for legacy records');

test('region is inferred from coordinates', () => {
  const check = (lat: number, lon: number, expected: string) => {
    const resort = sanitizeResort({ id: 'x', name: 'X', base_lat: lat, base_lon: lon })!;
    assert.equal(resort.regionCode, expected, `${lat},${lon}`);
  };

  check(39.27, -120.12, 'us-west'); // Tahoe
  check(39.64, -106.37, 'us-rockies'); // Vail
  check(44.53, -72.78, 'us-east'); // Stowe
  check(45.92, 6.87, 'alps'); // Chamonix
  check(46.54, 11.99, 'dolomites'); // Cortina
  check(42.57, 1.65, 'pyrenees'); // Grandvalira
  check(42.8, 140.69, 'japan'); // Niseko
});

test('an explicit regionCode always wins over inference', () => {
  const resort = sanitizeResort({
    ...LEGACY_RECORD,
    regionCode: 'japan',
  })!;
  assert.equal(resort.regionCode, 'japan');
});

test('an invalid regionCode falls back to inference', () => {
  const resort = sanitizeResort({ ...LEGACY_RECORD, regionCode: 'atlantis' })!;
  assert.equal(resort.regionCode, 'us-west');
});

test('timezone is inferred plausibly', () => {
  const tahoe = sanitizeResort(LEGACY_RECORD)!;
  assert.equal(tahoe.timezone, 'America/Los_Angeles');

  const chamonix = sanitizeResort({ id: 'c', name: 'C', base_lat: 45.92, base_lon: 6.87 })!;
  assert.equal(chamonix.timezone, 'Europe/Paris');

  const niseko = sanitizeResort({ id: 'n', name: 'N', base_lat: 42.8, base_lon: 140.69 })!;
  assert.equal(niseko.timezone, 'Asia/Tokyo');
});

test('summit falls back to base when absent', () => {
  const resort = sanitizeResort({
    id: 'x',
    name: 'X',
    base_lat: 45,
    base_lon: 7,
    base_elevation: 5000,
  })!;
  assert.equal(resort.summit_lat, 45);
  assert.equal(resort.summit_elevation, 5000);
});

// ---------------------------------------------------------------------------
console.log('\nWhole payloads');

test('a mixed payload keeps the good and counts the bad', () => {
  const { resorts, dropped } = sanitizeResorts([
    LEGACY_RECORD,
    { id: 'broken' },
    null,
    { id: 'ok', name: 'OK', base_lat: 46, base_lon: 8 },
    'garbage',
  ]);

  assert.equal(resorts.length, 2);
  assert.equal(dropped, 3);
});

test('a non-array payload yields nothing rather than throwing', () => {
  assert.deepEqual(sanitizeResorts({ oops: true }), { resorts: [], dropped: 0 });
  assert.deepEqual(sanitizeResorts(null), { resorts: [], dropped: 0 });
});

test('the shipped resorts.json passes cleanly', () => {
  const data = require('../public/resorts.json');
  const { resorts, dropped } = sanitizeResorts(data);
  assert.equal(dropped, 0, `${dropped} shipped records failed validation`);
  assert.ok(resorts.length > 500, `expected 500+ resorts, got ${resorts.length}`);
});

console.log(`\n✅ ${passed} assertions passed\n`);
