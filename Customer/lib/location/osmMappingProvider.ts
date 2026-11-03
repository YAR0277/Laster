
import type {
    Coordinates,
    GeocodingResult,
    MappingProvider,
    RouteInfo,
} from './types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OSRM_URL = 'https://router.project-osrm.org';

// Identify the application when contacting Nominatim.
// Replace the contact value with a project contact email if available.
const USER_AGENT = 'Laster/1.0 (Laster app)';

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type OsrmRouteResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
  }[];
};

function validCoordinates(
  coordinates: Coordinates
): boolean {
  return (
    Number.isFinite(coordinates.latitude) &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180
  );
}

export const osmMappingProvider: MappingProvider = {
  async doGeocode(
    address: string
  ): Promise<GeocodingResult | null> {
    const query = address.trim();

    if (!query) return null;

    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '5',
      addressdetails: '1',
    });

    const response = await fetch(
      `${NOMINATIM_URL}/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Nominatim geocoding failed: HTTP ${response.status}`
      );
    }

    const results = await response.json() as NominatimResult[];

    if (!results.length) return null;

    const result = results[0];
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      throw new Error('Nominatim returned invalid coordinates.');
    }

    return {
      coordinates: { latitude, longitude },
      formattedAddress: result.display_name,
    };
  },

  async doReverseGeocode(
    coordinates: Coordinates
  ): Promise<string | null> {
    if (!validCoordinates(coordinates)) {
      throw new Error('Invalid coordinates.');
    }

    const params = new URLSearchParams({
      lat: String(coordinates.latitude),
      lon: String(coordinates.longitude),
      format: 'jsonv2',
    });

    const response = await fetch(
      `${NOMINATIM_URL}/reverse?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Nominatim reverse geocoding failed: HTTP ${response.status}`
      );
    }

    const result = await response.json();

    return typeof result.display_name === 'string'
      ? result.display_name
      : null;
  },

  async calcRouteDistance(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<RouteInfo | null> {
    if (
      !validCoordinates(origin) ||
      !validCoordinates(destination)
    ) {
      throw new Error('Invalid route coordinates.');
    }

    // OSRM expects longitude,latitude coordinate order.
    const coordinates = [
      `${origin.longitude},${origin.latitude}`,
      `${destination.longitude},${destination.latitude}`,
    ].join(';');

    const response = await fetch(
      `${OSRM_URL}/route/v1/driving/${coordinates}?overview=false&steps=false`
    );

    if (!response.ok) {
      throw new Error(
        `OSRM route request failed: HTTP ${response.status}`
      );
    }

    const result = await response.json() as OsrmRouteResponse;
    const route = result.routes?.[0];

    if (
      result.code !== 'Ok' ||
      !route ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration)
    ) {
      return null;
    }

    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  },
};
