import type { WeatherProvider, ForecastRequest } from './types';
import type { NormalizedForecast } from '@/lib/types';
import { NWSProvider } from './nws';
import { OpenMeteoProvider } from './openMeteo';
import { applyElevationCorrection } from '@/lib/lapseRate';

export type { WeatherProvider, ForecastRequest } from './types';
export { NWSProvider } from './nws';
export { OpenMeteoProvider } from './openMeteo';

const nws = new NWSProvider();
const openMeteo = new OpenMeteoProvider();

export const providers = { nws, openMeteo };

export interface ProviderSelection {
  primary: WeatherProvider;
  fallback: WeatherProvider | null;
}

/**
 * Choose providers for a coordinate.
 *
 * Inside the US we lead with NWS: it is the authoritative local forecast, it is
 * the only source of the prose discussion riders actually read, and it is
 * tuned by local forecast offices who know the terrain. Everywhere else, and as
 * the US fallback, Open-Meteo — global, keyless, CORS-enabled, and able to
 * downscale to a specific elevation.
 */
export function selectProviders(lat: number, lon: number): ProviderSelection {
  if (nws.covers(lat, lon)) {
    return { primary: nws, fallback: openMeteo };
  }
  return { primary: openMeteo, fallback: null };
}

/**
 * Fetch a forecast, falling back to the secondary provider if the primary
 * fails. NWS gridpoints 500 with some regularity and go down for maintenance;
 * falling through to Open-Meteo beats showing an error.
 *
 * When the serving provider cannot resolve elevation (NWS), a lapse-rate
 * correction is applied so that base and summit actually differ. Without it
 * the two views return the same numbers: a resort's base and summit sit a few
 * hundred metres apart, inside a single 2.5km grid cell.
 */
export async function fetchForecast(
  request: ForecastRequest
): Promise<NormalizedForecast> {
  const { primary, fallback } = selectProviders(request.lat, request.lon);

  const serve = async (provider: WeatherProvider) => {
    const forecast = await provider.fetchForecast(request);

    if (provider.resolvesElevation || request.elevationM === undefined) {
      return forecast;
    }
    return applyElevationCorrection(forecast, request.elevationM);
  };

  try {
    return await serve(primary);
  } catch (err) {
    if (!fallback) throw err;

    console.warn(
      `[providers] ${primary.id} failed (${
        err instanceof Error ? err.message : err
      }), falling back to ${fallback.id}`
    );
    return serve(fallback);
  }
}
