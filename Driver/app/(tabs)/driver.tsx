import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';

import * as Location from 'expo-location';
import { styles as commonStyles } from '../../components/common';
import { styles as driverStyles } from '../../components/driver';
import { useDriver } from '../../data/driver';
import { useTrip } from '../../data/trip';
import { supabase } from '../../lib/supabase';

const METERS_PER_MILE = 1609.344;

export default function DriverScreen() {
  const { trips, setTrips } = useTrip();
  const { driver, loading: driverLoading } = useDriver();
  const router = useRouter();

  const [available, setAvailable] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);
  const [acceptingTripID, setAcceptingTripID] = useState<string | null>(null);

  useEffect(() => {
    if (driverLoading) return;

    if (!driver) {
      setAvailable(false);
      setAvailabilityLoading(false);
      return;
    }

    let cancelled = false;

    const loadAvailability = async () => {
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('is_available')
          .eq('driver_id', driver.driverID)
          .single();

        if (cancelled) return;

        if (error) {
          console.error('Load availability error:', error.message);
          Alert.alert('Error', 'Could not load driver availability.');
        } else {
          setAvailable(data.is_available);
        }
      } catch (error) {
        if (cancelled) return;

        console.error('Load availability failed:', error);
        Alert.alert('Error', 'Could not load driver availability.');
      } finally {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      }
    };

    setAvailabilityLoading(true);
    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [driver, driverLoading]);

  const hasAccount = !driverLoading && driver !== null;

  const hasAcceptedTrip = trips.some(
    (trip) =>
      trip.status === 'Accepted' ||
      trip.status === 'Started'
  );

  const handleAvailabilityChange = async (value: boolean) => {
    if (
      !driver ||
      availabilityLoading ||
      availabilityUpdating
    ) {
      return;
    }

    const previousValue = available;

    setAvailabilityUpdating(true);
    setAvailable(value);

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_available: value })
        .eq('driver_id', driver.driverID);

      if (error) {
        setAvailable(previousValue);
        console.error('Update availability error:', error.message);
        Alert.alert('Error', 'Could not update driver availability.');
      }
    } catch (error) {
      setAvailable(previousValue);
      console.error('Update availability failed:', error);
      Alert.alert('Error', 'Could not update driver availability.');
    } finally {
      setAvailabilityUpdating(false);
    }
  };

  const acceptTrip = async (tripID: string) => {
    if (
      !hasAccount ||
      !driver ||
      acceptingTripID !== null
    ) {
      return;
    }

    setAcceptingTripID(tripID);

    try {
      // Get the driver's current location.
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Please allow location access to accept a trip.'
        );
        return;
      }

      let driverLatitude: number;
      let driverLongitude: number;

      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        driverLatitude = position.coords.latitude;
        driverLongitude = position.coords.longitude;
      } catch (error) {
        console.error('Get current location failed:', error);

        Alert.alert(
          'Location Error',
          'Could not determine your current location. Please try again.'
        );
        return;
      }

      // Check whether the driver already has an active trip.
      // The database acceptance function also enforces this atomically.
      const { data: acceptedTrip, error: acceptedTripError } =
        await supabase
          .from('trips')
          .select('trip_id')
          .eq('driver_id', driver.driverID)
          .in('status', ['Accepted', 'Started'])
          .limit(1)
          .maybeSingle();

      if (acceptedTripError) {
        Alert.alert(
          'Trip Error',
          `The driver's current trip could not be checked.\n\n${acceptedTripError.message}`
        );
        return;
      }

      if (acceptedTrip) {
        Alert.alert(
          'Trip Not Accepted',
          'You can only accept one trip at a time.'
        );
        return;
      }

      // Load the customer's saved pickup coordinates.
      const { data: tripLocation, error: locationError } =
        await supabase
          .from('trips')
          .select('trip_from_lat, trip_from_lon')
          .eq('trip_id', tripID)
          .eq('status', 'Requested')
          .maybeSingle();

      if (locationError || !tripLocation) {
        Alert.alert(
          'Trip Error',
          `Could not load the pickup coordinates.\n\n${
            locationError?.message ?? 'Trip not found.'
          }`
        );
        return;
      }

      if (
        tripLocation.trip_from_lat == null ||
        tripLocation.trip_from_lon == null
      ) {
        Alert.alert(
          'Trip Error',
          "The customer's pickup coordinates are missing."
        );
        return;
      }

      // Calculate driving distance from the driver to the pickup point.
      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

      if (!token) {
        Alert.alert(
          'Trip Error',
          'Mapbox access token is missing.'
        );
        return;
      }

      let arrivalDistance: number;

      try {
        const coordinates =
          `${driverLongitude},${driverLatitude};` +
          `${tripLocation.trip_from_lon},${tripLocation.trip_from_lat}`;

        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}` +
          `?overview=false&access_token=${token}`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Could not calculate driving distance.');
        }

        const data = await response.json();

        if (!data.routes?.length) {
          throw new Error('No driving route was found.');
        }

        // Mapbox returns meters; convert to miles.
        arrivalDistance =
          data.routes[0].distance / METERS_PER_MILE;
      } catch (error) {
        Alert.alert(
          'Arrival Distance Error',
          error instanceof Error
            ? error.message
            : 'Unable to calculate arrival distance.'
        );
        return;
      }

      // The Edge Function verifies payout readiness and performs
      // the secure, atomic trip acceptance.
      const { data: acceptance, error } =
        await supabase.functions.invoke('accept-trip', {
          body: {
            tripID,
            driverLatitude,
            driverLongitude,
            arrivalDistance,
          },
        });

      if (
        error ||
        acceptance?.error ||
        acceptance?.status !== 'Accepted'
      ) {
        const message =
          acceptance?.error ??
          error?.message ??
          'The trip could not be accepted. Please refresh and try again.';

        console.error('Trip acceptance failed:', message);
        Alert.alert('Trip Not Accepted', message);
        return;
      }

      console.log('Trip acceptance saved:', acceptance);

      // The server has also set the database availability to false.
      setAvailable(false);

      // Keep the local UI in sync with the database.
      setTrips((currentTrips) =>
        currentTrips.map((trip) =>
          trip.tripID === tripID
            ? {
                ...trip,
                driverID: driver.driverID,
                driverFirstName: driver.firstName,
                truck: `${driver.make} ${driver.model}`,
                truckPhoto: driver.truckPhoto,
                driverArrivalTrip: {
                  lat: driverLatitude,
                  lon: driverLongitude,
                },
                distanceToArrival: arrivalDistance,
                status: 'Accepted',
              }
            : trip
        )
      );
    } catch (error) {
      console.error('Accept trip failed:', error);

      Alert.alert(
        'Trip Error',
        'An unexpected error occurred while accepting the trip. Please try again.'
      );
    } finally {
      setAcceptingTripID(null);
    }
  };

  const startTrip = async (tripID: string) => {
    if (!driver) return;

    const { data: updatedTrips, error } = await supabase
      .from('trips')
      .update({
        status: 'Started',
      })
      .eq('trip_id', tripID)
      .eq('driver_id', driver.driverID)
      .eq('status', 'Accepted')
      .select('trip_id');

    if (error) {
      Alert.alert(
        'Trip Error',
        `The trip could not be started.\n\n${error.message}`
      );
      return;
    }

    if (!updatedTrips || updatedTrips.length === 0) {
      Alert.alert(
        'Trip Not Started',
        'The trip is no longer accepted or cannot be updated.'
      );
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.tripID === tripID
          ? { ...trip, status: 'Started' }
          : trip
      )
    );
  };

  const abortTrip = async (tripID: string) => {
    if (!driver) return;

    const { data, error } = await supabase.functions.invoke(
      'abort-trip',
      {
        body: { tripID },
      }
    );

    if (error || data?.error) {
      console.error(
        'Abort trip error:',
        error?.message ?? data?.error
      );

      Alert.alert(
        'Trip Error',
        data?.error ??
          `The trip could not be aborted.\n\n${error?.message ?? 'Please try again.'}`
      );
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.tripID === tripID
          ? { ...trip, status: 'Aborted' }
          : trip
      )
    );
  };

  const visibleTrips = trips.filter(
    (trip) =>
      trip.status === 'Requested' ||
      trip.status === 'Accepted' ||
      trip.status === 'Started'
  );

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={commonStyles.contentContainer}
    >
      {/* Page Header */}
      <View style={driverStyles.pageHeader}>
        <View style={driverStyles.pageHeaderContent}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={driverStyles.pageSubtitle}>
              To view trips{' '}
              <Text
                style={driverStyles.accountLink}
                onPress={() => router.push('/driver_account')}
              >
                Log in
              </Text>
            </Text>
          </View>

          <Pressable
            style={driverStyles.accountButton}
            onPress={() => router.push('/driver_account')}
          >
            <MaterialCommunityIcons
              name={
                hasAccount
                  ? 'account-check'
                  : 'account-outline'
              }
              size={30}
              color={
                hasAccount
                  ? '#F59E0B'
                  : '#B8BCC4'
              }
            />
          </Pressable>
        </View>

        {driverLoading ? null : hasAccount ? (
          <View style={driverStyles.availabilityRow}>
            <Text style={driverStyles.availabilityText}>
              I&apos;m available to receive trips
            </Text>

            <Switch
              value={available}
              onValueChange={handleAvailabilityChange}
              disabled={
                !hasAccount ||
                availabilityLoading ||
                availabilityUpdating
              }
              trackColor={{
                false: '#6B7280',
                true: '#F59E0B',
              }}
              thumbColor="#F5F5F5"
              ios_backgroundColor="#6B7280"
            />
          </View>
        ) : null}
      </View>

      {/* Trip Cards */}
      {visibleTrips.length === 0 ? (
        <View style={driverStyles.tripCard}>
          <Text style={driverStyles.availabilityMessage}>
            No trips available.
          </Text>
        </View>
      ) : (
        visibleTrips.map((trip) => (
          <View
            key={trip.tripID}
            style={driverStyles.tripCard}
          >
            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripID}>Trip </Text>
              {trip.tripID}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>Customer: </Text>
              {trip.customerFirstName || '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>Phone: </Text>
              {trip.phone || '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>From: </Text>
              {trip.from || '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>To: </Text>
              {trip.to || '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>Cargo: </Text>
              {trip.cargo || '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>Distance: </Text>
              {trip.distance != null
                ? `${trip.distance.toFixed(1)} mi`
                : '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>Fare: </Text>
              {trip.fare != null
                ? `$${trip.fare.toFixed(2)}`
                : '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>Payout: </Text>
              {trip.payout != null
                ? `$${trip.payout.toFixed(2)}`
                : '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.status}>Status: </Text>
              {trip.status}
            </Text>

            {/* Accept Trip */}
            {trip.status === 'Requested' &&
              available &&
              !hasAcceptedTrip && (
                <Pressable
                  style={[
                    driverStyles.acceptButton,
                    acceptingTripID !== null && { opacity: 0.6 },
                  ]}
                  disabled={acceptingTripID !== null}
                  onPress={() => acceptTrip(trip.tripID)}
                >
                  <MaterialCommunityIcons
                    name="car-pickup"
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={driverStyles.buttonText}>
                    {acceptingTripID === trip.tripID
                      ? 'Accepting...'
                      : 'Accept'}
                  </Text>
                </Pressable>
              )}

            {/* Not Available */}
            {trip.status === 'Requested' && !available && (
              <Text style={driverStyles.availabilityMessage}>
                Turn on availability to accept this trip.
              </Text>
            )}

            {/* Start and Abort Trip */}
            {trip.status === 'Accepted' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[driverStyles.acceptButton, { flex: 1 }]}
                  onPress={() => startTrip(trip.tripID)}
                >
                  <MaterialCommunityIcons
                    name="play-circle"
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={driverStyles.buttonText}>Start</Text>
                </Pressable>

                <Pressable
                  style={[driverStyles.abortButton, { flex: 1 }]}
                  onPress={() => abortTrip(trip.tripID)}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={driverStyles.buttonText}>
                    Abort Trip
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}