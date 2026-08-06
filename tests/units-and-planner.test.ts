/**
 * Tests for unit formatting, region vocabulary and the day planner.
 *
 *   yarn test:units
 */

import { strict as assert } from 'assert';
import {
  formatSnow,
  formatTemp,
  formatWind,
  formatElevation,
  formatVisibility,
  defaultUnitsForCountry,
} from '../lib/units';
import { snowLabel, detectFirnWindow } from '../lib/snowVocabulary';
import { buildOutlook, rankOutlooks, scoreTone } from '../lib/planner';
import { degreesToCompass, windLoadedAspects, haversineMeters } from '../lib/resortGeo';
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

console.log('\n🌍 Units, vocabulary and planning\n');

// ---------------------------------------------------------------------------
console.log('Unit formatting');

test('temperature converts to Celsius for metric', () => {
  assert.equal(formatTemp(32, 'metric'), '0°C');
  assert.equal(formatTemp(32, 'imperial'), '32°F');
  assert.equal(formatTemp(14, 'metric'), '-10°C');
});

test('snowfall converts inches to centimetres', () => {
  // 12 inches is 30.48cm — a proper powder day either way.
  assert.equal(formatSnow(12, 'metric'), '30 cm');
  assert.equal(formatSnow(12, 'imperial'), '12"');
});

test('small snowfall keeps a decimal in metric', () => {
  // The gap between 2cm and 20cm decides the day; do not round it away.
  assert.equal(formatSnow(1, 'metric'), '2.5 cm');
  assert.equal(formatSnow(0.1, 'metric'), '0.3 cm');
});

test('zero snowfall reads as zero, not a rounding artifact', () => {
  assert.equal(formatSnow(0, 'metric'), '0 cm');
  assert.equal(formatSnow(0, 'imperial'), '0"');
});

test('wind converts mph to km/h', () => {
  assert.equal(formatWind(60, 'metric'), '97 km/h');
  assert.equal(formatWind(60, 'imperial'), '60 mph');
});

test('elevation converts feet to metres', () => {
  assert.equal(formatElevation(10000, 'metric'), '3,048 m');
  assert.equal(formatElevation(10000, 'imperial'), '10,000 ft');
});

test('visibility converts from metres to the right unit', () => {
  assert.equal(formatVisibility(1609, 'imperial'), '1.0 mi');
  assert.equal(formatVisibility(5000, 'metric'), '5.0 km');
  assert.equal(formatVisibility(50000, 'metric'), '16+ km');
});

test('country defaults put the US on imperial and everyone else on metric', () => {
  assert.equal(defaultUnitsForCountry('US'), 'imperial');
  assert.equal(defaultUnitsForCountry('CH'), 'metric');
  assert.equal(defaultUnitsForCountry('JP'), 'metric');
  assert.equal(defaultUnitsForCountry('AD'), 'metric');
  assert.equal(defaultUnitsForCountry(undefined), 'metric');
});

// ---------------------------------------------------------------------------
console.log('\nRegional snow vocabulary');

test('US regions keep the original slang', () => {
  assert.equal(snowLabel('Sierra Cement', 'us-west').label, 'Sierra Cement');
});

test('Alpine regions get Alpine terms, not Tahoe jokes', () => {
  const alpine = snowLabel('Sierra Cement', 'alps');
  assert.notEqual(alpine.label, 'Sierra Cement');
  assert.equal(alpine.localTerm, 'Pappschnee');

  assert.equal(snowLabel('Mashtatoes/Slush', 'dolomites').localTerm, 'Sulz');
  assert.equal(snowLabel('Champagne Powder', 'alps').localTerm, 'Pulverschnee');
});

test('Japan gets its own vocabulary', () => {
  assert.equal(snowLabel('Champagne Powder', 'japan').label, 'JaPow');
});

test('an unknown region falls back rather than throwing', () => {
  assert.ok(snowLabel('Ice Coast', undefined).label);
});

