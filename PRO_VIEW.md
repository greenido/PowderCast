# Pro View Feature Documentation

## Overview

The **Pro View** is a comprehensive data visualization component that displays ALL weather information from the National Weather Service (NWS) gridpoint API. It provides an advanced, detailed view for users who want complete meteorological data beyond the simplified consumer view.

## Features

### 1. **Collapsible Data Sections**
The Pro View organizes data into logical, expandable sections:

- **❄️ Snow & Precipitation**
  - 24h, 48h, and 7-day snow accumulation
  - Snow level (elevation)
  - Precipitation probability
  - Quantitative precipitation
  - Ice accumulation

- **🌡️ Temperature**
  - Current temperature
  - Feels like (apparent temperature)
  - Wind chill
  - Dewpoint
  - Today's high/low
  - Relative humidity

- **💨 Wind**
  - Current wind speed and gusts
  - Wind direction
  - Maximum gusts (24h)
  - Transport wind data

- **👁️ Visibility & Sky**
  - Visibility distance
  - Sky cover percentage
  - Ceiling height
  - Cloud condition classification

- **⚡ Atmospheric**
  - Elevation
  - Mixing height
  - Thunder probability

### 2. **Quick Stats Dashboard**
At the top of Pro View, a summary card displays the four most critical metrics:
- Snow (24h)
- Temperature
- Wind Speed
- Visibility

### 3. **Hourly Snow Timeline**
A horizontal scrollable timeline showing snowfall predictions for the next 24 hours with:
- Hour-by-hour breakdown
- Snow accumulation in inches
- Visual progression

### 4. **Real-Time Data**
- Displays the last update timestamp from NWS
- Manual refresh button to fetch latest data
- Data is fetched on-demand (only when user clicks "Load Pro View Data")

## Technical Implementation

### Component: `ProView.tsx`

**Location:** `/components/ProView.tsx`

**Props:**
```typescript
interface ProViewProps {
  gridpointUrl: string | null;
}
```

**Key Features:**
- Fetches raw gridpoint data directly from NWS API
- Converts all units (Celsius to Fahrenheit, mm to inches, meters to feet, km/h to mph)
- Calculates derived metrics (snow accumulation periods, max gusts)
- Collapsible sections with state management
- Responsive grid layouts

### Data Flow

1. User selects a resort
2. `useNWSWeather` hook fetches weather data and stores `gridDataUrl`
3. User clicks "Show Pro View" button
4. `ProView` component becomes visible
5. User clicks "Load Pro View Data"
6. Component fetches complete gridpoint data from NWS API
7. Data is processed and displayed in organized sections

### Integration Points

**Modified Files:**
- `app/page.tsx` - Added Pro View toggle and conditional rendering
- `components/ProView.tsx` - New component
- `hooks/useNWSWeather.ts` - Added `gridDataUrl` to processed data
- `lib/nwsTypes.ts` - Updated `ProcessedWeatherData` interface

## Usage

1. **Select a Resort:** Choose any ski resort from the search bar
2. **Toggle Pro View:** Click the "Show Pro View" button (with beaker icon)
3. **Load Data:** Click "Load Pro View Data" button
4. **Explore Sections:** Click section headers to expand/collapse
5. **View Timeline:** Scroll horizontally through hourly snow forecast
6. **Refresh:** Use the refresh button to get latest data

## Unit Conversions

The Pro View automatically converts all NWS metric units to imperial:

| Metric | Conversion | Display Unit |
|--------|-----------|--------------|
| Temperature (°C) | × 9/5 + 32 | °F |
| Precipitation (mm) | ÷ 25.4 | inches |
| Elevation (m) | × 3.28084 | feet |
| Wind Speed (km/h) | × 0.621371 | mph |
| Visibility (m) | ÷ 1609.34 | miles |

## Data Sources

All data comes directly from:
- **API:** `https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}`
- **Format:** GeoJSON
- **Update Frequency:** Varies by location, typically hourly
- **Coverage:** All NWS-covered locations in the US

## Example API Response Structure

```json
{
  "properties": {
    "updateTime": "2026-02-20T02:37:39+00:00",
    "temperature": { "values": [...] },
    "snowfallAmount": { "values": [...] },
    "windSpeed": { "values": [...] },
    ...
  }
}
```

## Benefits

1. **Complete Transparency:** Users see ALL data, not just highlights
2. **Professional Use:** Suitable for ski patrol, avalanche forecasters, resort operations
3. **Educational:** Learn how weather forecasting works
4. **Verification:** Cross-check simplified view with raw data
5. **Research:** Access historical patterns and trends

## Performance Considerations

- **Lazy Loading:** Data is only fetched when user explicitly requests it
- **No Caching:** Always fetches fresh data for accuracy
- **Efficient Rendering:** Collapsed sections don't render their content
- **Responsive Design:** Adapts to mobile, tablet, and desktop screens

## Future Enhancements

Possible additions:
- Data export to CSV/JSON
- Custom time range selection
- Graphical charts and visualizations
- Comparison between multiple locations
- Alert threshold configuration
- Data download for offline analysis

## Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (Chromium)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## API Rate Limits

NWS API guidelines:
- No official rate limit
- Recommended: < 5 requests per second
- Pro View fetches on-demand only
- Includes proper User-Agent header

## Credits

- **Data Source:** National Weather Service (NOAA)
- **API:** weather.gov
- **Icons:** Heroicons
- **Framework:** Next.js 15 + React 19
