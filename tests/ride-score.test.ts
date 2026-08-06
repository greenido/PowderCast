/**
 * Ride Score Algorithm Verification Test
 * 
 * Verifies the Ride Score logic across multiple snow, wind, temp, and visibility scenarios.
 * Run with: npx ts-node tests/ride-score.test.ts
 */

import { strict as assert } from 'assert';
import { calculateRideScore, getRideScoreLabel } from '../lib/rideScore';
import type { ProcessedWeatherData } from '../lib/nwsTypes';

// Mock generator to quickly create ProcessedWeatherData with sensible defaults
function createMockWeatherData(overrides: Partial<ProcessedWeatherData> = {}): ProcessedWeatherData {
  return {
    currentTemp: 22, // perfect temp
    currentWindSpeed: 5,
    currentWindGust: 8,
    currentVisibility: 10000, // clear
    currentSkyCover: 10,
    currentHumidity: 40,
    currentDewpoint: 10,
    snow24h: 0,
    snow7day: 0,
    maxWindGust24h: 10,
    maxWindGust7day: 15,
    avgWindSpeed: 5,
    maxTemp24h: 28,
    minTemp24h: 15,
    maxPrecipProb24h: 0,
    periods: [],
    snowQuality: 'Premium Packed',
    windHoldRisk: false,
    frostbiteRisk: false,
    bluebirdDay: true,
    powderAlert: false,
    precipTemp: null,
    gridDataUrl: 'https://api.weather.gov/gridpoints/MOCK/1,1',
    hourlySnowForecast: [],
    currentWindDirection: null,
    snow48h: 0,
    freezingLevelFt: null,
    snowDepthIn: null,
    windChill: 22,
    source: 'nws',
    attribution: 'test fixture',
    forecastElevationFt: 8000,
    ...overrides,
  };
}

function runTests() {
  console.log('\n🧪 Running Ride Score Algorithm Unit Tests...\n');
  console.log('═'.repeat(60));

  // Scenario 1: Perfect Bluebird Champagne Powder Day
  console.log('💎 Test 1: Epic Bluebird Champagne Powder Day');
  const epicWeather = createMockWeatherData({
    snow24h: 8, // 8 inches of new snow
    snowQuality: 'Champagne Powder',
    bluebirdDay: true,
    currentSkyCover: 0,
    currentWindSpeed: 4,
    maxWindGust24h: 8,
    currentTemp: 24, // perfect winter temp
  });
  const epicResult = calculateRideScore(epicWeather);
  console.log(`   Ride Score: ${epicResult.score}/100`);
  console.log(`   Breakdown: Snow=${epicResult.snow}, Quality=${epicResult.quality}, Wind=${epicResult.wind}, Vis=${epicResult.visibility}, Temp=${epicResult.temperature}`);
  const epicLabel = getRideScoreLabel(epicResult.score);
  console.log(`   Label: ${epicLabel.label}\n`);
  
  assert.equal(epicResult.score, 100, 'Epic day should score 100/100');
  assert.equal(epicLabel.label, 'Epic Conditions 💎');

  // Scenario 2: Great Packed Groomers with light breeze
  console.log('🏂 Test 2: Great Packed Groomers');
  const greatWeather = createMockWeatherData({
    snow24h: 2,
    snowQuality: 'Premium Packed',
    bluebirdDay: false,
    currentSkyCover: 30, // partly cloudy
    currentWindSpeed: 12, // slightly higher average wind
    maxWindGust24h: 18,
    currentTemp: 20,
  });
  const greatResult = calculateRideScore(greatWeather);
  console.log(`   Ride Score: ${greatResult.score}/100`);
  console.log(`   Breakdown: Snow=${greatResult.snow}, Quality=${greatResult.quality}, Wind=${greatResult.wind}, Vis=${greatResult.visibility}, Temp=${greatResult.temperature}`);
  const greatLabel = getRideScoreLabel(greatResult.score);
  console.log(`   Label: ${greatLabel.label}\n`);

  assert.ok(greatResult.score >= 70 && greatResult.score < 85, 'Should score in the Great category');
  assert.equal(greatLabel.label, 'Great 🏂');

  // Scenario 3: High Wind Lift Hold Risk
  console.log('⚠️ Test 3: High Wind / Lift Hold Risk');
  const windWeather = createMockWeatherData({
    snow24h: 1,
    snowQuality: 'Sierra Cement',
    bluebirdDay: false,
    currentSkyCover: 100,
    currentVisibility: 1000,
    currentWindSpeed: 35,
    maxWindGust24h: 55, // lift hold risk!
    currentTemp: 0,
  });
  const windResult = calculateRideScore(windWeather);
  console.log(`   Ride Score: ${windResult.score}/100`);
  console.log(`   Breakdown: Snow=${windResult.snow}, Quality=${windResult.quality}, Wind=${windResult.wind}, Vis=${windResult.visibility}, Temp=${windResult.temperature}`);
  const windLabel = getRideScoreLabel(windResult.score);
  console.log(`   Label: ${windLabel.label}\n`);

  assert.ok(windResult.score < 50, 'High wind hold risk should score < 50 due to major wind penalties');
  assert.equal(windResult.wind, 0, 'Wind points should be heavily penalized to 0');
  assert.equal(windLabel.label, 'Challenging / Ice ⚠️');

  // Scenario 4: Poor visibility / Overcast / Foggy
  console.log('☁️ Test 4: Flat Light & Low Visibility');
  const foggyWeather = createMockWeatherData({
    snow24h: 1,
    snowQuality: 'Premium Packed',
    bluebirdDay: false,
    currentSkyCover: 95, // thick overcast
    currentVisibility: 2000, // 2 km visibility (fog)
    currentWindSpeed: 5,
    maxWindGust24h: 8,
    currentTemp: 22,
  });
  const foggyResult = calculateRideScore(foggyWeather);
  console.log(`   Ride Score: ${foggyResult.score}/100`);
  console.log(`   Breakdown: Snow=${foggyResult.snow}, Quality=${foggyResult.quality}, Wind=${foggyResult.wind}, Vis=${foggyResult.visibility}, Temp=${foggyResult.temperature}`);
  
  assert.ok(foggyResult.visibility <= 3, 'Visibility points should be low due to high cloud cover and fog');

  // Scenario 5: Slushy / Mashed Potatoes Warm Spring Riding
  console.log('🏔️ Test 5: Slushy / Mashed Potatoes Warm Spring Riding');
  const slushWeather = createMockWeatherData({
    snow24h: 0,
    snowQuality: 'Mashtatoes/Slush',
    bluebirdDay: true,
    currentSkyCover: 0,
    currentWindSpeed: 5,
    maxWindGust24h: 10,
    currentTemp: 38, // Warm spring temp
  });
  const slushResult = calculateRideScore(slushWeather);
  console.log(`   Ride Score: ${slushResult.score}/100`);
  console.log(`   Breakdown: Snow=${slushResult.snow}, Quality=${slushResult.quality}, Wind=${slushResult.wind}, Vis=${slushResult.visibility}, Temp=${slushResult.temperature}`);
  const slushLabel = getRideScoreLabel(slushResult.score);
  console.log(`   Label: ${slushLabel.label}\n`);

  assert.ok(slushResult.score >= 40 && slushResult.score < 50, 'Should score in the 40-50 range');
  assert.equal(slushLabel.label, 'Challenging / Ice ⚠️');

  console.log('═'.repeat(60));
  console.log('🎉 ALL RIDE SCORE ALGORITHM TESTS PASSED SUCCESSFULLY! ✅\n');
}

runTests();