test('every quality resolves in every region', () => {
  const qualities = [
    'Champagne Powder',
    'Premium Packed',
    'Sierra Cement',
    'Mashtatoes/Slush',
    'Ice Coast',
  ] as const;
  const regions = ['us-west', 'alps', 'dolomites', 'japan', 'pyrenees'] as const;

  for (const region of regions) {
    for (const quality of qualities) {
      const label = snowLabel(quality, region);
      assert.ok(label.label && label.description, `${region}/${quality} incomplete`);
    }
  }
});

// ---------------------------------------------------------------------------
console.log('\nFirn / spring corn detection');

function dayCycle(overnightF: number, dayF: number) {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    temperature: hour >= 9 && hour <= 16 ? dayF : overnightF,
  }));
}

test('detects a freeze-thaw cycle', () => {
  const result = detectFirnWindow(dayCycle(25, 45));
  assert.equal(result.isFirn, true);
  assert.ok(result.description.length > 0);
});

test('no firn when it never freezes overnight', () => {
  assert.equal(detectFirnWindow(dayCycle(38, 50)).isFirn, false);
});

test('no firn when it never thaws during the day', () => {
  assert.equal(detectFirnWindow(dayCycle(5, 20)).isFirn, false);
});

test('no firn from too little data', () => {
  assert.equal(detectFirnWindow([{ hour: 10, temperature: 40 }]).isFirn, false);
});

// ---------------------------------------------------------------------------
console.log('\nWind aspect');

test('compass conversion is correct at the cardinals', () => {
  assert.equal(degreesToCompass(0), 'N');
  assert.equal(degreesToCompass(90), 'E');
  assert.equal(degreesToCompass(180), 'S');
  assert.equal(degreesToCompass(270), 'W');
  assert.equal(degreesToCompass(360), 'N');
});

test('lee aspects are opposite the wind origin', () => {
  // A north wind strips north-facing slopes and loads south-facing ones.
  const { loaded, scoured } = windLoadedAspects(0);
  assert.ok(loaded.includes('S'), `expected S in loaded, got ${loaded}`);
  assert.ok(scoured.includes('N'), `expected N in scoured, got ${scoured}`);
});

test('loaded and scoured never overlap', () => {
  for (const degrees of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const { loaded, scoured } = windLoadedAspects(degrees);
    const overlap = loaded.filter((a) => scoured.includes(a));
    assert.equal(overlap.length, 0, `overlap at ${degrees}°: ${overlap}`);
  }
});

test('haversine gives a sane distance', () => {
  // Alta to Snowbird is roughly 1.5km.
  const distance = haversineMeters(40.5883, -111.6378, 40.5833, -111.655);
  assert.ok(distance > 1000 && distance < 2500, `got ${distance.toFixed(0)}m`);
});

// ---------------------------------------------------------------------------
console.log('\nDay planner');

const HOUR = 3_600_000;
const START = Date.parse('2026-01-15T00:00:00Z');

function syntheticForecast(
  hourly: (i: number) => { snowMm: number; tempC: number; gustKmh: number; cloud: number }
): NormalizedForecast {
  const series = emptyHourlySeries();
  for (let i = 0; i < 168; i++) {
    const v = hourly(i);
    series.time.push(START + i * HOUR);
    series.snowfallMm.push(v.snowMm);
    series.temperatureC.push(v.tempC);
    series.windGustKmh.push(v.gustKmh);
    series.cloudCoverPct.push(v.cloud);
  }
  return {
    source: 'open-meteo',
    elevationM: 2500,
    location: {},
    hourly: series,
    fetchedAt: START,
    attribution: 'test',
  };
}

const testResort: Resort = {
  id: 'test',
  name: 'Test Mountain',
  state: 'Test',
  region: 'Test',
  country: 'CH',
  regionCode: 'alps',
  timezone: 'UTC',
  base_lat: 46,
  base_lon: 7,
  base_elevation: 5000,
  summit_lat: 46,
  summit_lon: 7,
  summit_elevation: 10000,
  webcam_url: null,
};

