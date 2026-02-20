# Example Console Output

This file shows what the debugging logs look like in the browser console when fetching weather data.

```
[NWS API] ========================================
[NWS API] Starting weather fetch
[NWS API] Coordinates: { lat: 39.6403, lon: -106.3742 }
[NWS API] Timestamp: 2026-02-19T18:45:23.456Z
[NWS API] Step 1: Fetching point data
[NWS API] URL: https://api.weather.gov/points/39.6403,-106.3742
[NWS API] Point response status: 200
[NWS API] Point response time: 234.56ms
[NWS API] Point data received: {
  forecastUrl: 'https://api.weather.gov/gridpoints/BOU/52,73/forecast',
  gridDataUrl: 'https://api.weather.gov/gridpoints/BOU/52,73',
  location: { city: 'Vail', state: 'CO' }
}
[NWS API] Step 2: Fetching forecast and grid data in parallel
[NWS API] Forecast URL: https://api.weather.gov/gridpoints/BOU/52,73/forecast
[NWS API] Grid Data URL: https://api.weather.gov/gridpoints/BOU/52,73
[NWS API] Parallel requests completed in: 456.78ms
[NWS API] Forecast response status: 200
[NWS API] Grid data response status: 200
[NWS API] Parsing JSON responses...
[NWS API] JSON parsing completed in: 12.34ms
[NWS API] Forecast periods: 14
[NWS API] Grid data available: {
  temperature: true,
  windSpeed: true,
  windGust: true,
  snowfallAmount: true,
  skyCover: true,
  visibility: true
}
[NWS API] Snow data points: 144
[NWS API] ========================================
[NWS API] RAW SNOW DATA (first 10 points):
[NWS API]   [0] time: 2026-02-19T19:00:00+00:00/PT1H, value: 0.5cm
[NWS API]   [1] time: 2026-02-19T20:00:00+00:00/PT1H, value: 1.2cm
[NWS API]   [2] time: 2026-02-19T21:00:00+00:00/PT1H, value: 2.3cm
[NWS API]   [3] time: 2026-02-19T22:00:00+00:00/PT1H, value: 1.8cm
[NWS API]   [4] time: 2026-02-19T23:00:00+00:00/PT1H, value: 0.9cm
[NWS API]   [5] time: 2026-02-20T00:00:00+00:00/PT1H, value: 0cm
[NWS API]   [6] time: 2026-02-20T01:00:00+00:00/PT1H, value: 0cm
[NWS API]   [7] time: 2026-02-20T02:00:00+00:00/PT1H, value: 0cm
[NWS API]   [8] time: 2026-02-20T03:00:00+00:00/PT1H, value: 0cm
[NWS API]   [9] time: 2026-02-20T04:00:00+00:00/PT1H, value: 0cm
[NWS API] ========================================
[NWS API] Processing weather data...
[NWS Processing] Starting data processing...
[NWS Processing] Current conditions: {
  temp: 28,
  windSpeed: 12,
  period: 'Tonight'
}
[NWS Processing] Grid data values count: {
  windGust: 156,
  snow: 144,
  temp: 168,
  skyCover: 156,
  visibility: 156
}
[NWS Processing] Calculating snow accumulation...
[Snow Calc] ========================================
[Snow Calc] Calculating 24h snowfall
[Snow Calc] Current time: 2026-02-19T18:45:23.456Z
[Snow Calc] Looking back to: 2026-02-18T18:45:23.456Z
[Snow Calc] Total data points: 144
[Snow Calc]   Data point: 2026-02-18T19:00:00.000Z, value: 1.5cm (0.59"), inRange: true
[Snow Calc]   ✓ ADDED: 0.59" (running total: 0.59")
[Snow Calc]   Data point: 2026-02-18T20:00:00.000Z, value: 2.0cm (0.79"), inRange: true
[Snow Calc]   ✓ ADDED: 0.79" (running total: 1.38")
[Snow Calc]   Data point: 2026-02-18T21:00:00.000Z, value: 1.8cm (0.71"), inRange: true
[Snow Calc]   ✓ ADDED: 0.71" (running total: 2.09")
[Snow Calc] Final total: 12.50" from 24 data points
[Snow Calc] ========================================
[Snow Calc] ========================================
[Snow Calc] Calculating 168h snowfall
[Snow Calc] Current time: 2026-02-19T18:45:23.456Z
[Snow Calc] Looking back to: 2026-02-12T18:45:23.456Z
[Snow Calc] Total data points: 144
[Snow Calc] Final total: 24.75" from 67 data points
[Snow Calc] ========================================
[NWS Processing] Snow accumulation: {
  snow24h: "12.50\"",
  snow7day: "24.75\""
}
[NWS Processing] Wind gusts: {
  max24h: "45.5 mph",
  max7day: "52.3 mph"
}
[NWS Processing] Average wind speed (next 24h): 15.2 mph
[NWS Processing] Snow quality: {
  precipTemp: "26.5°F",
  quality: "Champagne Powder"
}
[NWS Processing] Wind chill: 12.3°F
[NWS Processing] Alerts & conditions: {
  powderAlert: true,
  bluebirdDay: false,
  frostbiteRisk: true,
  windHoldRisk: false
}
[NWS Processing] Processing hourly snow forecast...
[NWS Hourly] Processing hourly forecast for next 48 hours...
[NWS Hourly] Forecast processing complete: {
  totalHours: 48,
  hoursWithSnow: 18,
  totalSnowForecast: "15.25\""
}
[NWS Processing] Hourly forecast generated: {
  totalHours: 48,
  hoursWithSnow: 18
}
[NWS Processing] Data processing complete! ✓
[NWS API] Data processing completed in: 45.67ms
[NWS API] Processed data summary: {
  currentTemp: 28,
  snow24h: 12.5,
  snow7day: 24.75,
  hourlyForecastPoints: 48,
  powderAlert: true,
  bluebirdDay: false
}
[NWS API] Caching data to localStorage...
[NWS API] Data cached successfully with key: weather_39.6403_-106.3742
[NWS API] Fetch completed successfully! ✓
[NWS API] ========================================
```

## What Each Section Means

### API Request Flow
1. **Point Data** - Gets the forecast URLs for the coordinates
2. **Parallel Fetch** - Gets both forecast and detailed grid data simultaneously
3. **JSON Parsing** - Converts the responses to JavaScript objects

### Data Processing Flow
1. **Current Conditions** - Extracts current temp, wind from first forecast period
2. **Grid Data Counts** - Shows how many data points are available for each metric
3. **Snow Calculation** - Detailed breakdown of snow accumulation math
4. **Alerts & Conditions** - Evaluates special conditions (powder alert, bluebird, etc.)
5. **Hourly Forecast** - Generates the 48-hour snow forecast

### Timing Information
- All major operations include millisecond timing
- Helps identify performance bottlenecks
- Normal total time: 700-1500ms

### Error Handling
If errors occur, they appear in red:
```
[NWS API] ========================================
[NWS API] ERROR occurred during fetch
[NWS API] Error type: Error
[NWS API] Error message: NWS API error: 503
[NWS API] Error stack: Error: NWS API error: 503
    at fetchWeather (useNWSWeather.ts:85)
[NWS API] Attempting to load cached data with key: weather_39.6403_-106.3742
[NWS API] Cache found, age: 15.3 minutes
[NWS API] Using cached data (less than 1 hour old)
[NWS API] ========================================
```
