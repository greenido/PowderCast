// NWS API TypeScript Interfaces

export interface NWSPoint {
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

export interface NWSForecastPeriod {
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
  probabilityOfPrecipitation?: {
    value: number | null;
  };
}

export interface NWSForecast {
  properties: {
    updated: string;
    units: string;
    periods: NWSForecastPeriod[];
  };
}

export interface NWSGridDataValue {
  validTime: string;
  value: number | null;
}

export interface NWSGridData {
  properties: {
    temperature?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    dewpoint?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    relativeHumidity?: {
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
    iceAccumulation?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    quantitativePrecipitation?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    probabilityOfPrecipitation?: {
      values: NWSGridDataValue[];
      uom: string;
    };
    visibility?: {
      values: NWSGridDataValue[];
      uom: string;
    };
  };
}

export interface WeatherData {
  forecast: NWSForecast;
  gridData: NWSGridData;
  location: {
    city: string;
    state: string;
  };
}

export interface ProcessedWeatherData {
  // Current conditions
  currentTemp: number;
  currentWindSpeed: number;
  currentWindGust: number;
  currentVisibility: number;
  currentSkyCover: number;
  currentHumidity: number;
  currentDewpoint: number;

  // Snow accumulation
  snow24h: number;
  snow7day: number;

  // Wind data
  maxWindGust24h: number;
  maxWindGust7day: number;
  avgWindSpeed: number;

  // Temperature ranges (next 24h)
  maxTemp24h: number;
  minTemp24h: number;

  // Precipitation probability (next 24h)
  maxPrecipProb24h: number;

  // Forecast periods
  periods: NWSForecastPeriod[];

  // Calculated metrics
  snowQuality: string;
  windHoldRisk: boolean;
  frostbiteRisk: boolean;
  bluebirdDay: boolean;
  powderAlert: boolean;

  // Temperature during precipitation
  precipTemp: number | null;

  // Gridpoint URL for Pro View
  gridDataUrl: string;

  // Hourly snow forecast
  hourlySnowForecast: HourlySnowData[];
}

export interface HourlySnowData {
  time: string; // ISO timestamp
  hour: number; // Hour of day (0-23)
  snowfall: number; // Inches
  temperature: number; // Fahrenheit
  windSpeed: number; // mph
  snowQuality: string;
}
