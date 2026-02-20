# 🐛 Bug Fix: Snow Accumulation 24h vs 7-Day Values

## Issue Description

The app was showing **identical values** for "Last 24 Hours" and "7-Day Total" snow accumulation.

## Root Cause

The issue was a **fundamental misunderstanding** of the NWS Grid Data API:

### What We Thought
- The NWS Grid Data API provides **observation data** (past weather)
- We could calculate "Last 24 Hours" and "Last 7 Days" by looking backward in time
- Both calculations were using `sumSnowfallBackward()` with different time ranges

### The Reality
- The NWS Grid Data API provides **FORECAST data** (future weather predictions)
- Looking backward in time (`currentTime - 24h`) finds NO data points
- Both the 24h and 7-day calculations were finding the same (zero or minimal) data
- This resulted in identical values being displayed

## The Fix

### Code Changes

1. **Created a new function `sumSnowfallForward()`**
   - Looks FORWARD in time instead of backward
   - Calculates forecast for the NEXT 24 hours and NEXT 7 days
   - Properly differentiates between the two time ranges

2. **Updated the calculation logic in `useNWSWeather.ts`**
   ```typescript
   // OLD (incorrect):
   const snow24h = sumSnowfallBackward(snowValues, now, 24);
   const snow7day = sumSnowfallBackward(snowValues, now, 168);
   
   // NEW (correct):
   const snow24h = sumSnowfallForward(snowValues, now, 24);
   const snow7day = sumSnowfallForward(snowValues, now, 168);
   ```

3. **Updated the UI labels in `SnowAccumulationCard.tsx`**
   - Changed "Last 24 Hours" → "Next 24 Hours"
   - Changed "7-Day Total" → "Next 7 Days"
   - Changed card title from "Snow Accumulation" → "Snow Forecast"

### Technical Details

The `sumSnowfallForward()` function:
```typescript
function sumSnowfallForward(
  values: NWSGridDataValue[], 
  currentTime: number, 
  hours: number
): number {
  const endTime = currentTime + (hours * 3600000); // Look FORWARD
  let total = 0;
  
  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    
    // Check if data point is in the FORWARD time range
    if (time >= currentTime && time <= endTime && val.value) {
      total += cmToInches(val.value);
    }
  }
  
  return total;
}
```

## Testing the Fix

### Enhanced Logging

The fix includes enhanced logging to help debug:

```
[Snow Calc FORWARD] Calculating 24h snowfall (looking forward)
[Snow Calc FORWARD] Current time: 2026-02-19T10:30:00.000Z
[Snow Calc FORWARD] Looking ahead to: 2026-02-20T10:30:00.000Z
[Snow Calc FORWARD]   Data point: 2026-02-19T15:00:00.000Z, value: 2.5cm (0.98"), inRange: true
[Snow Calc FORWARD]   ✓ ADDED: 0.98" (running total: 0.98")
```

### Automated Tests

The test suite (`tests/weather-api.test.ts`) includes:
- Detection of identical 24h/7d values
- Detailed snow data analysis
- Time range verification

Run tests with:
```bash
npm run test:weather-api
```

## Verification

### Expected Behavior After Fix

1. **Different Values**: The 24h and 7-day values should now be different
   - 24h shows forecast for next 24 hours
   - 7-day shows forecast for next 7 days (will be >= 24h value)

2. **Accurate Labels**: UI now correctly shows "Next 24 Hours" and "Next 7 Days"

3. **Better Logging**: Console logs clearly show:
   - Which time ranges are being calculated
   - What data points are being included/excluded
   - Running totals and final values

### Test Scenarios

1. **Location with no forecast snow**
   - Both values should be 0"
   - Logs show "0 data points matched"

2. **Location with upcoming snow in next 24h**
   - 24h value shows accumulation
   - 7-day value >= 24h value
   - Logs show matched data points

3. **Location with snow beyond 24h but within 7 days**
   - 24h value shows less snow
   - 7-day value shows more snow
   - Clear difference between the two

## Impact

### User-Facing Changes
- ✅ More accurate snow forecasts
- ✅ Clear differentiation between 24h and 7-day forecasts
- ✅ Correct terminology ("Next" instead of "Last")

### Developer Experience
- ✅ Better logging for debugging
- ✅ Clearer code comments
- ✅ Automated test coverage
- ✅ Documentation of API behavior

## Files Modified

1. `hooks/useNWSWeather.ts`
   - Added `sumSnowfallForward()` function
   - Updated calculation logic
   - Enhanced logging

2. `components/SnowAccumulationCard.tsx`
   - Updated UI labels
   - Changed card title

3. `tests/weather-api.test.ts` (new)
   - Comprehensive API tests
   - Snow data analysis
   - Bug detection

4. `tests/README.md` (new)
   - Test documentation
   - Usage instructions

## Future Improvements

Potential enhancements for future versions:

1. **Historical Data Integration**
   - Integrate with NOAA observation API for actual past snow data
   - Show both "Last 24h" (observations) and "Next 24h" (forecast)

2. **Hybrid Display**
   - If forecast shows snow in next 24h, display as "Expected Next 24h"
   - If observations available, show "Last 24h Actual"

3. **Data Source Indicator**
   - Add small badge showing "Forecast" vs "Observed"
   - Help users understand the data type

## References

- [NWS API Documentation](https://www.weather.gov/documentation/services-web-api)
- [NWS Grid Data Specification](https://api.weather.gov/points/39.6403,-106.3742)
- Test suite: `tests/weather-api.test.ts`
- Debugging guide: `DEBUGGING.md`
