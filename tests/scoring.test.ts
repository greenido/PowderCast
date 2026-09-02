/**
 * Unified condition scoring.
 *
 * The point of this suite is the cross-view consistency block: the comparison
 * view and the planner previously scored the same day 55 "Fair Groomers" and
 * 43 "Marginal" respectively, because each had its own implementation.
 *
 *   yarn test:scoring
 */

import { strict as assert } from 'assert';
import { scoreConditions, scoreLabel } from '../lib/scoring';
import { calculateRideScore, getRideScoreLabel } from '../lib/rideScore';
import { buildOutlook, scoreTone } from '../lib/planner';
import { emptyHourlySeries } from '../lib/types';
import { determineSnowQuality } from '../lib/snowLogic';
import type { NormalizedForecast, Resort } from '../lib/types';
import type { ProcessedWeatherData } from '../lib/nwsTypes';

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

console.log('\n🏆 Condition scoring\n');

// ---------------------------------------------------------------------------
console.log('Component weighting');

const CALM_CLEAR = { maxGustMph: 5, cloudPct: 5, tempF: 22 };

test('more snow always scores at least as high', () => {
  let previous = -1;
  for (const snowIn of [0, 0.5, 1, 2, 4, 6, 8, 12, 24]) {
    const { score } = scoreConditions({
      ...CALM_CLEAR,
      snowIn,
      snowQuality: 'Champagne Powder',
    });
    assert.ok(score >= previous, `${snowIn}" scored ${score}, below the previous ${previous}`);
    previous = score;
  }
});

test('more wind never scores higher', () => {
  let previous = 101;
  for (const maxGustMph of [0, 20, 25, 35, 40, 45, 55, 80]) {
    const { score } = scoreConditions({
      snowIn: 8,
      snowQuality: 'Champagne Powder',
      cloudPct: 50,
      tempF: 22,
      maxGustMph,
    });
    assert.ok(score <= previous, `${maxGustMph}mph scored ${score}, above the previous ${previous}`);
    previous = score;
  }
});

test('a wind-hold day loses more than a cloudy day', () => {
  const base = { snowIn: 8, snowQuality: 'Champagne Powder' as const, tempF: 22 };
  const windy = scoreConditions({ ...base, maxGustMph: 55, cloudPct: 5 }).score;
  const cloudy = scoreConditions({ ...base, maxGustMph: 5, cloudPct: 100 }).score;
  assert.ok(windy < cloudy, `wind ${windy} should cost more than cloud ${cloudy}`);
});

test('quality counts for less when there is no new snow', () => {
  const withSnow = scoreConditions({
    ...CALM_CLEAR,
    snowIn: 6,
    snowQuality: 'Champagne Powder',
  });
  const without = scoreConditions({
    ...CALM_CLEAR,
    snowIn: 0,
    snowQuality: 'Champagne Powder',
  });
  assert.ok(withSnow.quality > without.quality);
});

test('scores stay inside 0-100 across the input space', () => {
  for (const snowIn of [0, 3, 12, 40]) {
    for (const maxGustMph of [0, 30, 60, 120]) {
      for (const tempF of [-30, 20, 40, 80]) {
        for (const cloudPct of [0, 50, 100]) {
          const { score } = scoreConditions({
            snowIn,
            snowQuality: 'Premium Packed',
            maxGustMph,
            cloudPct,
            tempF,
          });
          assert.ok(score >= 0 && score <= 100, `got ${score}`);
        }
      }
    }
  }
});

test('a perfect day reaches 100 and a dire one bottoms out', () => {
  const perfect = scoreConditions({
    snowIn: 14,
    snowQuality: 'Champagne Powder',
    maxGustMph: 5,
    cloudPct: 10,
    tempF: 24,
  });
  assert.equal(perfect.score, 100);

  const dire = scoreConditions({
    snowIn: 0,
    snowQuality: 'Ice Coast',
    maxGustMph: 70,
    cloudPct: 100,
    tempF: 60,
  });
  // Not zero: full overcast still floors at 4 sky points, because a grey sky
  // on its own is not a reason to stay home. Everything else zeroes out.
  assert.ok(dire.score <= 5, `dire day scored ${dire.score}`);
  assert.equal(scoreLabel(dire.score).short, 'Poor');
});

test('a sum that rounds to a threshold is scored at that threshold', () => {
  // 24 hourly values of 12.7mm sum to 11.999999999999996 inches. The card
  // rounds that to 12.0"; the score must not silently use the band below.
  assert.equal(
    scoreConditions({ ...CALM_CLEAR, snowIn: 11.999999999999996, snowQuality: 'Champagne Powder' }).snow,
    scoreConditions({ ...CALM_CLEAR, snowIn: 12, snowQuality: 'Champagne Powder' }).snow
  );
});

test('breakdown components sum to the score', () => {
  const b = scoreConditions({
    snowIn: 5,
    snowQuality: 'Premium Packed',
    maxGustMph: 30,
    cloudPct: 40,
    tempF: 25,
  });
  assert.equal(b.snow + b.quality + b.wind + b.visibility + b.temperature, b.score);
});

