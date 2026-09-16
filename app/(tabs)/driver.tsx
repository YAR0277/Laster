import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

export default function DriverScreen() {
  const { trips, setTrips } = useTrip();
  const { driver } = useDriver();

  const [available, setAvailable] = useState(false);

  const router = useRouter();

  const hasAccount = driver !== null;

  const acceptTrip = (tripID: string) => {
    if (!hasAccount) {
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.tripID === tripID
          ? {
              ...trip,
              driverID: driver.driverID,
              status: 'Accepted',
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
      {trips.length === 0 ? (
        <View style={driverStyles.tripCard}>
          <Text style={driverStyles.availabilityMessage}>
            No trips available.
          </Text>
        </View>
      ) : (
        trips.map((trip) => (
          <View
            key={trip.tripID}
            style={driverStyles.tripCard}
          >

            <Text style={driverStyles.tripText}>
              <Text style={driverStyles.tripID}>Trip </Text>
              {trip.tripID}
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
            {trip.status === 'Requested' && available && (
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

            {/* Accepted */}
            {trip.status === 'Accepted' && (
              <View style={driverStyles.acceptButton}>
                <Text style={driverStyles.buttonText}>
                  Accepted
                </Text>
              </View>
            )}

          </View>
        ))
      )}

    </ScrollView>
  );
}