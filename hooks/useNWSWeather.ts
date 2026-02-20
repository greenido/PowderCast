import { useState, useEffect, useCallback } from 'react';
import type { 
  WeatherData, 
  ProcessedWeatherData, 
  NWSGridDataValue,
  HourlySnowData
} from '@/lib/nwsTypes';
import { 
  cmToInches, 
  parseWindSpeed, 
  calculateWindChill 
} from '@/lib/unitConversion';
import {
  determineSnowQuality,
  isPowderAlert,
  isBluebirdDay,
  hasFrostbiteRisk,
  hasWindHoldRisk,
} from '@/lib/snowLogic';

// Enable detailed logging - set to false to reduce console output
const ENABLE_DETAILED_LOGS = true;

function log(...args: any[]) {
  if (ENABLE_DETAILED_LOGS) {
    console.log(...args);
  }
}

function logError(...args: any[]) {
  console.error(...args);
}

export function useNWSWeather(lat: number | null, lon: number | null) {
  const [weatherData, setWeatherData] = useState<ProcessedWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    if (!lat || !lon) {
      log('[NWS API] No coordinates provided, skipping fetch');
      return;
    }

    log('[NWS API] ========================================');
    log('[NWS API] Starting weather fetch');
    log('[NWS API] Coordinates:', { lat, lon });
    log('[NWS API] Timestamp:', new Date().toISOString());
    
    setLoading(true);
    setError(null);

    try {
      // Fetch directly from NWS API (supports CORS)
      const NWS_API_BASE = 'https://api.weather.gov';
      const USER_AGENT = 'PowderCast/1.1 (contact@powdercast.app)';

      // Step 1: Get the point data
      const pointUrl = `${NWS_API_BASE}/points/${lat},${lon}`;
      log('[NWS API] Step 1: Fetching point data');
      log('[NWS API] URL:', pointUrl);
      
      const pointStartTime = performance.now();
      const pointResponse = await fetch(
        pointUrl,
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/geo+json',
          },
        }
      );
      const pointEndTime = performance.now();
      
      log('[NWS API] Point response status:', pointResponse.status);
      log('[NWS API] Point response time:', `${(pointEndTime - pointStartTime).toFixed(2)}ms`);

      if (!pointResponse.ok) {
        const errorText = await pointResponse.text();
        logError('[NWS API] Point request failed:', {
          status: pointResponse.status,
          statusText: pointResponse.statusText,
          body: errorText,
        });
        throw new Error(`NWS API error: ${pointResponse.status}`);
      }

      const pointData = await pointResponse.json();
      log('[NWS API] Point data received:', {
        forecastUrl: pointData.properties.forecast,
        gridDataUrl: pointData.properties.forecastGridData,
        location: {
          city: pointData.properties.relativeLocation?.properties?.city,
          state: pointData.properties.relativeLocation?.properties?.state,
        },
      });
      const forecastUrl = pointData.properties.forecast;
      const gridDataUrl = pointData.properties.forecastGridData;
      const location = {
        city: pointData.properties.relativeLocation?.properties?.city || 'Unknown',
        state: pointData.properties.relativeLocation?.properties?.state || 'Unknown',
      };

      // Step 2: Fetch forecast and grid data in parallel
      log('[NWS API] Step 2: Fetching forecast and grid data in parallel');
      log('[NWS API] Forecast URL:', forecastUrl);
      log('[NWS API] Grid Data URL:', gridDataUrl);
      
      const parallelStartTime = performance.now();
      const [forecastResponse, gridDataResponse] = await Promise.all([
        fetch(forecastUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/geo+json',
          },
        }),
        fetch(gridDataUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/geo+json',
          },
        }),
      ]);
      const parallelEndTime = performance.now();
      
      log('[NWS API] Parallel requests completed in:', `${(parallelEndTime - parallelStartTime).toFixed(2)}ms`);
      log('[NWS API] Forecast response status:', forecastResponse.status);
      log('[NWS API] Grid data response status:', gridDataResponse.status);

      if (!forecastResponse.ok || !gridDataResponse.ok) {
        const errors = [];
        if (!forecastResponse.ok) {
          const errorText = await forecastResponse.text();
          errors.push(`Forecast: ${forecastResponse.status} - ${errorText}`);
        }
        if (!gridDataResponse.ok) {
          const errorText = await gridDataResponse.text();
          errors.push(`Grid: ${gridDataResponse.status} - ${errorText}`);
        }
        logError('[NWS API] Failed to fetch weather data:', errors);
        throw new Error('Failed to fetch weather data');
      }

      log('[NWS API] Parsing JSON responses...');
      const parseStartTime = performance.now();
      const [forecast, gridData] = await Promise.all([
        forecastResponse.json(),
        gridDataResponse.json(),
      ]);
      const parseEndTime = performance.now();
      log('[NWS API] JSON parsing completed in:', `${(parseEndTime - parseStartTime).toFixed(2)}ms`);
      
      log('[NWS API] Forecast periods:', forecast.properties.periods?.length || 0);
      log('[NWS API] Grid data available:', {
        temperature: !!gridData.properties.temperature,
        windSpeed: !!gridData.properties.windSpeed,
        windGust: !!gridData.properties.windGust,
        snowfallAmount: !!gridData.properties.snowfallAmount,
        skyCover: !!gridData.properties.skyCover,
        visibility: !!gridData.properties.visibility,
      });
      log('[NWS API] Snow data points:', gridData.properties.snowfallAmount?.values?.length || 0);
      
      // Log first 10 snow data points for debugging
      const snowValues = gridData.properties.snowfallAmount?.values || [];
      log('[NWS API] ========================================');
      log('[NWS API] RAW SNOW DATA (first 10 points):');
      snowValues.slice(0, 10).forEach((val: any, idx: number) => {
        log(`[NWS API]   [${idx}] time: ${val.validTime}, value: ${val.value}cm`);
      });
      log('[NWS API] ========================================');

      const data: WeatherData = { forecast, gridData, location };
      
      log('[NWS API] Processing weather data...');
      const processStartTime = performance.now();
      const processed = processWeatherData(data);
      // Add gridDataUrl to processed data
      const processedWithUrl = {
        ...processed,
        gridDataUrl,
      };
      const processEndTime = performance.now();
      log('[NWS API] Data processing completed in:', `${(processEndTime - processStartTime).toFixed(2)}ms`);
      log('[NWS API] Processed data summary:', {
        currentTemp: processed.currentTemp,
        snow24h: processed.snow24h,
        snow7day: processed.snow7day,
        hourlyForecastPoints: processed.hourlySnowForecast.length,
        powderAlert: processed.powderAlert,
        bluebirdDay: processed.bluebirdDay,
        gridDataUrl,
      });
      
      setWeatherData(processedWithUrl);
      
      // Cache in localStorage
      log('[NWS API] Caching data to localStorage...');
      const cacheKey = `weather_${lat}_${lon}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        data: processedWithUrl,
        timestamp: Date.now(),
      }));
      log('[NWS API] Data cached successfully with key:', cacheKey);
      log('[NWS API] Fetch completed successfully! ✓');
      log('[NWS API] ========================================');
    } catch (err) {
      logError('[NWS API] ========================================');
      logError('[NWS API] ERROR occurred during fetch');
      logError('[NWS API] Error type:', err instanceof Error ? err.constructor.name : typeof err);
      logError('[NWS API] Error message:', err instanceof Error ? err.message : String(err));
      logError('[NWS API] Error stack:', err instanceof Error ? err.stack : 'N/A');
      
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Try to load from cache
      const cacheKey = `weather_${lat}_${lon}`;
      log('[NWS API] Attempting to load cached data with key:', cacheKey);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          const cacheAgeMinutes = (cacheAge / 60000).toFixed(1);
          log('[NWS API] Cache found, age:', `${cacheAgeMinutes} minutes`);
          
          // Use cache if less than 1 hour old
          if (cacheAge < 3600000) {
            setWeatherData(data);
            setError('Using cached data (offline)');
            log('[NWS API] Using cached data (less than 1 hour old)');
          } else {
            log('[NWS API] Cache too old (>1 hour), not using');
          }
        } catch (cacheErr) {
          logError('[NWS API] Failed to parse cached data:', cacheErr);
        }
      } else {
        log('[NWS API] No cached data available');
      }
      logError('[NWS API] ========================================');
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  return { weatherData, loading, error, refresh: fetchWeather };
}

function processWeatherData(data: WeatherData): ProcessedWeatherData {
  log('[NWS Processing] Starting data processing...');
  const { forecast, gridData } = data;
  const periods = forecast.properties.periods;

  // Extract current conditions (first period)
  const currentPeriod = periods[0];
  const currentTemp = currentPeriod.temperature;
  const currentWindSpeed = parseWindSpeed(currentPeriod.windSpeed);
  log('[NWS Processing] Current conditions:', {
    temp: currentTemp,
    windSpeed: currentWindSpeed,
    period: currentPeriod.name,
  });

  // Get grid data values
  const windGustValues = gridData.properties.windGust?.values || [];
  const snowValues = gridData.properties.snowfallAmount?.values || [];
  const tempValues = gridData.properties.temperature?.values || [];
  const skyCoverValues = gridData.properties.skyCover?.values || [];
  const visibilityValues = gridData.properties.visibility?.values || [];
  
  log('[NWS Processing] Grid data values count:', {
    windGust: windGustValues.length,
    snow: snowValues.length,
    temp: tempValues.length,
    skyCover: skyCoverValues.length,
    visibility: visibilityValues.length,
  });

  // Calculate 24h and 7-day snow accumulation
  // NOTE: NWS Grid Data API provides FORECAST data (future), not observations (past)
  // We calculate both NEXT 24h and NEXT 7 days forecasts
  const now = Date.now();
  log('[NWS Processing] Calculating snow accumulation...');
  
  // Calculate forward-looking forecasts
  const snow24h = sumSnowfallForward(snowValues, now, 24);
  const snow7day = sumSnowfallForward(snowValues, now, 168);
  
  log('[NWS Processing] Snow accumulation:', {
    snow24h: `${snow24h.toFixed(2)}" (next 24h)`,
    snow7day: `${snow7day.toFixed(2)}" (next 7 days)`,
  });

  // Get max wind gusts (looking backward in time)
  const maxWindGust24h = getMaxValueBackward(windGustValues, now, 24);
  const maxWindGust7day = getMaxValueBackward(windGustValues, now, 168);
  log('[NWS Processing] Wind gusts:', {
    max24h: `${maxWindGust24h.toFixed(1)} mph`,
    max7day: `${maxWindGust7day.toFixed(1)} mph`,
  });

  // Get current conditions
  const currentWindGust = windGustValues[0]?.value || currentWindSpeed;
  const currentSkyCover = skyCoverValues[0]?.value || 0;
  const currentVisibility = visibilityValues[0]?.value || 16000; // meters

  // Calculate average wind speed (next 24h)
