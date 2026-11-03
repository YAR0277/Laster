import * as Location from 'expo-location';

import type {
    Coordinates,
    LocationProvider,
} from './types';

export const nativeLocationProvider: LocationProvider = {
  async getCurrentLocationLatLon(): Promise<Coordinates> {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      throw new Error('Location permission was not granted.');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  },
};