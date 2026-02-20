/**
 * Weather API Test Suite
 * 
 * This test file makes REAL API calls to test the weather data APIs used in PowderCast.
 * Run with: npx ts-node tests/weather-api.test.ts
 * 
 * Tests:
 * 1. NWS (National Weather Service) API - Main weather data source
 * 2. Resort data loading - Verifies resort coordinates
 */

import { strict as assert } from 'assert';

// ============================================================================
// TYPES (matching the application types)
// ============================================================================

interface NWSPoint {
  properties: {
    forecast: string;
    forecastGridData: string;
    relativeLocation: {
      properties: {
        city: string;
        state: string;
      };
    };
  };
}

interface NWSForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  detailedForecast: string;
}

interface NWSForecast {
  properties: {
    updated: string;
    units: string;
    periods: NWSForecastPeriod[];
  };
}

interface NWSGridDataValue {
  validTime: string;
  value: number | null;
}

interface NWSGridData {
  properties: {
    temperature?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    windSpeed?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    windGust?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    skyCover?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    snowfallAmount?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    visibility?: {
      values: NWSGridDataValue[];
      uom: string;
    };
  };
}

interface Resort {
  id: string;
  name: string;
  state: string;
  region: string;
  base_lat: number;
  base_lon: number;
  summit_lat: number;
  summit_lon: number;
  base_elevation: number;
  summit_elevation: number;
  webcam_url?: string;
}

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  // Test coordinates for Vail Resort (known good location)
  TEST_LAT: 39.6403,
  TEST_LON: -106.3742,
  TEST_RESORT_NAME: 'Vail',
  
  // NWS API configuration
  NWS_API_BASE: 'https://api.weather.gov',
  USER_AGENT: 'PowderCast-Test/1.1 (test@powdercast.app)',
  
  // Timeouts
  REQUEST_TIMEOUT: 10000, // 10 seconds
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(category: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] [${category}] ${message}`);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logError(category: string, message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`\n[${timestamp}] [${category}] ❌ ERROR: ${message}`);
  if (error) {
    console.error(error);
  }
}

function logSuccess(category: string, message: string) {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] [${category}] ✅ ${message}`);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function analyzeSnowData(snowValues: NWSGridDataValue[]): void {
  log('SNOW_ANALYSIS', 'Analyzing snow data distribution...');
  
  const now = Date.now();
  const past24h = now - (24 * 3600000);
  const past7d = now - (168 * 3600000);
  
  let snowInPast24h = 0;
  let snowInPast7d = 0;
  let snowInFuture = 0;
  
  const snowPoints24h: Array<{time: string, value: number}> = [];
  const snowPoints7d: Array<{time: string, value: number}> = [];
  
  for (const val of snowValues) {
    if (!val.value || val.value <= 0) continue;
    
    const time = new Date(val.validTime.split('/')[0]).getTime();
    const valueCm = val.value;
    const valueInches = valueCm * 0.393701; // cm to inches
    
    if (time >= past24h && time <= now) {
      snowInPast24h += valueInches;
      snowPoints24h.push({
        time: new Date(time).toISOString(),
        value: valueInches
      });
    }
    
    if (time >= past7d && time <= now) {
      snowInPast7d += valueInches;
      snowPoints7d.push({
        time: new Date(time).toISOString(),
        value: valueInches
      });
    }
    
    if (time > now) {
      snowInFuture += valueInches;
    }
  }
  
  console.log('\n📊 Snow Data Summary:');
  console.log(`  Total data points: ${snowValues.length}`);
  console.log(`  Points with snow: ${snowValues.filter(v => v.value && v.value > 0).length}`);
  console.log(`\n❄️  Past 24 hours:`);
  console.log(`  Total accumulation: ${snowInPast24h.toFixed(2)}"`);
  console.log(`  Number of points: ${snowPoints24h.length}`);
  if (snowPoints24h.length > 0) {
    console.log(`  Points detail:`);
    snowPoints24h.forEach((pt, idx) => {
      console.log(`    [${idx}] ${pt.time} = ${pt.value.toFixed(2)}"`);
    });
  }
  
  console.log(`\n❄️  Past 7 days:`);
  console.log(`  Total accumulation: ${snowInPast7d.toFixed(2)}"`);
  console.log(`  Number of points: ${snowPoints7d.length}`);
  if (snowPoints7d.length > 5) {
    console.log(`  First 5 points:`);
    snowPoints7d.slice(0, 5).forEach((pt, idx) => {
      console.log(`    [${idx}] ${pt.time} = ${pt.value.toFixed(2)}"`);
    });
    console.log(`  ... and ${snowPoints7d.length - 5} more points`);
  } else if (snowPoints7d.length > 0) {
    console.log(`  Points detail:`);
    snowPoints7d.forEach((pt, idx) => {
      console.log(`    [${idx}] ${pt.time} = ${pt.value.toFixed(2)}"`);
    });
  }
  
  console.log(`\n🔮 Future forecast:`);
  console.log(`  Total forecast: ${snowInFuture.toFixed(2)}"`);
  
  // Check for the bug: if 24h and 7d are the same
  if (snowInPast24h > 0 && snowInPast7d > 0) {
    if (Math.abs(snowInPast24h - snowInPast7d) < 0.01) {
      console.log('\n⚠️  WARNING: 24h and 7d values are identical! This indicates the bug.');
      console.log('   The 7-day calculation may not be working correctly.');
    } else {
      console.log('\n✅ 24h and 7d values are different (expected behavior)');
    }
  }
}