test('omitted visibility costs nothing', () => {
  const inputs = {
    snowIn: 4,
    snowQuality: 'Premium Packed' as const,
    maxGustMph: 10,
    cloudPct: 20,
    tempF: 25,
  };
  assert.equal(
    scoreConditions(inputs).score,
    scoreConditions({ ...inputs, visibilityM: 30000 }).score,
    'the planner has no visibility figure and must not be penalised for it'
  );
});

test('poor visibility does cost when it is known', () => {
  const inputs = {
    snowIn: 4,
    snowQuality: 'Premium Packed' as const,
    maxGustMph: 10,
    cloudPct: 20,
    tempF: 25,
  };
  assert.ok(
    scoreConditions({ ...inputs, visibilityM: 500 }).score <
      scoreConditions({ ...inputs, visibilityM: 30000 }).score
  );
});

// ---------------------------------------------------------------------------
console.log('\nLabels');

test('bands are ordered and total coverage is complete', () => {
  const seen = new Set<string>();
  for (let score = 0; score <= 100; score++) {
    const label = scoreLabel(score);
    assert.ok(label.label && label.short && label.summary, `score ${score} has an incomplete label`);
    seen.add(label.short);
  }
  assert.deepEqual([...seen].sort(), ['Epic', 'Fair', 'Great', 'Marginal', 'Poor']);
});

test('the summary describes the score rather than being fixed text', () => {
  assert.notEqual(scoreLabel(95).summary, scoreLabel(10).summary);
});

// ---------------------------------------------------------------------------
console.log('\nCross-view consistency — the regression this replaces');

function conditions(overrides: Partial<ProcessedWeatherData> = {}): ProcessedWeatherData {
  return {
    currentTemp: 22,
    currentWindSpeed: 5,
    currentWindGust: 8,
    currentWindDirection: null,
    currentVisibility: 30000,
    currentSkyCover: 10,
    currentHumidity: 40,
    currentDewpoint: 10,
    snow24h: 0,
    snow48h: 0,
    snow7day: 0,
    maxWindGust24h: 10,
    maxWindGust7day: 15,
    avgWindSpeed: 5,
    maxTemp24h: 22,
    minTemp24h: 15,
    maxPrecipProb24h: 0,
    freezingLevelFt: null,
    snowDepthIn: null,
    snowQuality: 'Premium Packed',
    windHoldRisk: false,
    frostbiteRisk: false,
    bluebirdDay: true,
    powderAlert: false,
    precipTemp: null,
    windChill: 22,
    hourlySnowForecast: [],
    periods: [],
    source: 'nws',
    attribution: 'test',
    gridDataUrl: '',
    forecastElevationFt: 8000,
    ...overrides,
  } as ProcessedWeatherData;
}

const HOUR = 3_600_000;
const START = Date.parse('2026-01-15T00:00:00Z');

const resort: Resort = {
  id: 't',
  name: 'T',
  state: '',
  region: '',
  country: 'US',
  regionCode: 'us-west',
  timezone: 'UTC',
  base_lat: 39,
  base_lon: -120,
  base_elevation: 6000,
  summit_lat: 39,
  summit_lon: -120,
  summit_elevation: 9000,
  webcam_url: null,
};

function forecastOf(snowMmPerHour: number, tempC: number, gustKmh: number, cloud: number) {
  const s = emptyHourlySeries();
  for (let i = 0; i < 168; i++) {
    s.time.push(START + i * HOUR);
    s.snowfallMm.push(snowMmPerHour);
    s.temperatureC.push(tempC);
    s.windGustKmh.push(gustKmh);
    s.cloudCoverPct.push(cloud);
  }
  const f: NormalizedForecast = {
    source: 'nws',
    elevationM: 2000,
    location: {},
    hourly: s,
    fetchedAt: START,
    attribution: 'test',
  };
  return f;
}

test('both views score identical conditions identically', () => {
  // 22°F, no new snow, 10mph gusts, 10% cloud — the exact case that produced
  // 55 "Fair Groomers" in Compare and 43 "Marginal" in the Planner.
  const compare = calculateRideScore(
    conditions({ snow24h: 0, maxWindGust24h: 10, currentSkyCover: 10, currentTemp: 22 })
  ).score;

  const planner = buildOutlook(resort, forecastOf(0, -5.5, 16, 10), START, 7).days[0].score;

  assert.equal(
    compare,
    planner,
    `Compare scored ${compare}, Planner scored ${planner} — they must agree`
  );
});

test('both views agree on a powder day too', () => {
  // 12.7mm/h over 24h is 12 inches, at -6.7°C = 19.94°F. The planner derives
  // its quality from that temperature, so the comparison view is given the
  // same classification rather than a hand-picked one.
  const compare = calculateRideScore(
    conditions({
      snow24h: 12,
      snowQuality: determineSnowQuality(19.94),
      maxWindGust24h: 9.94,
      currentSkyCover: 60,
      currentTemp: 19.94,
    })
  ).score;

  const planner = buildOutlook(resort, forecastOf(12.7, -6.7, 16, 60), START, 7).days[0].score;

  assert.equal(
    compare,
    planner,
    `Compare ${compare} vs Planner ${planner} — they must agree`
  );
});

test('both views use the same label vocabulary', () => {
  for (const score of [10, 35, 50, 70, 90]) {
    assert.equal(
      getRideScoreLabel(score).short,
      scoreTone(score).label,
      `label mismatch at ${score}`
    );
  }
});

console.log(`\n✅ ${passed} assertions passed\n`);
