import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import 'react-native-get-random-values';

import { v4 as uuidv4 } from 'uuid';
import { styles as commonStyles } from '../../components/common';
import { styles as customerStyles } from '../../components/customer';
import { useAuth } from '../../data/auth';
import { useCustomer } from '../../data/customer';
import { useTrip } from '../../data/trip';
import { supabase } from '../../lib/supabase';

export default function RenterScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cargo, setCargo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('');
  const [openAccountSelected, setOpenAccount] = useState(false);
  const [currentTripID, setCurrentTripID] = useState<string | null>(null);
  const { trips, setTrips } = useTrip();
  const { customer, setCustomer } = useCustomer();
  const { user: supabaseAuthUser } = useAuth();
  const [rating, setRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [resumePendingTrip, setResumePendingTrip] = useState(false);
  const pendingTripLoaded = useRef(false);

  useEffect(() => {
    const loadCurrentTripID = async () => {
      const savedTripID = await AsyncStorage.getItem(
        'laster_current_trip_id'
      );

      if (savedTripID) {
        setCurrentTripID(savedTripID);
      }
    };

    loadCurrentTripID();
  }, []);

  const currentTrip = trips.find(
    (trip) => trip.tripID === currentTripID
  );

  useEffect(() => {
    if (!currentTrip) {
      return;
    }

    setFrom(currentTrip.from);
    setTo(currentTrip.to);
    setCargo(currentTrip.cargo);
    setFirstName(currentTrip.customerFirstName);
    setPhone(currentTrip.phone);
    setPayment(currentTrip.payment);
  }, [currentTrip]);

  useEffect(() => {
    if (customer && !currentTrip) {
      setFirstName(customer.firstName);
      setPhone(customer.phone);
      setPayment(customer.payment);
    }

    if (!customer && !currentTrip) {
      setFirstName('');
      setPhone('');
      setPayment('');
    }    
  }, [customer, currentTrip]);  

  useEffect(() => {
    if (
      !customer ||
      currentTrip ||
      resumePendingTrip ||
      pendingTripLoaded.current
    ) {
      return;
    }

    const loadPendingTrip = async () => {
      const pendingTrip = await AsyncStorage.getItem(
        'laster_pending_trip'
      );

      if (!pendingTrip) {
        return;
      }

      pendingTripLoaded.current = true;

      const trip = JSON.parse(pendingTrip);

      setFrom(trip.from);
      setTo(trip.to);
      setCargo(trip.cargo);
      setFirstName(trip.firstName);
      setPhone(trip.phone);
      setPayment(trip.payment);

      setResumePendingTrip(true);
    };

    loadPendingTrip();
  }, [customer, currentTrip, resumePendingTrip]);

  const fare = currentTrip?.fare ?? null;
  const status = currentTrip?.status ?? 'Not submitted';
  const router = useRouter();

  const requestTrip = async () => {

    // Required rental information
    if (!from || !to || !cargo || !firstName || !phone || !payment) {
      Alert.alert(
        'Missing Information',
        'Please enter your From address, To address, Cargo, First Name, Phone, and Payment information.'
      );
      return;
    }

    // Guest wants to open a Laster account.
    // Save the trip information and let the Customer Account page
    // handle account creation.
    if (openAccountSelected) {
      await AsyncStorage.setItem(
        'laster_pending_trip',
        JSON.stringify({
          from,
          to,
          cargo,
          firstName,
          phone,
          payment,
        })
      );

      router.push('/customer_account?mode=open');
      return;
    }

    // Existing logged-in customer
    let customerID: string;

    if (supabaseAuthUser && customer) {
      customerID = customer.customerID;
    } else {
      // Guest customer
      const existingGuestID = await AsyncStorage.getItem(
        'laster_guest_customer_id'
      );

      customerID = existingGuestID ?? uuidv4();

      await AsyncStorage.setItem(
        'laster_guest_customer_id',
        customerID
      );

      const { error } = await supabase
        .from('customers')
        .upsert({
          customer_id: customerID,
          auth_user_id: null,
          is_guest: true,
          first_name: firstName,
          phone,
          email: '',
          payment,
        });

      if (error) {
        Alert.alert(
          'Customer Error',
          `The guest customer could not be saved.\n\n${error.message}`
        );
        return;
      }
    }

    const randomFare = Math.floor(Math.random() * 76) + 25;
    const dummyDistance = 12;
    const dummyPayout = randomFare * 0.80;

    const newTripID = `T${uuidv4()}`;

    const newTrip = {
      tripID: newTripID,
      customerID,
      driverID: null,
      customerFirstName: firstName,
      driverFirstName: '',
      truck: '',
      truckPhoto: '',
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
      requestedAt: new Date().toISOString(),
      completedAt: null,
      status: 'Requested' as const,
    };

    const { error } = await supabase
      .from('trips')
      .insert({
        trip_id: newTrip.tripID,
        customer_id: newTrip.customerID,
        driver_id: newTrip.driverID,
        customer_first_name: newTrip.customerFirstName,
        driver_first_name: newTrip.driverFirstName,
        truck: newTrip.truck,
        truck_photo: newTrip.truckPhoto,
        from_location: newTrip.from,
        to_location: newTrip.to,
        cargo: newTrip.cargo,
        cargo_photo: newTrip.cargoPhoto,
        phone: newTrip.phone,
        payment: newTrip.payment,
        distance: newTrip.distance,
        distance_to_arrival: newTrip.distanceToArrival,
        fare: newTrip.fare,
        payout: newTrip.payout,
        status: newTrip.status,
      });

    if (error) {
      Alert.alert(
        'Trip Error',
        `The trip could not be requested.\n\n${error.message}`
      );
      return;
    }

    // Keep the local context in sync with the database.
    setTrips((currentTrips) => [
      ...currentTrips,
      newTrip,
    ]);

    setCurrentTripID(newTripID);

    await AsyncStorage.setItem(
      'laster_current_trip_id',
      newTripID
    );

    await AsyncStorage.removeItem(
      'laster_pending_trip'
    );
  };

  useEffect(() => {
    if (!resumePendingTrip || !customer || currentTrip) {
      return;
    }

    setResumePendingTrip(false);

    const timer = setTimeout(() => {
      requestTrip();
    }, 0);

    return () => clearTimeout(timer);
  }, [resumePendingTrip, customer, currentTrip]);

  const completeTrip = async () => {
    if (!currentTripID) {
      return;
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'Completed',
        completed_at: new Date().toISOString(),
      })
      .eq('trip_id', currentTripID);

    if (error) {
      Alert.alert(
        'Trip Error',
        `The trip could not be completed.\n\n${error.message}`
      );
      return;
    }

    // Keep the local UI in sync with the database.
    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.tripID === currentTripID
          ? { ...trip, status: 'Completed' }
          : trip
      )
    );
  };

  const abortTrip = async () => {
    if (!currentTripID || currentTrip?.status !== 'Requested') {
      return;
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'Aborted',
        completed_at: new Date().toISOString(),
      })
      .eq('trip_id', currentTripID)
      .eq('status', 'Requested');

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
        trip.tripID === currentTripID
          ? { ...trip, status: 'Aborted' }
          : trip
      )
    );
  };

  const startNewTrip = async () => {
    setCurrentTripID(null);

    await AsyncStorage.removeItem(
      'laster_current_trip_id'
    );

    setFrom('');
    setTo('');
    setCargo('');
    setFirstName('');
    setPhone('');
    setPayment('');
    setOpenAccount(false);
    setRating(null);
    setRatingSubmitted(false);
  };

  const submitRating = async () => {
    if (rating === null || !currentTrip) {
      return;
    }

    if (!currentTrip.tripID) {
      return;
    }

    const { error } = await supabase.rpc(
      'submit_driver_rating',
      {
        p_trip_id: currentTrip.tripID,
        p_rating: rating,
      }
    );

    if (error) {
      console.error(
        'Driver rating submission error:',
        error.message
      );
      return;
    }

    setRatingSubmitted(true);
    startNewTrip();
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
            onPress={() => router.push('/customer_account?mode=default')}
          >
            <MaterialCommunityIcons
              name={
                customer
                  ? 'account-check'
                  : 'account-outline'
              }
              size={30}
              color={
                customer
                  ? '#F59E0B'
                  : '#B8BCC4'
              }
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
            editable={status === 'Not submitted'}
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
            editable={status === 'Not submitted'}
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
            editable={status === 'Not submitted'}
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
            editable={status === 'Not submitted'}
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
            editable={status === 'Not submitted'}
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
            editable={status === 'Not submitted'}
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

        {/* Abort Trip*/}
        {status === 'Requested' && (
          <Pressable
            style={customerStyles.abortButton}
            onPress={abortTrip}
          >
            <Text style={customerStyles.abortButtonText}>
              Abort Trip
            </Text>

            <MaterialCommunityIcons
              name="close"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        )}

        {/* Start New Trip */}
        {status === 'Aborted' && (
          <Pressable
            style={customerStyles.button}
            onPress={startNewTrip}
          >
            <Text style={customerStyles.buttonText}>
              Start New Trip
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        )}

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
        {status === 'Not submitted' && !customer && (
          <Pressable
            style={customerStyles.accountOption}
            onPress={() => setOpenAccount(!openAccountSelected)}
          >
            <MaterialCommunityIcons
              name={
                openAccountSelected
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
        )}

        {/* Accepted */}
        {status === 'Accepted' && (
          <>
            <View style={customerStyles.driverInfo}>
              <Text style={customerStyles.driverMessage}>
                {(currentTrip?.driverFirstName.trim() || 'Your driver') + ' is on his way'}
              </Text>

              {currentTrip?.truckPhoto ? (
                <Image
                  source={{ uri: currentTrip.truckPhoto }}
                  style={customerStyles.truckPhoto}
                  resizeMode="cover"
                />
              ) : null}

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