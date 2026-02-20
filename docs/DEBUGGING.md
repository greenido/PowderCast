# 🔍 Debugging Guide for PowderCast

This document explains the logging system implemented for debugging NWS API calls and data processing.

## Overview

Detailed logging has been added to the `hooks/useNWSWeather.ts` file to help debug issues with weather data fetching and processing.

## Enabling/Disabling Logs

To control logging verbosity, edit the `ENABLE_DETAILED_LOGS` constant at the top of `hooks/useNWSWeather.ts`:

```typescript
// Enable detailed logging - set to false to reduce console output
const ENABLE_DETAILED_LOGS = true;  // Set to false to disable
```

## Log Categories

The logging system uses prefixed tags to organize console output:

### 1. **[NWS API]** - API Request Logs
Tracks all HTTP requests to the National Weather Service API.

**What it logs:**
- Request URLs and timing
- HTTP response status codes
- Response times (in milliseconds)
- Error details (status codes, error messages)
- Cache operations

**Example output:**
```
[NWS API] ========================================
[NWS API] Starting weather fetch
[NWS API] Coordinates: { lat: 39.6403, lon: -106.3742 }
[NWS API] Step 1: Fetching point data
[NWS API] URL: https://api.weather.gov/points/39.6403,-106.3742
[NWS API] Point response status: 200
[NWS API] Point response time: 234.56ms
```

### 2. **[NWS Processing]** - Data Processing Logs
Tracks the processing and transformation of raw API data.

**What it logs:**
- Grid data value counts
- Snow accumulation calculations
- Wind speed calculations
- Alert/condition determinations
- Processing timings

**Example output:**
```
[NWS Processing] Starting data processing...
[NWS Processing] Grid data values count: {
  windGust: 156,
  snow: 144,
  temp: 168,
  skyCover: 156,
  visibility: 156
}
[NWS Processing] Snow accumulation: {
  snow24h: "12.50\"",
  snow7day: "24.75\""
}
```

### 3. **[Snow Calc]** - Snow Calculation Logs
Detailed logging for snow accumulation calculations.

**What it logs:**
- Time ranges being calculated
- Each snow data point (timestamp, value, whether it's in range)
- Running totals
- Final calculated values

**Example output:**
```
[Snow Calc] ========================================
[Snow Calc] Calculating 24h snowfall
[Snow Calc] Current time: 2026-02-19T10:30:00.000Z
[Snow Calc] Looking back to: 2026-02-18T10:30:00.000Z
[Snow Calc] Total data points: 144
[Snow Calc]   Data point: 2026-02-18T15:00:00.000Z, value: 2.5cm (0.98"), inRange: true
[Snow Calc]   ✓ ADDED: 0.98" (running total: 0.98")
[Snow Calc] Final total: 12.50" from 24 data points
[Snow Calc] ========================================
```

### 4. **[NWS Hourly]** - Hourly Forecast Processing
Tracks the generation of the 48-hour snow forecast.

**What it logs:**
- Number of hours processed
- Hours with snowfall vs. without
- Total forecast snowfall

**Example output:**
```
[NWS Hourly] Processing hourly forecast for next 48 hours...
[NWS Hourly] Forecast processing complete: {
  totalHours: 48,
  hoursWithSnow: 18,
  totalSnowForecast: "15.25\""
}
```

## Debugging Common Issues

### Issue: No weather data loading

**Check these logs:**
1. Look for `[NWS API] Starting weather fetch` - confirms the hook is being called
2. Check `[NWS API] Point response status` - should be `200`
3. Look for any error messages with `[NWS API] ERROR occurred during fetch`

**Common causes:**
- Invalid coordinates (check the coordinates log)
- NWS API downtime (check response status codes)
- Network issues (check for CORS or network errors)

### Issue: Snow data showing zero when it should have snow

**Check these logs:**
1. Look for `[NWS API] Snow data points:` - should have > 0 values
2. Check `[NWS API] RAW SNOW DATA` - shows first 10 snow data points
3. Review `[Snow Calc]` logs - shows exactly which data points are being included/excluded
4. Check the time ranges - ensure they align with when snow actually fell

**Common causes:**
- Time zone issues (data timestamps may be in UTC)
- Data not yet available from NWS
- Looking at wrong time window (past vs. future)

### Issue: Future snow forecast not showing

**Check these logs:**
1. Look for `[NWS Hourly]` logs
2. Check `hoursWithSnow` value
3. Verify `totalSnowForecast` matches expectations

**Common causes:**
- Forecast data not yet available
- All snowfall outside the 48-hour window
- Data processing filtering out low values

### Issue: Performance problems

**Check these logs:**
All timing measurements are logged:
- `Point response time:` - Time to fetch point data
- `Parallel requests completed in:` - Time to fetch forecast + grid data
- `JSON parsing completed in:` - Time to parse JSON
- `Data processing completed in:` - Time to process/transform data

**Optimization tips:**
- If API requests are slow (>1000ms), it's a network/NWS issue
- If processing is slow (>500ms), check the amount of data being processed

## Browser Console Usage

Open your browser's Developer Console (F12 or Cmd+Option+I) to see logs.

**Recommended filters:**
- Filter by `[NWS` to see all NWS-related logs
- Filter by `[Snow Calc]` to debug snow calculations specifically
- Look for red error messages to quickly identify issues

## Advanced Debugging

### Inspecting Raw API Responses

The first 10 snow data points are logged in raw form:
```
[NWS API] RAW SNOW DATA (first 10 points):
[NWS API]   [0] time: 2026-02-19T11:00:00+00:00/PT1H, value: 0.5cm
[NWS API]   [1] time: 2026-02-19T12:00:00+00:00/PT1H, value: 1.2cm
```

This helps verify:
- Data format is correct
- Timestamps are as expected
- Values are reasonable

### Cache Debugging

Cache operations are logged:
```
[NWS API] Caching data to localStorage...
[NWS API] Data cached successfully with key: weather_39.6403_-106.3742
```

And when loading from cache:
```
[NWS API] Cache found, age: 15.3 minutes
[NWS API] Using cached data (less than 1 hour old)
```

To clear cache and force fresh data:
```javascript
// In browser console:
localStorage.clear();
// Then refresh the page
```

## Performance Monitoring

All major operations include timing logs:

```
[NWS API] Point response time: 234.56ms
[NWS API] Parallel requests completed in: 456.78ms
[NWS API] JSON parsing completed in: 12.34ms
[NWS API] Data processing completed in: 45.67ms
```

**Expected performance:**
- Point request: < 500ms
- Parallel requests: < 1000ms
- JSON parsing: < 50ms
- Data processing: < 200ms

If any step exceeds these values significantly, investigate that specific area.

## Support

If you encounter issues not covered here:

1. Enable logging (`ENABLE_DETAILED_LOGS = true`)
2. Open browser console
3. Reproduce the issue
4. Copy relevant logs
5. Check the timestamps and values carefully
6. Look for error messages (in red)

The detailed logs should help identify exactly where the issue occurs in the data pipeline.
