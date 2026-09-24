import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';

import { styles as commonStyles } from '../../components/common';
import { styles as driverStyles } from '../../components/driver';
import { useDriver } from '../../data/driver';
import { useTrip } from '../../data/trip';
import { supabase } from '../../lib/supabase';

export default function DriverScreen() {
  const { trips, setTrips } = useTrip();
  const { driver } = useDriver();
  const [available, setAvailable] = useState(false);
  const router = useRouter();
  const hasAccount = driver !== null;
  const hasAcceptedTrip = trips.some(
    (trip) => trip.status === 'Accepted'
  );  

  const acceptTrip = async (tripID: string) => {
    if (!hasAccount) {
      return;
    }

    const { data: acceptedTrip, error: acceptedTripError } =
      await supabase
        .from('trips')
        .select('trip_id')
        .eq('driver_id', driver.driverID)
        .eq('status', 'Accepted')
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
        'Can only accept one trip at a time.'
      );
      return;
    }

    const { error } = await supabase
      .from('trips')
      .update({
        driver_id: driver.driverID,
        driver_first_name: driver.firstName,
        truck: `${driver.make} ${driver.model}`,
        truck_photo: driver.truckPhoto,
        status: 'Accepted',
      })
      .eq('trip_id', tripID)
      .eq('status', 'Requested');

    if (error) {
      console.error('Trip acceptance error:', error.message);
      return;
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
              status: 'Accepted',
            }
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

        {!hasAccount ? (
          <Text style={driverStyles.loginMessage}>
            Please open an{' '}
            <Text
              style={driverStyles.accountLink}
              onPress={() => router.push('/driver_account')}
            >
              account
            </Text>{' '}
            to accept trips.
          </Text>
        ) : (
          <View style={driverStyles.availabilityRow}>
            <Text style={driverStyles.availabilityText}>
              I'm available to receive trips
            </Text>

            <Switch
              value={available}
              onValueChange={setAvailable}
              trackColor={{
                false: '#6B7280',
                true: '#F59E0B',
              }}
              thumbColor="#F5F5F5"
              ios_backgroundColor="#6B7280"
            />
          </View>
        )}

      </View>

      {/* Trip Cards */}
      {trips.filter(
        (trip) =>
          trip.status === 'Requested' ||
          trip.status === 'Accepted'
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
              trip.status === 'Accepted'
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
                ? `${trip.distance} mi`
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
                <Text style={driverStyles.buttonText}>
                  Accept
                </Text>
              </Pressable>
            )}

            {/* Not Available */}
            {trip.status === 'Requested' && !available && (
              <Text style={driverStyles.availabilityMessage}>
                Turn on availability to accept this trip.
              </Text>
            )}

            {/* Abort Trip */}
            {trip.status === 'Accepted' && (
              <Pressable
                style={driverStyles.abortButton}
                onPress={() => abortTrip(trip.tripID)}
              >
                <Text style={driverStyles.buttonText}>
                  Abort Trip
                </Text>
              </Pressable>
            )}

          </View>
        ))
      )}

    </ScrollView>
  );
}