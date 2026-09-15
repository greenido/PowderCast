/**
 * Tests for the query-string view state behind deep links and back/forward.
 *
 *   yarn test:url
 */

import { strict as assert } from 'assert';
import {
  DEFAULT_URL_STATE,
  applyUrlState,
  parseUrlState,
  serializeUrlState,
  type AppUrlState,
} from '../lib/urlState';

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

console.log('\n🔗 URL state\n');

test('an empty query is the welcome screen', () => {
  assert.deepEqual(parseUrlState(''), DEFAULT_URL_STATE);
  assert.equal(serializeUrlState(DEFAULT_URL_STATE), '');
});

test('a mountain link round-trips resort and elevation', () => {
  const state = parseUrlState('?resort=palisades-tahoe-olympic-valley-us&elev=summit');
  assert.equal(state.view, 'single');
  assert.equal(state.resortId, 'palisades-tahoe-olympic-valley-us');
  assert.equal(state.elevation, 'summit');
  assert.equal(
    serializeUrlState(state),
    '?resort=palisades-tahoe-olympic-valley-us&elev=summit'
  );
});

test('base elevation is the default and is omitted', () => {
  const state: AppUrlState = { ...DEFAULT_URL_STATE, resortId: 'alta-us' };
  assert.equal(serializeUrlState(state), '?resort=alta-us');
});

test('elevation without a resort is not written', () => {
  assert.equal(serializeUrlState({ ...DEFAULT_URL_STATE, elevation: 'summit' }), '');
});

test('a planner link round-trips view and region', () => {
  const state = parseUrlState('?view=planner&region=alps');
  assert.equal(state.view, 'planner');
  assert.equal(state.region, 'alps');
  assert.equal(serializeUrlState(state), '?view=planner&region=alps');
});

test('favorites comparison uses a lowercase slug in the URL', () => {
  const state = parseUrlState('?view=compare&region=favorites');
  assert.equal(state.region, 'Favorites');
  assert.equal(serializeUrlState(state), '?view=compare&region=favorites');
});

test('the URL describes only the visible view', () => {
  // A shared planner link should not carry whichever resort the sender last
  // opened, and a mountain link should not carry a region.
  const state: AppUrlState = {
    view: 'planner',
    resortId: 'alta-us',
    elevation: 'summit',
    region: 'japan',
  };
  assert.equal(serializeUrlState(state), '?view=planner&region=japan');
  assert.equal(
    serializeUrlState({ ...state, view: 'single' }),
    '?resort=alta-us&elev=summit'
  );
});

test('unknown views, regions and malformed ids fall back to defaults', () => {
  assert.equal(parseUrlState('?view=map').view, 'single');
  assert.equal(parseUrlState('?view=compare&region=mars').region, 'us-west');
  assert.equal(parseUrlState('?resort=../../etc').resortId, null);
  assert.equal(parseUrlState('?resort=' + 'a'.repeat(200)).resortId, null);
});

test('back to a mountain keeps the region the planner was showing', () => {
  const inPlanner: AppUrlState = {
    view: 'planner',
    resortId: 'alta-us',
    elevation: 'base',
    region: 'alps',
  };
  const back = applyUrlState(inPlanner, '?resort=alta-us');
  assert.equal(back.view, 'single');
  assert.equal(back.region, 'alps');
});

test('forward to the planner keeps the resort in memory', () => {
  const onMountain: AppUrlState = {
    view: 'single',
    resortId: 'alta-us',
    elevation: 'summit',
    region: 'us-rockies',
  };
  const forward = applyUrlState(onMountain, '?view=planner&region=alps');
  assert.equal(forward.view, 'planner');
  assert.equal(forward.region, 'alps');
  assert.equal(forward.resortId, 'alta-us');
  assert.equal(forward.elevation, 'summit');
});

test('back to the bare URL clears the resort', () => {
  const onMountain: AppUrlState = { ...DEFAULT_URL_STATE, resortId: 'alta-us' };
  assert.equal(applyUrlState(onMountain, '').resortId, null);
});

console.log(`\n✅ ${passed} assertions passed\n`);
