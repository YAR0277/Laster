import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import LocationPicker, {
  type SelectedLocation,
} from '../../components/LocationPicker';
import { useAuth } from '../../data/auth';
import { useCustomer } from '../../data/customer';
import { Trip, useTrip } from '../../data/trip';
import { supabase } from '../../lib/supabase';

export default function RenterScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cargo, setCargo] = useState('');
  const [cargoPhoto, setCargoPhoto] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('');
  const [currentTripID, setCurrentTripID] = useState<string | null>(null);
  const { trips, setTrips } = useTrip();
  const { customer } = useCustomer();
  const { user: supabaseAuthUser } = useAuth();
  const [rating, setRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [locationPickerFor, setLocationPickerFor] = useState<'from' | 'to' | null>(null);
  const [fromLocation, setFromLocation] = useState<SelectedLocation | null>(null);
  const [toLocation, setToLocation] = useState<SelectedLocation | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeFare, setRouteFare] = useState<number | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [requestingTrip, setRequestingTrip] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [abortingTrip, setAbortingTrip] = useState(false);
  const METERS_PER_MILE = 1609.344;

  useEffect(() => {
    let cancelled = false;

    const setCurrentLocation = async () => {

      if (!supabaseAuthUser || !customer) {
        return;
      }

      // Only set the default when the From field is empty.
      if (from.trim() !== '' || fromLocation !== null) {
        return;
      }

      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (cancelled) {
          return;
        }

        const { latitude, longitude } = position.coords;

        const results = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (cancelled) {
          return;
        }

        const place = results[0];

        if (!place) {
          return;
        }

        const address = [
          place.streetNumber,
          place.street,
          place.city,
          place.region,
          place.postalCode,
          place.country,
        ]
          .filter(Boolean)
          .join(', ');

        if (!address) {
          return;
        }

        setFrom(address);
        setFromLocation({
          latitude,
          longitude,
          address,
        });

      } catch (error) {
        console.warn('Could not set current location:', error);
      }
    };

    void setCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, [from, fromLocation, supabaseAuthUser, customer]);

  useEffect(() => {
    let cancelled = false;

    const calculateRoute = async () => {
      setRouteDistance(null);
      setRouteFare(null);
      setRouteError(null);

      if (!fromLocation || !toLocation) {
        setCalculatingRoute(false);
        return;
      }

      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

      if (!token) {
        setRouteError('Mapbox access token is missing.');
        setCalculatingRoute(false);
        return;
      }

      setCalculatingRoute(true);

      try {
        const coordinates =
          `${fromLocation.longitude},${fromLocation.latitude};` +
          `${toLocation.longitude},${toLocation.latitude}`;

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

        // Mapbox returns distance in meters.
        const miles = data.routes[0].distance / METERS_PER_MILE;

        let fare: number;

        if (miles <= 5) {
          fare = 40;
        } else if (miles <= 20) {
          fare = 40 + (miles - 5) * 2.50;
        } else if (miles <= 40) {
          fare = 77.50 + (miles - 20) * 1.25;
        } else {
          fare = 102.50 + (miles - 40) * 1.00;
        }

        // Round fare to the nearest cent.
        fare = Math.round(fare * 100) / 100;

        if (!cancelled) {
          setRouteDistance(miles);
          setRouteFare(fare);
        }
      } catch (error) {
        if (!cancelled) {
          setRouteError(
            error instanceof Error
              ? error.message
              : 'Unable to calculate the route.',
          );
        }
      } finally {
        if (!cancelled) {
          setCalculatingRoute(false);
        }
      }
    };

    void calculateRoute();

    return () => {
      cancelled = true;
    };
  }, [fromLocation, toLocation]);

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
    setCargoPhoto(currentTrip.cargoPhoto || null);    
    setFirstName(currentTrip.customerFirstName);
    setPhone(currentTrip.phone);
    setPayment(currentTrip.payment);
    setRouteDistance(currentTrip.distance); 
    setRouteFare(currentTrip.fare);    
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

  const pickCargoPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setCargoPhoto(result.assets[0].uri);
    }
  };

  const fare = currentTrip?.fare ?? null;
  const status = currentTrip?.status ?? 'Not submitted';
  const router = useRouter();

  const requestTrip = async () => {

    if (requestingTrip) return;

    if (!supabaseAuthUser || !customer) {
      Alert.alert(
        'Customer Account Required',
        'Please log in or open a Laster customer account before requesting a trip.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Login / Account',
            onPress: () => router.push('/customer_account?mode=default'),
          },
        ],
      );
      return;
    }

    // Required rental information
    if (!from || !to || !cargo || !firstName || !phone || !payment) {
      Alert.alert(
        'Missing Information',
        'Please enter your From address, To address, Cargo, First Name, Phone, and Payment information.'
      );
      return;
    }

    // Verify that the route and fare have been calculated.
    if (routeDistance === null || routeFare === null) {
      Alert.alert(
        'Route Not Ready',
        'Please select both locations and wait for the distance and fare to be calculated.',
      );
      return;
    }

    setRequestingTrip(true);

    try {    

      let cargoPhotoUrl = '';

      if (cargoPhoto) {
        const file = new File(cargoPhoto);
        const arrayBuffer = await file.arrayBuffer();

        const fileName = `${uuidv4()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('cargo-photos')
          .upload(fileName, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          Alert.alert(
            'Photo Upload Error',
            `The cargo photo could not be uploaded.\n\n${uploadError.message}`
          );
          return;
        }

        const { data } = supabase.storage
          .from('cargo-photos')
          .getPublicUrl(fileName);

        cargoPhotoUrl = data.publicUrl;
      }

      const { data: result, error } = await supabase.functions.invoke(
        'request-trip',
        {
          body: {
            from,
            to,
            cargo,
            cargoPhoto: cargoPhotoUrl,
            firstName,
            phone,
            payment,
            fromLatitude: fromLocation?.latitude,
            fromLongitude: fromLocation?.longitude,
            toLatitude: toLocation?.latitude,
            toLongitude: toLocation?.longitude,
          },
        },
      );

      if (error || !result?.trip) {
        Alert.alert(
          'Trip Error',
          `The trip could not be requested.\n\n${
            result?.error ?? error?.message ?? 'Unknown error'
          }`,
        );
        return;
      }

      const savedTrip = result.trip;

      const newTrip: Trip = {
        tripID: savedTrip.trip_id,
        displayTripID: savedTrip.display_trip_id,
        customerID: savedTrip.customer_id,
        driverID: savedTrip.driver_id,
        customerFirstName: savedTrip.customer_first_name,
        driverFirstName: savedTrip.driver_first_name,
        truck: savedTrip.truck,
        truckPhoto: savedTrip.truck_photo,
        from: savedTrip.from_location,
        to: savedTrip.to_location,
        cargo: savedTrip.cargo,
        cargoPhoto: savedTrip.cargo_photo,
        phone: savedTrip.phone,
        payment: savedTrip.payment,
        distance: savedTrip.distance,
        distanceToArrival: savedTrip.distance_to_arrival,
        fare: savedTrip.fare,
        payout: savedTrip.payout,
        requestedAt: savedTrip.requested_at,
        completedAt: savedTrip.completed_at,
        status: savedTrip.status,
        driverRating: null,
        driverArrivalTrip: null,
      };

      // Keep the local context in sync with the saved database record.
      setTrips((currentTrips) => [
        ...currentTrips,
        newTrip,
      ]);

      setCurrentTripID(newTrip.tripID);

      await AsyncStorage.setItem(
        'laster_current_trip_id',
        newTrip.tripID,
      );

      Alert.alert(
        'Trip Requested',
        `Your trip has been requested.\n\nFare: $${Number(newTrip.fare).toFixed(2)}`,
      );
    } catch (error) {
      console.error('Request trip failed:', error);
      Alert.alert(
        'Trip Error',
        'An unexpected error occurred while requesting your trip. Please try again.',
      );
    } finally {
      setRequestingTrip(false);
    }      
  };

  const completeTrip = async () => {
    if (!currentTripID || completingTrip) return;

    setCompletingTrip(true);

    try {
      const { data, error } = await supabase.functions.invoke('complete-trip', {
        body: { tripID: currentTripID },
      });

      if (error || data?.error) {
        console.error('Complete trip error:', error?.message ?? data?.error);
        Alert.alert(
          'Trip Error',
          data?.error ?? `The trip could not be completed.\n\n${error?.message ?? 'Please try again.'}`,
        );
        return;
      }

      setTrips((currentTrips) =>
        currentTrips.map((trip) =>
          trip.tripID === currentTripID ? { ...trip, status: 'Completed' } : trip
        )
      );
    } catch (error) {
      console.error('Complete trip failed:', error);
      Alert.alert('Trip Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setCompletingTrip(false);
    }
  };

  const abortTrip = async () => {
    if (!currentTripID || currentTrip?.status !== 'Requested' || abortingTrip) return;

    setAbortingTrip(true);

    try {
      const { data, error } = await supabase.functions.invoke('abort-trip-customer', {
        body: { tripID: currentTripID },
      });

      if (error || data?.error) {
        console.error('Abort trip error:', error?.message ?? data?.error);
        Alert.alert(
          'Trip Error',
          data?.error ?? `The trip could not be aborted.\n\n${error?.message ?? 'Please try again.'}`,
        );
        return;
      }

      setTrips((currentTrips) =>
        currentTrips.map((trip) =>
          trip.tripID === currentTripID ? { ...trip, status: 'Aborted' } : trip
        )
      );
    } catch (error) {
      console.error('Abort trip failed:', error);
      Alert.alert(
        'Trip Error',
        'An unexpected error occurred while aborting your trip. Please try again.',
      );
    } finally {
      setAbortingTrip(false);
    }
  };

  const startNewTrip = async () => {
    setCurrentTripID(null);

    await AsyncStorage.removeItem(
      'laster_current_trip_id'
    );

    // Keep the customer's starting location and logged-in profile/payment
    // details for the next trip. Only clear trip-specific destination/cargo data.
    setTo('');
    setToLocation(null);
    setCargo('');
    setCargoPhoto(null);
    setRating(null);
    setRatingSubmitted(false);
    setRouteDistance(null);
    setRouteFare(null);
    setRouteError(null);
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
          <View style={customerStyles.pageHeaderText}>
            <Text style={customerStyles.pageSubtitle}>
              To request a trip{' '}
              <Text
                style={customerStyles.accountLink}
                onPress={() => router.push('/(tabs)/customer_account?mode=default')}
              >
                Log in
              </Text>
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

      {/* Trip Details — authenticated customers only */}
      {supabaseAuthUser && customer && (
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={[customerStyles.input, { flex: 1 }]}
              placeholder="Where from?"
              placeholderTextColor="#888"
              value={from}
              onChangeText={(value) => {
                setFrom(value);
                setFromLocation(null);
              }}
              editable={status === 'Not submitted'}
            />

            <Pressable
              onPress={() => setLocationPickerFor('from')}
              disabled={status !== 'Not submitted'}
              accessibilityLabel="Choose starting location on map"
            >
              <MaterialCommunityIcons
                name="map-search-outline"
                size={26}
                color="#B8BCC4"
              />
            </Pressable>
          </View>
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

          <View style={{flexDirection: 'row',alignItems: 'center', gap: 8 }}>
            <TextInput
              style={[customerStyles.input, { flex: 1 }]}
              placeholder="Where to?"
              placeholderTextColor="#888"
              value={to}
              onChangeText={(value) => {
                setTo(value);
                setToLocation(null);
              }}
              editable={status === 'Not submitted'}
            />

            <Pressable
              onPress={() => setLocationPickerFor('to')}
              disabled={status !== 'Not submitted'}
              accessibilityLabel="Choose destination on map"
            >
              <MaterialCommunityIcons
                name="map-search-outline"
                size={26}
                color="#B8BCC4"
              />
            </Pressable>
          </View>
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

        {/* Cargo Photo */}
        <View style={customerStyles.inputGroup}>
          <Text style={customerStyles.fieldLabel}>Cargo Photo</Text>

          {status === 'Not submitted' && (
            <Pressable
              style={customerStyles.photoButton}
              onPress={pickCargoPhoto}
            >
              <MaterialCommunityIcons
                name="camera-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text style={customerStyles.photoButtonText}>
                {cargoPhoto ? 'Change Cargo Photo' : 'Add Cargo Photo'}
              </Text>
            </Pressable>
          )}

          {cargoPhoto && (
            <Image
              source={{
                uri: cargoPhoto,
              }}
              style={{
                width: 300,
                height: 200,
                marginTop: 10,
                backgroundColor: '#DDDDDD',
              }}
              onError={(event) =>
                console.log(
                  'Cargo photo load error:',
                  event.nativeEvent.error
                )
              }
              resizeMode="contain"
            />
          )}
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
              {routeFare !== null
                ? `$${routeFare.toFixed(2)}`
                : calculatingRoute
                  ? 'Calculating...'
                  : routeError
                    ? 'Unable to calculate'
                    : '—'}
            </Text>
          </View>
        </View>

        {/* Distance */}
        <View style={customerStyles.infoRow}>
          <View style={customerStyles.infoContent}>
            <Text style={customerStyles.infoLabel}>DISTANCE</Text>
            <Text style={customerStyles.infoValue}>
              {routeDistance !== null
                ? `${routeDistance.toFixed(1)} mi`
                : calculatingRoute
                  ? 'Calculating...'
                  : '—'}
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

        {routeError && (
          <Text style={{ color: '#FF7777' }}>
            {routeError}
          </Text>
        )}

        {/* Abort Trip */}
        {status === 'Requested' && (
          <>
            <Pressable
              style={[
                customerStyles.abortButton,
                abortingTrip && { opacity: 0.6 },
              ]}
              onPress={abortTrip}
              disabled={abortingTrip}
            >
              <Text style={customerStyles.abortButtonText}>
                {abortingTrip ? 'Aborting Trip...' : 'Abort Trip'}
              </Text>

              <MaterialCommunityIcons
                name="close"
                size={22}
                color="#FFFFFF"
              />
            </Pressable>

            <Text style={customerStyles.abortMessage}>
              You can abort a trip until a driver accepts it.
            </Text>
          </>
        )}

        {/* Start New Trip */}
        {status === 'Aborted' && (
          <>
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

            <Text style={customerStyles.abortMessage}>
              {!currentTrip?.driverFirstName
                ? `Trip aborted by customer ${firstName}`
                : `Trip aborted by driver ${currentTrip.driverFirstName}`}
            </Text>
          </>
        )}

        {/* Request Trip */}
        {status === 'Not submitted' && (
          <Pressable
            style={[
              customerStyles.button,
              requestingTrip && { opacity: 0.6 },
            ]}
            onPress={requestTrip}
            disabled={requestingTrip}
          >
            <Text style={customerStyles.buttonText}>
              {requestingTrip ? 'Requesting Trip...' : 'Request Trip'}
            </Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        )}

        {/* Accepted */}
        {status === 'Accepted' && (
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
                ? `${currentTrip.distanceToArrival.toFixed(1)} mi`
                : '...'}
            </Text>
          </View>
        )}

        {/* Started */}
        {status === 'Started' && (
          <>
            <View style={customerStyles.driverInfo}>
              <Text style={customerStyles.driverMessage}>
                Your trip is in progress.
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
            </View>

            <Pressable
              style={[
                customerStyles.button,
                completingTrip && { opacity: 0.6 },
              ]}
              onPress={completeTrip}
              disabled={completingTrip}
            >
              <Text style={customerStyles.buttonText}>
                {completingTrip ? 'Completing Trip...' : 'Complete Trip'}
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
      )}

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

      {/* Other page content */}
      <LocationPicker
        visible={locationPickerFor !== null}
        title={
          locationPickerFor === 'from'
            ? 'Choose Starting Location'
            : 'Choose Destination'
        }
        onCancel={() => setLocationPickerFor(null)}
        onSelect={(location: SelectedLocation) => {
          if (locationPickerFor === 'from') {
            setFrom(location.address);
            setFromLocation(location);
          } else if (locationPickerFor === 'to') {
            setTo(location.address);
            setToLocation(location);
          }

          setLocationPickerFor(null);
        }}
      />

    </ScrollView>
  );
}