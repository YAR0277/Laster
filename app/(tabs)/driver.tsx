import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { styles as commonStyles } from '../../components/common';
import { styles as driverStyles } from '../../components/driver';

export default function DriverScreen() {
  const [status, setStatus] = useState('Requested');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loggedIn, setLoggedIn] = useState(true);
  const [available, setAvailable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (status !== 'Accepted') {
      return;
    }

    setSecondsLeft(30);

    const timer = setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer);
          setStatus('Confirmed');
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  const acceptTrip = () => {
    if (!loggedIn) {
      return;
    }

    setStatus('Accepted');
  };

  const cancelTrip = () => {
    setStatus('Requested');
    setSecondsLeft(0);
  };

  return (
    <View style={commonStyles.container}>

      {/* Page Header */}
      <View style={driverStyles.pageHeader}>

        <View style={driverStyles.pageHeaderContent}>
          <View>
            <Text style={driverStyles.pageSubtitle}>Available Trips</Text>
          </View>

          <Pressable
            style={driverStyles.accountButton}
            onPress={() => router.push('/account-driver')}            
          >
            <MaterialCommunityIcons
              name={loggedIn ? 'account-check' : 'account-outline'}
              size={30}
              color={loggedIn ? '#328F7D' : '#B8BCC4'}
            />
          </Pressable>
        </View>

        {!loggedIn ? 
        (
          <Text style={driverStyles.loginMessage}>
            Please open an account and log in to accept trips.
          </Text>
        ) 
        : 
        (
          <View style={driverStyles.availabilityRow}>
            <Text style={driverStyles.availabilityText}>
              I'm available to receive trips
            </Text>

            <Switch
              value={available}
              onValueChange={setAvailable}
              trackColor={{
                false: '#6B7280',
                true: '#328F7D',
              }}
              thumbColor="#F5F5F5"
              ios_backgroundColor="#6B7280"
            />
          </View>
        )}
        </View>


      <View style={driverStyles.tripCard}>
        <Text style={driverStyles.tripID}>Trip T0001</Text>

        <Text style={driverStyles.tripText}>
          <Text style={driverStyles.tripLabel}>From: </Text>
          123 Main Street
        </Text>

        <Text style={driverStyles.tripText}>
          <Text style={driverStyles.tripLabel}>To: </Text>
          456 Oak Avenue
        </Text>

        <Text style={driverStyles.tripText}>
          <Text style={driverStyles.tripLabel}>Distance: </Text>
          12.5 miles
        </Text>

        <Text style={driverStyles.tripText}>
          <Text style={driverStyles.tripLabel}>Fare: </Text>
          $75.00
        </Text>

        <Text style={driverStyles.tripText}>
          <Text style={driverStyles.tripLabel}>Payout: </Text>
          $60.00
        </Text>

        <Text style={driverStyles.status}>
          Status: {status}
        </Text>

        {status === 'Requested' && (
          <Pressable style={driverStyles.acceptButton} onPress={acceptTrip}>
            <Text style={driverStyles.buttonText}>Accept</Text>
          </Pressable>
        )}

        {status === 'Accepted' && (
          <>
            <Pressable style={driverStyles.abortButton} onPress={cancelTrip}>
              <Text style={driverStyles.buttonText}>Cancel</Text>
            </Pressable>

            <Text style={driverStyles.countdown}>
              {secondsLeft} secs to Cancel
            </Text>
          </>
        )}

        {status === 'Confirmed' && (
          <View style={driverStyles.confirmedButton}>
            <Text style={driverStyles.buttonText}>Confirmed</Text>
          </View>
        )}
      </View>
    </View>
  );
}