const avgWindSpeed = getAverageValue(
    gridData.properties.windSpeed?.values || [], 
    now, 
    24
  );
  log('[NWS Processing] Average wind speed (next 24h):', `${avgWindSpeed.toFixed(1)} mph`);

  // Determine snow quality from temperature during precipitation
  let precipTemp: number | null = null;
  let snowQuality = 'Premium Packed';
  
  if (snow24h > 0) {
    // Get avg temp during snow periods (past 24h)
    precipTemp = getAverageValueBackward(tempValues, now, 24);
    snowQuality = determineSnowQuality(precipTemp);
    log('[NWS Processing] Snow quality:', {
      precipTemp: precipTemp ? `${precipTemp.toFixed(1)}°F` : 'N/A',
      quality: snowQuality,
    });
  } else {
    log('[NWS Processing] No snow in past 24h, quality determination skipped');
  }

  // Calculate wind chill
  const windChill = calculateWindChill(currentTemp, currentWindSpeed);
  log('[NWS Processing] Wind chill:', `${windChill.toFixed(1)}°F`);

  // Check alerts and conditions
  const powderAlert = isPowderAlert(snow24h);
  const bluebirdDay = isBluebirdDay(currentSkyCover, currentWindSpeed);
  const frostbiteRisk = hasFrostbiteRisk(windChill);
  const windHoldRisk = hasWindHoldRisk(maxWindGust24h);
  log('[NWS Processing] Alerts & conditions:', {
    powderAlert,
    bluebirdDay,
    frostbiteRisk,
    windHoldRisk,
  });

  // Process hourly snow forecast (next 48 hours)
  log('[NWS Processing] Processing hourly snow forecast...');
  const hourlySnowForecast = processHourlySnowForecast(
    snowValues,
    tempValues,
    gridData.properties.windSpeed?.values || []
  );
  log('[NWS Processing] Hourly forecast generated:', {
    totalHours: hourlySnowForecast.length,
    hoursWithSnow: hourlySnowForecast.filter(h => h.snowfall > 0).length,
  });

  log('[NWS Processing] Data processing complete! ✓');
  
  return {
    currentTemp,
    currentWindSpeed,
    currentWindGust,
    currentVisibility,
    currentSkyCover,
    snow24h,
    snow7day,
    maxWindGust24h,
    maxWindGust7day,
    avgWindSpeed,
    periods,
    snowQuality,
    windHoldRisk,
    frostbiteRisk,
    bluebirdDay,
    powderAlert,
    precipTemp,
    hourlySnowForecast,
    gridDataUrl: '', // Will be set by caller
  };
}

