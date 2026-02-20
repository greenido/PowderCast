# 🧪 PowderCast API Test Suite

This directory contains comprehensive tests for all weather APIs used in PowderCast.

## Overview

The tests make **REAL API calls** to verify that:
1. The APIs are working correctly
2. The data structure is as expected
3. Response times are acceptable
4. Snow accumulation calculations are correct

## Installation

First, ensure you have the required dependencies:

```bash
npm install
```

or

```bash
yarn install
```

## Running the Tests

### Full Weather API Test Suite

```bash
npm run test:weather-api
```

or

```bash
yarn test:weather-api
```

This will:
- Test the NWS (National Weather Service) Point API
- Test the NWS Forecast API
- Test the NWS Grid Data API (includes snow, temperature, wind data)
- Test Resort data loading
- Analyze snow accumulation data
- Log detailed responses for debugging

### Direct Execution

You can also run the tests directly:

```bash
npx ts-node tests/weather-api.test.ts
```

## Test Configuration

The tests use a predefined test location (Vail Resort) by default. To test a different location, edit the `TEST_CONFIG` section in `weather-api.test.ts`:

```typescript
const TEST_CONFIG = {
  TEST_LAT: 39.6403,    // Your latitude
  TEST_LON: -106.3742,  // Your longitude
  TEST_RESORT_NAME: 'Vail',
  // ... other config
};
```

## What Gets Tested

### 1. NWS Point API
- Validates coordinates
- Checks that forecast and grid data URLs are returned
- Verifies HTTPS endpoints
- Measures response time

### 2. NWS Forecast API
- Validates 7-day forecast data
- Checks forecast periods structure
- Verifies temperature, wind speed, and conditions
- Logs forecast details

### 3. NWS Grid Data API (Most Important)
- Validates all weather parameters:
  - Temperature
  - Wind speed and gusts
  - Sky cover
  - Visibility
  - **Snowfall amount** (critical for the app)
- Analyzes snow data distribution
- **Detects the 24h/7d bug** (if present)
- Shows detailed snow accumulation breakdown

### 4. Resort Data
- Loads resort database
- Validates coordinates
- Checks elevation data
- Verifies all required fields

## Understanding Test Output

### Success Output

```
✅ [TEST_NWS_POINT] Point data API test passed (234ms)
✅ [TEST_NWS_FORECAST] Forecast data API test passed (456ms)
✅ [TEST_NWS_GRID] Grid data API test passed (789ms)
✅ [TEST_RESORTS] Resort data test passed (22 resorts loaded)
```

### Snow Analysis Output

The test includes a detailed snow analysis section:

```
📊 Snow Data Summary:
  Total data points: 144
  Points with snow: 24
  
❄️  Past 24 hours:
  Total accumulation: 12.50"
  Number of points: 6
  Points detail:
    [0] 2026-02-19T15:00:00.000Z = 2.00"
    [1] 2026-02-19T16:00:00.000Z = 3.00"
    ...
    
❄️  Past 7 days:
  Total accumulation: 24.75"
  Number of points: 12
  
🔮 Future forecast:
  Total forecast: 15.00"
```

### Bug Detection

If the 24h and 7d values are identical, you'll see:

```
⚠️  WARNING: 24h and 7d values are identical! This indicates the bug.
   The 7-day calculation may not be working correctly.
```

If they're different (correct behavior):

```
✅ 24h and 7d values are different (expected behavior)
```

## Debugging

### Verbose Logging

All tests include detailed logging:
- Request URLs
- Response times
- Response status codes
- Full data summaries
- Sample data points

### Common Issues

**Issue: API timeout**
```
❌ [TEST_NWS_POINT] ERROR: Point data API test failed
Error: Request timed out
```
- The NWS API may be slow or down
- Check your internet connection
- Try again in a few minutes

**Issue: Invalid coordinates**
```
❌ [TEST_NWS_POINT] ERROR: NWS API error: 404
```
- The test coordinates may be invalid
- Check that lat/lon are within the US
- NWS only covers US locations

**Issue: No snow data**
```
⚠️  No snowfall data available for this location
```
- This is normal for locations without recent snow
- Try testing with a different resort
- Snow data may not be available in summer months

## Test Timeouts

Default timeout: 10 seconds per request

To modify the timeout, edit `TEST_CONFIG.REQUEST_TIMEOUT` in the test file.

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run API Tests
  run: npm run test:weather-api
```

## Adding New Tests

To add new API tests:

1. Create a new test function following the pattern:
   ```typescript
   async function testNewAPI(): Promise<void> {
     log('TEST_NAME', 'Testing...');
     // ... test logic
     logSuccess('TEST_NAME', 'Test passed');
   }
   ```

2. Add it to `runAllTests()`:
   ```typescript
   testResults.total++;
   await testNewAPI();
   testResults.passed++;
   ```

## Support

If tests fail consistently:
1. Check the detailed logs
2. Verify your internet connection
3. Check the NWS API status: https://www.weather.gov/documentation/services-web-api
4. Ensure resort data is up to date
5. Look for error messages in the test output

## Related Documentation

- [DEBUGGING.md](../DEBUGGING.md) - Application-level debugging guide
- [EXAMPLE_LOGS.md](../EXAMPLE_LOGS.md) - Example log outputs
- [NWS API Documentation](https://www.weather.gov/documentation/services-web-api)
