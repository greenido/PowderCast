/**
 * Tests for guessing a rider's home range from their time zone.
 *
 *   yarn test regions
 */

import { strict as assert } from 'assert';
import { regionForTimezone } from '../lib/regions';
import type { RegionCode } from '../lib/types';

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

console.log('\n🧭 Home region guess\n');

const ALL: RegionCode[] = ['us-west', 'us-rockies', 'us-east', 'alps', 'dolomites', 'pyrenees', 'japan'];

test('US time zones map to their ranges', () => {
  assert.equal(regionForTimezone('America/Los_Angeles', ALL), 'us-west');
  assert.equal(regionForTimezone('America/Denver', ALL), 'us-rockies');
  assert.equal(regionForTimezone('America/New_York', ALL), 'us-east');
  assert.equal(regionForTimezone('America/Indiana/Indianapolis', ALL), 'us-east');
});

test('European zones pick the nearest range, the Alps by default', () => {
  assert.equal(regionForTimezone('Europe/Zurich', ALL), 'alps');
  assert.equal(regionForTimezone('Europe/London', ALL), 'alps');
  assert.equal(regionForTimezone('Europe/Rome', ALL), 'dolomites');
  assert.equal(regionForTimezone('Europe/Madrid', ALL), 'pyrenees');
});

test('Japan maps to Japan', () => {
  assert.equal(regionForTimezone('Asia/Tokyo', ALL), 'japan');
});

test('a guess with no resorts falls back to the first available region', () => {
  // Scandinavia is forecast-ready but has no resorts yet.
  assert.equal(regionForTimezone('Europe/Oslo', ALL), 'us-west');
  // A pass filter can empty the guessed region.
  assert.equal(regionForTimezone('Asia/Tokyo', ['us-rockies', 'alps']), 'us-rockies');
});

test('an unknown or missing zone falls back, and no regions gives null', () => {
  assert.equal(regionForTimezone('Antarctica/Troll', ALL), 'us-west');
  assert.equal(regionForTimezone(undefined, ['alps']), 'alps');
  assert.equal(regionForTimezone('Europe/Zurich', []), null);
});

console.log(`\n✅ ${passed} assertions passed\n`);
