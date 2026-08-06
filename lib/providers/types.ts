import type { NormalizedForecast } from '@/lib/types';

export interface ForecastRequest {
  lat: number;
  lon: number;
  /**
   * Elevation of the point in metres. Providers that accept it (Open-Meteo)
   * use it to downscale; providers that don't (NWS) ignore it and the caller
   * applies a lapse-rate correction instead.
   */
  elevationM?: number;
  /** IANA timezone for aligning local-day boundaries. */
  timezone?: string;
  signal?: AbortSignal;
}

export interface WeatherProvider {
  id: string;
  name: string;
  /** True when this provider can serve the given coordinate. */
  covers(lat: number, lon: number): boolean;
  /** True when the provider's own model resolves elevation. */
  readonly resolvesElevation: boolean;
  fetchForecast(request: ForecastRequest): Promise<NormalizedForecast>;
}
