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
  const [available, setAvailable] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);

  useEffect(() => {
    if (driverLoading) return;

    if (!driver) {
      setAvailable(false);
      setAvailabilityLoading(false);
      return;
    }

    let cancelled = false;

    const loadAvailability = async () => {
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

      setAvailabilityLoading(false);
    };

    setAvailabilityLoading(true);
    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [driver, driverLoading]);

  const handleAvailabilityChange = async (value: boolean) => {
    if (!driver || availabilityLoading) return;

    const previousValue = available;
    setAvailable(value);

    const { error } = await supabase
      .from('drivers')
      .update({ is_available: value })
      .eq('driver_id', driver.driverID);

    if (error) {
      setAvailable(previousValue);
      console.error('Update availability error:', error.message);
      Alert.alert('Error', 'Could not update driver availability.');
    }
  };
  const router = useRouter();
  const hasAccount = !driverLoading && driver !== null;
  const hasAcceptedTrip = trips.some(
    (trip) =>
      trip.status === 'Accepted' ||
      trip.status === 'Started'
  );

  const acceptTrip = async (tripID: string) => {
    if (!hasAccount) {
      return;
    }

    // Verify the driver's Stripe payout readiness first.
    const { data: payoutCheck, error: payoutCheckError } =
      await supabase.functions.invoke(
        'verify-driver-payout-method',
        { body: {} }
      );

    if (payoutCheckError) {
      console.error(
        'Payout readiness check failed:',
        payoutCheckError.message
      );

      Alert.alert(
        'Payout Verification Error',
        'Your payout readiness could not be verified. Please try again.'
      );
      return;
    }

    if (payoutCheck?.status !== 'ready') {
      Alert.alert(
        'Payout Setup Required',
        payoutCheck?.message ??
          'Your Stripe account must be ready for payouts before you can accept trips.'
      );
      return;
    }

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
      Alert.alert(
        'Location Error',
        'Could not determine your current location. Please try again.'
      );
      return;
    }

    // Check whether the driver already has an active trip.
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
      Alert.alert('Trip Error', 'Mapbox access token is missing.');
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
      arrivalDistance = data.routes[0].distance / METERS_PER_MILE;
    } catch (error) {
      Alert.alert(
        'Arrival Distance Error',
        error instanceof Error
          ? error.message
          : 'Unable to calculate arrival distance.'
      );
      return;
    }

    const { data: updatedTrips, error } = await supabase
      .from('trips')
      .update({
        driver_id: driver.driverID,
        driver_first_name: driver.firstName,
        truck: `${driver.make} ${driver.model}`,
        truck_photo: driver.truckPhoto,
        driver_arrival_lat: driverLatitude,
        driver_arrival_lon: driverLongitude,
        distance_to_arrival: arrivalDistance,
        status: 'Accepted',
      })
      .eq('trip_id', tripID)
      .eq('status', 'Requested')
      .select('trip_id, driver_id, status');

    if (error) {
      console.error('Trip acceptance error:', error.message);
      Alert.alert(
        'Trip Error',
        `The trip could not be accepted.\n\n${error.message}`
      );
      return;
    }

    if (!updatedTrips || updatedTrips.length === 0) {
      console.error('Trip acceptance updated zero rows:', {
        tripID,
        driverID: driver.driverID,
      });
      Alert.alert(
        'Trip Not Accepted',
        'The trip was not updated in the database. Check the trip status and database permissions.'
      );
      return;
    }

    console.log('Trip acceptance saved:', updatedTrips[0]);

    // Turn off driver availability after accepting a trip.
    const { error: availabilityError } = await supabase
      .from('drivers')
      .update({ is_available: false })
      .eq('driver_id', driver.driverID);

    if (availabilityError) {
      console.error(
        'Could not turn off driver availability:',
        availabilityError.message
      );

      Alert.alert(
        'Availability Error',
        'Your trip was accepted, but availability could not be turned off. Please check your availability.'
      );
    } else {
      setAvailable(false);
    }

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
  };

  const startTrip = async (tripID: string) => {
    if (!driver) {
      return;
    }

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
    if (!driver) {
      return;
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'Aborted',
        completed_at: new Date().toISOString(),
      })
      .eq('trip_id', tripID)
      .eq('driver_id', driver.driverID)
      .eq('status', 'Accepted');

    if (error) {
      Alert.alert(
        'Trip Error',
        `The trip could not be aborted.\n\n${error.message}`
      );
      return;
    }

    // Keep the local UI in sync with the database.
    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.tripID === tripID
          ? {
              ...trip,
              status: 'Aborted',
            }
          : trip
      )
    );
  };

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={commonStyles.contentContainer}
    >

      {/* Page Header */}
      <View style={driverStyles.pageHeader}>

        <View style={driverStyles.pageHeaderContent}>
          <View>
            <Text style={driverStyles.pageSubtitle}>
              Available Trips
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

      {driverLoading ? null : !hasAccount ? ( 
        <Text style={driverStyles.loginMessage}> 
          Please log in or open a{' '} 
          <Text style={driverStyles.accountLink} onPress={() => router.push('/driver_account')} >driver account</Text>
            {' '}to view trips. 
        </Text> ) : 
        ( 
        <View style={driverStyles.availabilityRow}> 
          <Text style={driverStyles.availabilityText}> I'm available to receive trips </Text> 
          <Switch
            value={available}
            onValueChange={handleAvailabilityChange}
            disabled={!hasAccount || availabilityLoading}
            trackColor={{
              false: '#6B7280',
              true: '#F59E0B',
            }}
            thumbColor="#F5F5F5"
            ios_backgroundColor="#6B7280"
          /> 
        </View> )}

      </View>

      {/* Trip Cards */}
      {trips.filter(
        (trip) =>
          trip.status === 'Requested' ||
          trip.status === 'Accepted'  ||
          trip.status === 'Started'
      ).length === 0 ? (
        <View style={driverStyles.tripCard}>
          <Text style={driverStyles.availabilityMessage}>
            No trips available.
          </Text>
        </View>
      ) : (
        trips
          .filter(
            (trip) =>
              trip.status === 'Requested' ||
              trip.status === 'Accepted'  ||
              trip.status === 'Started'
          )
          .map((trip) => (
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
              {trip.distance !== null
                ? `${trip.distance.toFixed(1)} mi`
                : '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>Fare: </Text>
              {trip.fare !== null
                ? `$${trip.fare.toFixed(2)}`
                : '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripLabel}>Payout: </Text>
              {trip.payout !== null
                ? `$${trip.payout.toFixed(2)}`
                : '...'}
            </Text>

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.status}>Status: </Text>
              {trip.status}
            </Text>

            {/* Accept Trip */}
            {trip.status === 'Requested' && available && !hasAcceptedTrip && (
              <Pressable
                style={driverStyles.acceptButton}
                onPress={() => acceptTrip(trip.tripID)}
              >
                <MaterialCommunityIcons
                  name="car-pickup"
                  size={22}
                  color="#FFFFFF"
                />
                <Text style={driverStyles.buttonText}>Accept</Text>
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
                  <Text style={driverStyles.buttonText}>Abort Trip</Text>
                </Pressable>
              </View>
            )}

          </View>
        ))
      )}

    </ScrollView>
  );
}