// ============================================================================
// TEST 1: NWS API - Point Data
// ============================================================================

async function testNWSPointData(): Promise<NWSPoint> {
  log('TEST_NWS_POINT', '='.repeat(80));
  log('TEST_NWS_POINT', 'Testing NWS Point Data API');
  log('TEST_NWS_POINT', '='.repeat(80));
  
  const url = `${TEST_CONFIG.NWS_API_BASE}/points/${TEST_CONFIG.TEST_LAT},${TEST_CONFIG.TEST_LON}`;
  log('TEST_NWS_POINT', 'Request URL:', { url });
  log('TEST_NWS_POINT', 'Coordinates:', { 
    lat: TEST_CONFIG.TEST_LAT, 
    lon: TEST_CONFIG.TEST_LON,
    location: TEST_CONFIG.TEST_RESORT_NAME 
  });
  
  const startTime = Date.now();
  
  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': TEST_CONFIG.USER_AGENT,
          'Accept': 'application/geo+json',
        },
      },
      TEST_CONFIG.REQUEST_TIMEOUT
    );
    
    const duration = Date.now() - startTime;
    log('TEST_NWS_POINT', 'Response received', {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
    });
    
    assert.equal(response.status, 200, 'Point API should return 200 OK');
    
    const data: NWSPoint = await response.json();
    
    log('TEST_NWS_POINT', 'Response data:', {
      forecast: data.properties.forecast,
      forecastGridData: data.properties.forecastGridData,
      location: {
        city: data.properties.relativeLocation?.properties?.city,
        state: data.properties.relativeLocation?.properties?.state,
      },
    });
    
    // Validate structure
    assert.ok(data.properties.forecast, 'Forecast URL should exist');
    assert.ok(data.properties.forecastGridData, 'Grid data URL should exist');
    assert.ok(data.properties.forecast.startsWith('https://'), 'Forecast URL should be HTTPS');
    assert.ok(data.properties.forecastGridData.startsWith('https://'), 'Grid data URL should be HTTPS');
    
    logSuccess('TEST_NWS_POINT', `Point data API test passed (${duration}ms)`);
    return data;
    
  } catch (error) {
    logError('TEST_NWS_POINT', 'Point data API test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 2: NWS API - Forecast Data
// ============================================================================

async function testNWSForecastData(forecastUrl: string): Promise<NWSForecast> {
  log('TEST_NWS_FORECAST', '='.repeat(80));
  log('TEST_NWS_FORECAST', 'Testing NWS Forecast Data API');
  log('TEST_NWS_FORECAST', '='.repeat(80));
  log('TEST_NWS_FORECAST', 'Request URL:', { url: forecastUrl });
  
  const startTime = Date.now();
  
  try {
    const response = await fetchWithTimeout(
      forecastUrl,
      {
        headers: {
          'User-Agent': TEST_CONFIG.USER_AGENT,
          'Accept': 'application/geo+json',
        },
      },
      TEST_CONFIG.REQUEST_TIMEOUT
    );
    
    const duration = Date.now() - startTime;
    log('TEST_NWS_FORECAST', 'Response received', {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
    });
    
    assert.equal(response.status, 200, 'Forecast API should return 200 OK');
    
    const data: NWSForecast = await response.json();
    
    log('TEST_NWS_FORECAST', 'Response summary:', {
      updated: data.properties.updated,
      units: data.properties.units,
      periodsCount: data.properties.periods.length,
    });
    
    // Validate structure
    assert.ok(data.properties.periods, 'Periods should exist');
    assert.ok(data.properties.periods.length > 0, 'Should have at least one period');
    assert.ok(data.properties.periods.length >= 7, 'Should have at least 7 periods (7-day forecast)');
    
    // Validate first period
    const firstPeriod = data.properties.periods[0];
    log('TEST_NWS_FORECAST', 'First forecast period:', {
      name: firstPeriod.name,
      temperature: `${firstPeriod.temperature}°${firstPeriod.temperatureUnit}`,
      windSpeed: firstPeriod.windSpeed,
      windDirection: firstPeriod.windDirection,
      shortForecast: firstPeriod.shortForecast,
    });
    
    assert.ok(firstPeriod.name, 'Period should have a name');
    assert.ok(typeof firstPeriod.temperature === 'number', 'Temperature should be a number');
    assert.ok(firstPeriod.temperatureUnit, 'Temperature unit should exist');
    assert.ok(firstPeriod.windSpeed, 'Wind speed should exist');
    assert.ok(firstPeriod.shortForecast, 'Short forecast should exist');
    
    logSuccess('TEST_NWS_FORECAST', `Forecast data API test passed (${duration}ms)`);
    return data;
    
  } catch (error) {
    logError('TEST_NWS_FORECAST', 'Forecast data API test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 3: NWS API - Grid Data (Most Important for Snow)
// ============================================================================

async function testNWSGridData(gridDataUrl: string): Promise<NWSGridData> {
  log('TEST_NWS_GRID', '='.repeat(80));
  log('TEST_NWS_GRID', 'Testing NWS Grid Data API (Snow, Wind, Temp)');
  log('TEST_NWS_GRID', '='.repeat(80));
  log('TEST_NWS_GRID', 'Request URL:', { url: gridDataUrl });
  
  const startTime = Date.now();
  
  try {
    const response = await fetchWithTimeout(
      gridDataUrl,
      {
        headers: {
          'User-Agent': TEST_CONFIG.USER_AGENT,
          'Accept': 'application/geo+json',
        },
      },
      TEST_CONFIG.REQUEST_TIMEOUT
    );
    
    const duration = Date.now() - startTime;
    log('TEST_NWS_GRID', 'Response received', {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
    });
    
    assert.equal(response.status, 200, 'Grid data API should return 200 OK');
    
    const data: NWSGridData = await response.json();
    
    // Count data points
    const dataSummary = {
      temperature: data.properties.temperature?.values.length || 0,
      windSpeed: data.properties.windSpeed?.values.length || 0,
      windGust: data.properties.windGust?.values.length || 0,
      skyCover: data.properties.skyCover?.values.length || 0,
      snowfallAmount: data.properties.snowfallAmount?.values.length || 0,
      visibility: data.properties.visibility?.values.length || 0,
    };
    
    log('TEST_NWS_GRID', 'Data points count:', dataSummary);
    
    // Validate structure
    assert.ok(data.properties, 'Properties should exist');
    assert.ok(data.properties.temperature, 'Temperature data should exist');
    assert.ok(data.properties.windSpeed, 'Wind speed data should exist');
    assert.ok(dataSummary.temperature > 0, 'Should have temperature data points');
    assert.ok(dataSummary.windSpeed > 0, 'Should have wind speed data points');
    
    // Check snowfall data specifically
    if (data.properties.snowfallAmount) {
      log('TEST_NWS_GRID', 'Snowfall data details:', {
        totalPoints: dataSummary.snowfallAmount,
        uom: data.properties.snowfallAmount.uom,
        pointsWithSnow: data.properties.snowfallAmount.values.filter(v => v.value && v.value > 0).length,
      });
      
      // Show first 10 snow data points
      const snowValues = data.properties.snowfallAmount.values;
      log('TEST_NWS_GRID', 'First 10 snow data points:');
      snowValues.slice(0, 10).forEach((val, idx) => {
        const time = val.validTime.split('/')[0];
        console.log(`  [${idx}] time: ${time}, value: ${val.value}${data.properties.snowfallAmount?.uom || 'cm'}`);
      });
      
      // Perform detailed snow analysis
      analyzeSnowData(snowValues);
      
    } else {
      log('TEST_NWS_GRID', '⚠️  No snowfall data available for this location');
    }
    
    // Sample some temperature data
    if (data.properties.temperature && data.properties.temperature.values.length > 0) {
      const tempSample = data.properties.temperature.values.slice(0, 3);
      log('TEST_NWS_GRID', 'Sample temperature data:', tempSample);
    }
    
    // Sample some wind data
    if (data.properties.windSpeed && data.properties.windSpeed.values.length > 0) {
      const windSample = data.properties.windSpeed.values.slice(0, 3);
      log('TEST_NWS_GRID', 'Sample wind speed data:', windSample);
    }
    
    logSuccess('TEST_NWS_GRID', `Grid data API test passed (${duration}ms)`);
    return data;
    
  } catch (error) {
    logError('TEST_NWS_GRID', 'Grid data API test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 4: Resort Data Loading
// ============================================================================

async function testResortData(): Promise<Resort[]> {
  log('TEST_RESORTS', '='.repeat(80));
  log('TEST_RESORTS', 'Testing Resort Data Loading');
  log('TEST_RESORTS', '='.repeat(80));
  
  const url = './resorts.json';
  log('TEST_RESORTS', 'Request URL:', { url });
  
  try {
    const fs = require('fs');
    const path = require('path');
    const resortsPath = path.join(__dirname, '..', 'public', 'resorts.json');
    
    log('TEST_RESORTS', 'Reading from file:', { path: resortsPath });
    
    const fileContent = fs.readFileSync(resortsPath, 'utf8');
    const resorts: Resort[] = JSON.parse(fileContent);
    
    log('TEST_RESORTS', 'Resorts loaded:', {
      count: resorts.length,
      states: [...new Set(resorts.map(r => r.state))],
    });
    
    // Validate structure
    assert.ok(Array.isArray(resorts), 'Resorts should be an array');
    assert.ok(resorts.length > 0, 'Should have at least one resort');
    
    // Find test resort
    const testResort = resorts.find(r => r.name === TEST_CONFIG.TEST_RESORT_NAME);
    assert.ok(testResort, `Should find ${TEST_CONFIG.TEST_RESORT_NAME} resort`);
    
    if (testResort) {
      log('TEST_RESORTS', 'Test resort details:', {
        id: testResort.id,
        name: testResort.name,
        state: testResort.state,
        region: testResort.region,
        baseCoordinates: { lat: testResort.base_lat, lon: testResort.base_lon },
        summitCoordinates: { lat: testResort.summit_lat, lon: testResort.summit_lon },
        elevations: {
          base: testResort.base_elevation,
          summit: testResort.summit_elevation,
          vertical: testResort.summit_elevation - testResort.base_elevation,
        },
      });
      
      // Validate coordinates
      assert.ok(testResort.base_lat, 'Base latitude should exist');
      assert.ok(testResort.base_lon, 'Base longitude should exist');
      assert.ok(testResort.summit_lat, 'Summit latitude should exist');
      assert.ok(testResort.summit_lon, 'Summit longitude should exist');
      assert.ok(testResort.base_lat >= -90 && testResort.base_lat <= 90, 'Base latitude should be valid');
      assert.ok(testResort.base_lon >= -180 && testResort.base_lon <= 180, 'Base longitude should be valid');
    }
    
    logSuccess('TEST_RESORTS', `Resort data test passed (${resorts.length} resorts loaded)`);
    return resorts;
    
  } catch (error) {
    logError('TEST_RESORTS', 'Resort data test failed', error);
    throw error;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🧪 POWDERCAST WEATHER API TEST SUITE');
  console.log('='.repeat(80));
  console.log(`\nStarted at: ${new Date().toISOString()}`);
  console.log(`Test location: ${TEST_CONFIG.TEST_RESORT_NAME}`);
  console.log(`Coordinates: ${TEST_CONFIG.TEST_LAT}, ${TEST_CONFIG.TEST_LON}`);
  console.log('\n');
  
  const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
  };
  
  try {
    // Test 1: Point Data
    testResults.total++;
    const pointData = await testNWSPointData();
    testResults.passed++;
    
    // Test 2: Forecast Data
    testResults.total++;
    await testNWSForecastData(pointData.properties.forecast);
    testResults.passed++;
    
    // Test 3: Grid Data (Most important for snow)
    testResults.total++;
    await testNWSGridData(pointData.properties.forecastGridData);
    testResults.passed++;
    
    // Test 4: Resort Data
    testResults.total++;
    await testResortData();
    testResults.passed++;
    
  } catch (error) {
    testResults.failed++;
    console.error('\n❌ Test suite encountered an error:', error);
  }
  
  // Summary
  console.log('\n');
  console.log('='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`\nCompleted at: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('\n');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch((error) => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}

export {
  testNWSPointData,
  testNWSForecastData,
  testNWSGridData,
  testResortData,
};
