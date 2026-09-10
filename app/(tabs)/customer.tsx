import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { styles as commonStyles } from '../../components/common';
import { styles as customerStyles } from '../../components/customer';

export default function RenterScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fare, setFare] = useState<number | null>(null);
  const [status, setStatus] = useState('Not submitted');
  const router = useRouter();

  // Temporary login state.
  // This will eventually come from the Customer Account.
  const [loggedIn, setLoggedIn] = useState(false);

  const requestTrip = () => {
    if (!loggedIn) {
      return;
    }

    // Temporary fare calculation
    const randomFare = Math.floor(Math.random() * 76) + 25;

    setFare(randomFare);
    setStatus('Requested');
  };

  const abortTrip = () => {
    setStatus('Aborted');
  };

  return (
    <View style={commonStyles.container}>

      {/* Page Header */}
      <View style={customerStyles.pageHeader}>
        <View style={customerStyles.pageHeaderContent}>
          <View>
            <Text style={customerStyles.pageSubtitle}>
              Where do you need a pickup truck?
            </Text>
          </View>

          <Pressable
            style={customerStyles.accountButton}
            onPress={() => router.push('/account-customer')}
          >
            <MaterialCommunityIcons
              name={loggedIn ? 'account-check' : 'account-outline'}
              size={30}
              color={loggedIn ? '#1877E8' : '#B8BCC4'}
            />
          </Pressable>
        </View>
      </View>

      {/* Trip Details */}
      <View style={customerStyles.tripCard}>

        <Text style={customerStyles.sectionTitle}>Trip Details</Text>

        {/* From */}
        <View style={customerStyles.inputGroup}>
          <View style={customerStyles.fieldHeader}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={22}
              color="#B8BCC4"
            />
            <Text style={customerStyles.fieldLabel}>From</Text>
          </View>

          <TextInput
            style={customerStyles.input}
            placeholder="Enter starting address"
            placeholderTextColor="#888"
            value={from}
            onChangeText={setFrom}
          />
        </View>

        {/* To */}
        <View style={customerStyles.inputGroup}>
          <View style={customerStyles.fieldHeader}>
            <MaterialCommunityIcons
              name="map-marker-check-outline"
              size={22}
              color="#B8BCC4"
            />
            <Text style={customerStyles.fieldLabel}>To</Text>
          </View>

          <TextInput
            style={customerStyles.input}
            placeholder="Enter destination address"
            placeholderTextColor="#888"
            value={to}
            onChangeText={setTo}
          />
        </View>

        {/* Fare */}
        <View style={customerStyles.infoRow}>
          <View style={customerStyles.infoContent}>
            <Text style={customerStyles.infoLabel}>FARE</Text>
            <Text style={customerStyles.infoValue}>
              {fare !== null ? `$${fare.toFixed(2)}` : 'Calculated by App'}
            </Text>
          </View>
        </View>

        {/* Status */}
        <View style={[customerStyles.infoRow, customerStyles.statusRow]}>
          <View style={customerStyles.infoContent}>
            <Text style={customerStyles.infoLabel}>STATUS</Text>
            <Text style={customerStyles.infoValue}>{status}</Text>
          </View>
        </View>
        
        {/* Login message */}
        {!loggedIn && status === 'Not submitted' && (
          <Text style={customerStyles.loginMessage}>
            Please open an account and log in to request a trip.
          </Text>
        )}

        {/* Actions */}
        {status === 'Not submitted' && (
          <Pressable
            style={customerStyles.button}
            onPress={requestTrip}
          >
            <Text style={customerStyles.buttonText}>Request Trip</Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        )}

        {status === 'Requested' && (
          <Pressable
            style={customerStyles.abortButton}
            onPress={abortTrip}
          >
            <Text style={customerStyles.buttonText}>Cancel Trip</Text>
          </Pressable>
        )}

      </View>

    </View>
  );
}