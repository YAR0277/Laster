import { supabase } from '../supabase';

import type {
    Coordinates,
    GeocodingResult,
    MappingProvider,
    RouteInfo,
} from './types';

async function invokeMapping<T>(
  action: string,
  params: Record<string, unknown>
): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke<T>(
    'google-mapping',
    {
      body: { action, ...params },
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export const googleMappingProvider: MappingProvider = {
  async doGeocode(
    address: string
  ): Promise<GeocodingResult | null> {
    return invokeMapping<GeocodingResult>('geocode', { address });
  },

  async doReverseGeocode(
    coordinates: Coordinates
  ): Promise<string | null> {
    return invokeMapping<string>('reverseGeocode', { coordinates });
  },

  async calcRouteDistance(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<RouteInfo | null> {
    return invokeMapping<RouteInfo>('route', {
      origin,
      destination,
    });
  },
};