test('a powder day outscores a dry day', () => {
  const powder = buildOutlook(
    testResort,
    syntheticForecast(() => ({ snowMm: 15, tempC: -10, gustKmh: 10, cloud: 80 })),
    START
  );
  const dry = buildOutlook(
    testResort,
    syntheticForecast(() => ({ snowMm: 0, tempC: -2, gustKmh: 10, cloud: 20 })),
    START
  );

  assert.ok(
    powder.best!.score > dry.best!.score,
    `powder ${powder.best!.score} should beat dry ${dry.best!.score}`
  );
});

test('extreme wind vetoes an otherwise great day', () => {
  const calm = buildOutlook(
    testResort,
    syntheticForecast(() => ({ snowMm: 15, tempC: -10, gustKmh: 10, cloud: 80 })),
    START
  );
  const stormy = buildOutlook(
    testResort,
    syntheticForecast(() => ({ snowMm: 15, tempC: -10, gustKmh: 110, cloud: 80 })),
    START
  );

  assert.ok(
    stormy.best!.score < calm.best!.score - 15,
    `110km/h gusts should cost more than 15 points (calm ${calm.best!.score}, stormy ${stormy.best!.score})`
  );
});

test('scores stay within 0-100', () => {
  for (const snow of [0, 1, 5, 20, 100]) {
    for (const gust of [0, 30, 60, 150]) {
      const outlook = buildOutlook(
        testResort,
        syntheticForecast(() => ({ snowMm: snow, tempC: -8, gustKmh: gust, cloud: 50 })),
        START
      );
      for (const day of outlook.days) {
        assert.ok(day.score >= 0 && day.score <= 100, `score ${day.score} out of range`);
      }
    }
  }
});

test('the window is split into distinct local days', () => {
  const outlook = buildOutlook(
    testResort,
    syntheticForecast(() => ({ snowMm: 1, tempC: -5, gustKmh: 10, cloud: 50 })),
    START,
    7
  );
  assert.ok(outlook.days.length >= 6, `expected ~7 days, got ${outlook.days.length}`);

  const keys = outlook.days.map((d) => d.dayKey);
  assert.equal(new Set(keys).size, keys.length, 'day keys must be unique');
  assert.deepEqual([...keys].sort(), keys, 'days must be chronological');
});

test('the best day is the highest-scoring one', () => {
  // Snow only on the third day.
  const outlook = buildOutlook(
    testResort,
    syntheticForecast((i) => ({
      snowMm: i >= 48 && i < 72 ? 20 : 0,
      tempC: -12,
      gustKmh: 10,
      cloud: 60,
    })),
    START,
    7
  );

  const maxScore = Math.max(...outlook.days.map((d) => d.score));
  assert.equal(outlook.best!.score, maxScore);
  assert.ok(outlook.best!.snowfallIn > 5, 'the best day should be the snowy one');
});

test('ranking puts the best outlook first', () => {
  const good = buildOutlook(
    { ...testResort, id: 'good' },
    syntheticForecast(() => ({ snowMm: 20, tempC: -12, gustKmh: 5, cloud: 70 })),
    START
  );
  const bad = buildOutlook(
    { ...testResort, id: 'bad' },
    syntheticForecast(() => ({ snowMm: 0, tempC: 5, gustKmh: 80, cloud: 100 })),
    START
  );

  assert.equal(rankOutlooks([bad, good])[0].resort.id, 'good');
});

test('score tones are ordered and complete', () => {
  assert.equal(scoreTone(95).label, 'Epic');
  assert.equal(scoreTone(10).label, 'Poor');
  for (const score of [0, 25, 50, 75, 100]) {
    const tone = scoreTone(score);
    assert.ok(tone.bg && tone.text && tone.label);
  }
});

console.log(`\n✅ ${passed} assertions passed\n`);
