import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { styles as commonStyles } from '../../components/common';
import { styles as customerStyles } from '../../components/customer';
import { useCustomer } from '../../data/customer';
import { useTrip } from '../../data/trip';

export default function RenterScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cargo, setCargo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('');
  const [openAccount, setOpenAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [currentTripID, setCurrentTripID] = useState<string | null>(null);

  const { trips, setTrips } = useTrip();
  const { customer, setCustomer } = useCustomer();

  const currentTrip = trips.find(
    (trip) => trip.tripID === currentTripID
  );

  const fare = currentTrip?.fare ?? null;
  const status = currentTrip?.status ?? 'Not submitted';

  const [rating, setRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const router = useRouter();

  const requestTrip = () => {
    // Required rental information
    if (!from || !to || !cargo || !firstName || !phone || !payment) {
      Alert.alert(
        'Missing Information',
        'Please enter your From address, To address, Cargo, First Name, Phone, and Payment information.'
      );
      return;
    }

    // Email is required only when opening an account
    if (openAccount && !email) {
      Alert.alert(
        'Missing Information',
        'Please enter your email address to open an account with Laster.'
      );
      return;
    }

    // Create or update the Customer account if requested
    let customerID: string | null = null;

    if (openAccount) {
      customerID = customer?.customerID ?? 'C0001';

      setCustomer({
        customerID,
        firstName,
        phone,
        email,
        payment,
      });
    }

    const randomFare = Math.floor(Math.random() * 76) + 25;
    const dummyDistance = 12;
    const dummyPayout = randomFare * 0.80;

    const newTripNumber = trips.length + 1;
    const newTripID = `T${String(newTripNumber).padStart(4, '0')}`;

    const newTrip = {
      tripID: newTripID,
      customerID,
      driverID: null,
      customerFirstName: firstName,
      driverFirstName: '',
      truck: '',
      from,
      to,
      cargo,
      cargoPhoto: '',
      phone,
      payment,
      distance: dummyDistance,
      distanceToArrival: dummyDistance,
      fare: randomFare,
      payout: dummyPayout,
      status: 'Requested' as const,
    };

    setTrips((currentTrips) => [
      ...currentTrips,
      newTrip,
    ]);

    setCurrentTripID(newTripID);
  };

  const completeTrip = () => {
    if (!currentTripID) {
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.tripID === currentTripID
          ? { ...trip, status: 'Completed' }
          : trip
      )
    );
  };

  const startNewTrip = () => {
    setCurrentTripID(null);
    setFrom('');
    setTo('');
    setCargo('');
    setFirstName('');
    setPhone('');
    setPayment('');
    setOpenAccount(false);
    setEmail('');
    setRating(null);
    setRatingSubmitted(false);
  };

  const submitRating = () => {
    if (rating !== null) {
      setRatingSubmitted(true);
      startNewTrip();
    }
  };

  const skipRating = () => {
    startNewTrip();
  };

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={commonStyles.contentContainer}
    >

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
            onPress={() => router.push('/customer_account')}
          >
            <MaterialCommunityIcons
              name="account-outline"
              size={30}
              color="#B8BCC4"
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

        {/* Cargo */}
        <View style={customerStyles.inputGroup}>
          <Text style={customerStyles.fieldLabel}>Cargo</Text>

          <TextInput
            style={customerStyles.input}
            placeholder="What are you transporting?"
            placeholderTextColor="#888"
            value={cargo}
            onChangeText={setCargo}
          />
        </View>

        {/* First Name */}
        <View style={customerStyles.inputGroup}>
          <Text style={customerStyles.fieldLabel}>First Name</Text>

          <TextInput
            style={customerStyles.input}
            placeholder="Enter first name"
            placeholderTextColor="#888"
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>

        {/* Phone */}
        <View style={customerStyles.inputGroup}>
          <Text style={customerStyles.fieldLabel}>Phone</Text>

          <TextInput
            style={customerStyles.input}
            placeholder="Enter telephone number"
            placeholderTextColor="#888"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Payment */}
        <View style={customerStyles.inputGroup}>
          <Text style={customerStyles.fieldLabel}>Payment</Text>

          <TextInput
            style={customerStyles.input}
            placeholder="Enter payment information"
            placeholderTextColor="#888"
            value={payment}
            onChangeText={setPayment}
          />
        </View>

        {/* Fare */}
        <View style={customerStyles.infoRow}>
          <View style={customerStyles.infoContent}>
            <Text style={customerStyles.infoLabel}>FARE</Text>
            <Text style={customerStyles.infoValue}>
              {fare !== null
                ? `$${fare.toFixed(2)}`
                : 'Calculated by App'}
            </Text>
          </View>
        </View>

        {/* Status */}
        <View
          style={[
            customerStyles.infoRow,
            customerStyles.statusRow,
          ]}
        >
          <View style={customerStyles.infoContent}>
            <Text style={customerStyles.infoLabel}>STATUS</Text>
            <Text style={customerStyles.infoValue}>
              {status}
            </Text>
          </View>
        </View>

        {/* Request Trip */}
        {status === 'Not submitted' && (
          <Pressable
            style={customerStyles.button}
            onPress={requestTrip}
          >
            <Text style={customerStyles.buttonText}>
              Request Trip
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        )}

        {/* Open Account */}
        {status === 'Not submitted' && (
          <>
            <Pressable
              style={customerStyles.accountOption}
              onPress={() => setOpenAccount(!openAccount)}
            >
              <MaterialCommunityIcons
                name={
                  openAccount
                    ? 'checkbox-marked'
                    : 'checkbox-blank-outline'
                }
                size={22}
                color="#8B5CF6"
              />

              <Text style={customerStyles.accountOptionText}>
                Open an account with Laster
              </Text>
            </Pressable>

            {/* Email */}
            {openAccount && (
              <View style={customerStyles.inputGroup}>
                <Text style={customerStyles.fieldLabel}>
                  Email
                </Text>

                <TextInput
                  style={customerStyles.input}
                  placeholder="Enter email address"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            )}
          </>
        )}

        {/* Accepted */}
        {status === 'Accepted' && (
          <>
            <View style={customerStyles.driverInfo}>
              <Text style={customerStyles.driverMessage}>
                {(currentTrip?.driverFirstName.trim() || 'Your driver') + ' is on his way'}
              </Text>

              <Text style={customerStyles.driverInfoText}>
                <Text style={customerStyles.driverInfoLabel}>
                  Driver:{' '}
                </Text>
                {currentTrip?.driverFirstName || '...'}
              </Text>

              <Text style={customerStyles.driverInfoText}>
                <Text style={customerStyles.driverInfoLabel}>
                  Truck:{' '}
                </Text>
                {currentTrip?.truck || '...'}
              </Text>

              <Text style={customerStyles.driverInfoText}>
                <Text style={customerStyles.driverInfoLabel}>
                  Miles to arrival:{' '}
                </Text>
                {currentTrip?.distanceToArrival != null
                  ? `${currentTrip?.distanceToArrival} mi`
                  : '...'}
              </Text>
            </View>

            <Pressable
              style={customerStyles.button}
              onPress={completeTrip}
            >
              <Text style={customerStyles.buttonText}>
                Complete Trip
              </Text>

              <MaterialCommunityIcons
                name="check"
                size={22}
                color="#FFFFFF"
              />
            </Pressable>
          </>
        )}
      </View>

      {/* Rate Your Driver */}
      {status === 'Completed' && (
        <View style={customerStyles.ratingCard}>

          <Text style={customerStyles.sectionTitle}>
            Rate Your Driver
          </Text>

          {!ratingSubmitted ? (
            <>
              <Text style={customerStyles.ratingSubtitle}>
                How was your experience?
              </Text>

              <View style={customerStyles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    style={customerStyles.starButton}
                  >
                    <MaterialCommunityIcons
                      name={
                        star <= (rating ?? 0)
                          ? 'star'
                          : 'star-outline'
                      }
                      size={38}
                      color={
                        star <= (rating ?? 0)
                          ? '#8B5CF6'
                          : '#B8BCC4'
                      }
                    />
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[
                  customerStyles.ratingButton,
                  rating === null &&
                    customerStyles.ratingButtonDisabled,
                ]}
                onPress={submitRating}
                disabled={rating === null}
              >
                <Text style={customerStyles.ratingButtonText}>
                  Submit Rating
                </Text>
              </Pressable>

              <Pressable
                style={customerStyles.ratingButton}
                onPress={skipRating}
              >
                <Text style={customerStyles.ratingButtonText}>
                  Skip Rating
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={customerStyles.ratingSubmitted}>
              <Text style={customerStyles.ratingMessage}>
                Thank you for rating your driver!
              </Text>

              <View style={customerStyles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <MaterialCommunityIcons
                    key={star}
                    name={
                      star <= (rating ?? 0)
                        ? 'star'
                        : 'star-outline'
                    }
                    size={38}
                    color={
                      star <= (rating ?? 0)
                        ? '#8B5CF6'
                        : '#B8BCC4'
                    }
                  />
                ))}
              </View>
            </View>
          )}

        </View>
      )}

    </ScrollView>
  );
}