function sumSnowfallBackward(
  values: NWSGridDataValue[], 
  currentTime: number, 
  hours: number
): number {
  const startTime = currentTime - (hours * 3600000); // Look backward in time
  let total = 0;
  let matchedPoints = 0;

  log(`[Snow Calc BACKWARD] ========================================`);
  log(`[Snow Calc BACKWARD] Calculating ${hours}h snowfall (looking backward)`);
  log(`[Snow Calc BACKWARD] Current time: ${new Date(currentTime).toISOString()}`);
  log(`[Snow Calc BACKWARD] Looking back to: ${new Date(startTime).toISOString()}`);
  log(`[Snow Calc BACKWARD] Total data points: ${values.length}`);

  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    const timeStr = new Date(time).toISOString();
    const inRange = time >= startTime && time <= currentTime;
    
    if (val.value && val.value > 0) {
      log(`[Snow Calc BACKWARD]   Data point: ${timeStr}, value: ${val.value}cm (${cmToInches(val.value).toFixed(2)}"), inRange: ${inRange}`);
    }
    
    if (time >= startTime && time <= currentTime && val.value) {
      const inches = cmToInches(val.value);
      total += inches;
      matchedPoints++;
      log(`[Snow Calc BACKWARD]   ✓ ADDED: ${inches.toFixed(2)}" (running total: ${total.toFixed(2)}")`);
    }
  }

  log(`[Snow Calc BACKWARD] Final total: ${total.toFixed(2)}" from ${matchedPoints} data points`);
  log(`[Snow Calc BACKWARD] ========================================`);

  return total;
}

