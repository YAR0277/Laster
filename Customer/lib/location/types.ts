export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GeocodingResult = {
  coordinates: Coordinates;
  formattedAddress: string;
};

export type RouteInfo = {
  distanceMeters: number;
  durationSeconds: number;
};

// Gets the device's current GPS position.
export interface LocationProvider {
  getCurrentLocationLatLon(): Promise<Coordinates>;
}

// Handles address lookup and road routing.
export interface MappingProvider {
  doGeocode(
    address: string
  ): Promise<GeocodingResult | null>;

  doReverseGeocode(
    coordinates: Coordinates
  ): Promise<string | null>;

  calcRouteDistance(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<RouteInfo | null>;
}