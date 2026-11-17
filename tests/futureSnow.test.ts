/**
 * Tests for the Future Snow widget's day grouping.
 *
 * Days must break at the resort's local midnight, not UTC midnight: at a
 * Pacific resort, UTC midnight is 4pm, which used to split one afternoon's
 * storm across "Today" and "Tomorrow".
 */

import { strict as assert } from 'assert';
import { groupByDay } from '../components/FutureSnowWidget';
import type { HourlySnowData } from '../lib/nwsTypes';

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

function hour(iso: string, snowfall = 1): HourlySnowData {
  return {
    time: iso,
    snowfall,
    temperature: 28,
    windSpeed: 10,
    snowQuality: 'Premium Packed',
  } as HourlySnowData;
}

console.log('\n⛷️  Future snow day grouping\n');

const LA = 'America/Los_Angeles';
// 2026-11-17 09:00 PST
const NOW = Date.parse('2026-11-17T17:00:00Z');

test('hours before and after UTC midnight on one local evening share a day', () => {
  const days = groupByDay([hour('2026-11-18T00:00:00Z'), hour('2026-11-18T04:00:00Z')], LA, NOW);
  assert.equal(days.length, 1);
  assert.equal(days[0].dayName, 'Today');
  assert.equal(days[0].date, 'Nov 17');
  assert.equal(days[0].hours.length, 2);
});

test('local midnight starts a new day', () => {
  const days = groupByDay([hour('2026-11-18T07:00:00Z'), hour('2026-11-18T08:00:00Z')], LA, NOW);
  assert.deepEqual(days.map((d) => [d.dayName, d.date, d.hours.length]), [
    ['Today', 'Nov 17', 1],
    ['Tomorrow', 'Nov 18', 1],
  ]);
});

test('later days are named by weekday in the resort timezone', () => {
  const days = groupByDay([hour('2026-11-20T20:00:00Z')], LA, NOW);
  assert.equal(days[0].dayName, 'Friday');
  assert.equal(days[0].date, 'Nov 20');
});

test('the same instant lands on different days in different timezones', () => {
  const h = [hour('2026-11-18T03:00:00Z')];
  assert.equal(groupByDay(h, LA, NOW)[0].date, 'Nov 17');
  assert.equal(groupByDay(h, 'Europe/Paris', NOW)[0].date, 'Nov 18');
});

test('dry days are left out', () => {
  const days = groupByDay([hour('2026-11-17T20:00:00Z', 0), hour('2026-11-18T20:00:00Z', 2)], LA, NOW);
  assert.deepEqual(days.map((d) => d.date), ['Nov 18']);
});

console.log(`\n${passed} passed\n`);