function sumSnowfallForward(
  values: NWSGridDataValue[], 
  currentTime: number, 
  hours: number
): number {
  const endTime = currentTime + (hours * 3600000); // Look forward in time
  let total = 0;
  let matchedPoints = 0;

  log(`[Snow Calc FORWARD] ========================================`);
  log(`[Snow Calc FORWARD] Calculating ${hours}h snowfall (looking forward)`);
  log(`[Snow Calc FORWARD] Current time: ${new Date(currentTime).toISOString()}`);
  log(`[Snow Calc FORWARD] Looking ahead to: ${new Date(endTime).toISOString()}`);
  log(`[Snow Calc FORWARD] Total data points: ${values.length}`);

  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    const timeStr = new Date(time).toISOString();
    const inRange = time >= currentTime && time <= endTime;
    
    if (val.value && val.value > 0) {
      log(`[Snow Calc FORWARD]   Data point: ${timeStr}, value: ${val.value}cm (${cmToInches(val.value).toFixed(2)}"), inRange: ${inRange}`);
    }
    
    if (time >= currentTime && time <= endTime && val.value) {
      const inches = cmToInches(val.value);
      total += inches;
      matchedPoints++;
      log(`[Snow Calc FORWARD]   ✓ ADDED: ${inches.toFixed(2)}" (running total: ${total.toFixed(2)}")`);
    }
  }

  log(`[Snow Calc FORWARD] Final total: ${total.toFixed(2)}" from ${matchedPoints} data points`);
  log(`[Snow Calc FORWARD] ========================================`);

  return total;
}

function getMaxValueBackward(
  values: NWSGridDataValue[], 
  currentTime: number, 
  hours: number
): number {
  const startTime = currentTime - (hours * 3600000); // Look backward in time
  let max = 0;

  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    if (time >= startTime && time <= currentTime && val.value) {
      // Convert from km/h to mph if needed
      const value = val.value * 0.621371;
      max = Math.max(max, value);
    }
  }

  return max;
}

