/**
 * The display model now lives in lib/conditions.ts and is provider-agnostic.
 * These aliases keep existing component imports working; prefer importing
 * RiderConditions directly in new code.
 */
export type { RiderConditions as ProcessedWeatherData, HourlySnowData } from '@/lib/conditions';

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