function getAverageValue(
  values: NWSGridDataValue[], 
  fromTime: number, 
  hours: number
): number {
  const endTime = fromTime + (hours * 3600000);
  const relevantValues: number[] = [];

  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    if (time >= fromTime && time <= endTime && val.value !== null) {
      relevantValues.push(val.value);
    }
  }

  if (relevantValues.length === 0) return 0;
  return relevantValues.reduce((a, b) => a + b, 0) / relevantValues.length;
}

function getAverageValueBackward(
  values: NWSGridDataValue[], 
  currentTime: number, 
  hours: number
): number {
  const startTime = currentTime - (hours * 3600000); // Look backward in time
  const relevantValues: number[] = [];

  for (const val of values) {
    const time = new Date(val.validTime.split('/')[0]).getTime();
    if (time >= startTime && time <= currentTime && val.value !== null) {
      relevantValues.push(val.value);
    }
  }

  if (relevantValues.length === 0) return 0;
  return relevantValues.reduce((a, b) => a + b, 0) / relevantValues.length;
}

function processHourlySnowForecast(
  snowValues: NWSGridDataValue[],
  tempValues: NWSGridDataValue[],
  windValues: NWSGridDataValue[]
): HourlySnowData[] {
  log('[NWS Hourly] Processing hourly forecast for next 48 hours...');
  const now = Date.now();
  const hourlyData: HourlySnowData[] = [];
  const hours = 48; // Next 48 hours
  
  let totalSnowProcessed = 0;
  let hoursWithSnow = 0;

  // Group data by hour
  for (let i = 0; i < hours; i++) {
    const hourStart = now + (i * 3600000);
    const hourEnd = hourStart + 3600000;
    
    // Find snow data for this hour
    let hourlySnow = 0;
    for (const val of snowValues) {
      const time = new Date(val.validTime.split('/')[0]).getTime();
      const duration = parseDuration(val.validTime);
      const timeEnd = time + duration;
      
      if (time >= hourStart && time < hourEnd && val.value) {
        hourlySnow += cmToInches(val.value);
      }
    }
    
    if (hourlySnow > 0) {
      hoursWithSnow++;
      totalSnowProcessed += hourlySnow;
    }
    
    // Find temperature for this hour
    let hourlyTemp = 32; // default
    for (const val of tempValues) {
      const time = new Date(val.validTime.split('/')[0]).getTime();
      if (time >= hourStart && time < hourEnd && val.value !== null) {
        // Convert from Celsius to Fahrenheit
        hourlyTemp = (val.value * 9/5) + 32;
        break;
      }
    }
    
    // Find wind speed for this hour
    let hourlyWind = 0;
    for (const val of windValues) {
      const time = new Date(val.validTime.split('/')[0]).getTime();
      if (time >= hourStart && time < hourEnd && val.value !== null) {
        // Convert from km/h to mph
        hourlyWind = val.value * 0.621371;
        break;
      }
    }
    
    // Only include hours with snowfall or first 24 hours
    if (hourlySnow > 0 || i < 24) {
      const date = new Date(hourStart);
      hourlyData.push({
        time: date.toISOString(),
        hour: date.getHours(),
        snowfall: parseFloat(hourlySnow.toFixed(2)),
        temperature: Math.round(hourlyTemp),
        windSpeed: Math.round(hourlyWind),
        snowQuality: determineSnowQuality(hourlyTemp),
      });
    }
  }
  
  log('[NWS Hourly] Forecast processing complete:', {
    totalHours: hourlyData.length,
    hoursWithSnow,
    totalSnowForecast: `${totalSnowProcessed.toFixed(2)}"`,
  });

  return hourlyData;
}

function parseDuration(validTime: string): number {
  // NWS format: "2024-01-01T12:00:00+00:00/PT1H" or similar
  const parts = validTime.split('/');
  if (parts.length < 2) return 3600000; // default 1 hour
  
  const duration = parts[1];
  const hourMatch = duration.match(/PT(\d+)H/);
  if (hourMatch) {
    return parseInt(hourMatch[1]) * 3600000;
  }
  
  return 3600000; // default 1 hour
}
