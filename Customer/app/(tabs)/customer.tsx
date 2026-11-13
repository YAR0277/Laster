import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
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
import { styles as accountStylesCommon } from '../../../Common/src/components/account';
import { styles as commonStyles } from '../../../Common/src/components/common';
import { styles as customerStyles } from '../../components/customer';
import CustomerAccountButton from '../../components/CustomerAccountButton';
import { useAuth } from '../../data/auth';
import { useCustomer } from '../../data/customer';
import { Trip, useTrip } from '../../data/trip';
import { nativeLocationProvider } from '../../lib/location/nativeLocationProvider';
import { osmMappingProvider } from '../../lib/location/osmMappingProvider';
import type { Coordinates } from '../../lib/location/types';
import { supabase } from '../../lib/supabase';

export default function RenterScreen() {
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
  const [originLocation, setOriginLocation] = useState<Coordinates | null>(null);
  const [toLocation, setToLocation] = useState<Coordinates | null>(null);
  const [resolvingDestination, setResolvingDestination] = useState(false);

  const [requestingTrip, setRequestingTrip] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [abortingTrip, setAbortingTrip] = useState(false);

  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeFare, setRouteFare] = useState<number | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    if (!originLocation || !toLocation) {
      setCalculatingRoute(false);
      setRouteError(null);
      return;
    }

    let cancelled = false;

    const calculateRoute = async () => {
      setCalculatingRoute(true);
      setRouteDistance(null);
      setRouteFare(null);
      setRouteError(null);

      try {
        // Calculate driving distance.
        const route = await osmMappingProvider.calcRouteDistance(
          originLocation,
          toLocation
        );

        if (cancelled) return;

        if (!route) {
          setRouteError('Route not found.');
          return;
        }

        const miles = route.distanceMeters / 1609.344;
        setRouteDistance(miles);

        // Calculate estimated fare.
        const { data: fareResult, error: fareError } =
          await supabase.functions.invoke('calculate-fare', {
            body: { miles },
          });

        if (cancelled) return;

        if (fareError || typeof fareResult?.fare !== 'number') {
          throw new Error('Fare calculation failed.');
        }

        setRouteFare(fareResult.fare);

      } catch (error) {
        console.error('Route or fare calculation failed:', error);

        if (!cancelled) {
          setRouteError('Unable to calculate the route or fare.');
        }
      } finally {
        if (!cancelled) {
          setCalculatingRoute(false);
        }
      }
    };

    calculateRoute();

    return () => {
      cancelled = true;
    };
  }, [originLocation, toLocation]);

  useEffect(() => {
    let cancelled = false;

    const getOriginLocation = async () => {
      if (!supabaseAuthUser || !customer) return;

      try {
        const coordinates =
          await nativeLocationProvider.getCurrentLocationLatLon();

        if (!cancelled) {
          setOriginLocation(coordinates);
        }
      } catch (error) {
        console.warn('Could not get current location:', error);

        if (!cancelled) {
          Alert.alert(
            'Location Required',
            'Please allow Laster to access your location to request a pickup.'
          );
        }
      }
    };

    void getOriginLocation();

    return () => {
      cancelled = true;
    };
  }, [supabaseAuthUser, customer]);

  useEffect(() => {
    const restoreCurrentTrip = async () => {
      const storedTripID = await AsyncStorage.getItem(
        'laster_current_trip_id'
      );

      setCurrentTripID(storedTripID);
    };

    void restoreCurrentTrip();
  }, []);

  const currentTrip = trips.find(
    (trip) => trip.tripID === currentTripID
  );

  useEffect(() => {
    if (currentTrip) {
      // Restore the active trip.
      setTo(currentTrip.to);
      setToLocation(
        currentTrip.toLatitude != null &&
        currentTrip.toLongitude != null
          ? {
              latitude: currentTrip.toLatitude,
              longitude: currentTrip.toLongitude,
            }
          : null
      );

      setCargo(currentTrip.cargo);
      setCargoPhoto(currentTrip.cargoPhoto || null);

      setFirstName(currentTrip.customerFirstName);
      setPhone(currentTrip.phone);
      setPayment(currentTrip.payment);

      setRouteDistance(currentTrip.distance ?? null);
      setRouteFare(currentTrip.fare ?? null);

      return;
    }

    // No active trip: clear rental-specific fields.
    setTo('');
    setToLocation(null);
    setCargo('');
    setCargoPhoto(null);

    setRouteDistance(null);
    setRouteFare(null);
    setRouteError(null);

    // Populate account fields for the logged-in customer.
    setFirstName(customer?.firstName ?? '');
    setPhone(customer?.phone ?? '');
    setPayment(customer?.payment ?? '');

  }, [currentTrip, customer]);

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

  const resolveDestination = async (): Promise<Coordinates | null> => {
    const address = to.trim();

    if (!address) {
      Alert.alert('Destination Required', 'Please enter a destination.');
      return null;
    }

    setResolvingDestination(true);

    try {
      const result = await osmMappingProvider.doGeocode(address);
            
      if (!result) {
        Alert.alert(
          'Destination Not Found',
          'Please check the address and try again.'
        );
        return null;
      }

      setTo(result.formattedAddress);
      setToLocation(result.coordinates);

      return result.coordinates;
    } catch (error) {
      console.warn('Destination lookup failed:', error);

      Alert.alert(
        'Location Error',
        'Could not look up the destination. Please try again.'
      );
      return null;
    } finally {
      setResolvingDestination(false);
    }
  };

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
    if (!to.trim() || !cargo || !firstName || !phone || !payment) {
      Alert.alert(
        'Missing Information',
        'Please enter a destination, Cargo, First Name, Phone, and Payment information.'
      );
      return;
    }

    if (!originLocation) {
      Alert.alert(
        'Location Required',
        'Laster needs your current location to request a pickup.'
      );
      return;
    }

    if (!toLocation) {
      Alert.alert(
        'Destination Not Located',
        'Please search for and select a valid destination first.'
      );
      return;
    }

    setRequestingTrip(true);

    try {
      const destinationCoordinates = toLocation;

      // Verify that the route and fare have been calculated.
      if (routeDistance === null || routeFare === null) {
        Alert.alert(
          'Route Not Ready',
          'Please select both locations and wait for the distance and fare to be calculated.',
        );
        return;
      }

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

      const pickupAddress = await osmMappingProvider.doReverseGeocode({
        latitude: originLocation.latitude,
        longitude: originLocation.longitude,
      });

      if (!pickupAddress) {
        throw new Error('Could not determine the pickup address.');
      }

      const { data: result, error } = await supabase.functions.invoke(
        'request-trip',
        {
          body: {
            from: pickupAddress,
            to,
            cargo,
            cargoPhoto: cargoPhotoUrl,
            firstName,
            phone,
            payment,
            fromLatitude: originLocation.latitude,
            fromLongitude: originLocation.longitude,
            toLatitude: destinationCoordinates.latitude,
            toLongitude: destinationCoordinates.longitude,
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
        toLatitude: savedTrip.trip_to_lat,
        toLongitude: savedTrip.trip_to_lon,        
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
      setRouteFare(Number(newTrip.fare));

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
    setRouteFare(null);
    setRouteDistance(null);
    setCargo('');
    setCargoPhoto(null);
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
      <View style={accountStylesCommon.pageHeader}>
        <View style={accountStylesCommon.pageHeaderContent}>
          <View style={accountStylesCommon.pageHeaderText}>
            <Text style={accountStylesCommon.pageSubtitle}>
              {customer
                ? 'Request and manage your trips'
                : (
                  <>
                    <Text
                      style={accountStylesCommon.accountLink}
                      onPress={() => router.push('/(tabs)/customer_account?mode=default')}
                    >
                      Log in
                    </Text>
                    {' to request and manage your trips'}
                  </>
                )}
            </Text>
          </View>
          <CustomerAccountButton />
        </View>
      </View>

      {/* Trip Details — authenticated customers only */}
      {supabaseAuthUser && customer && (
        <View style={customerStyles.tripCard}>

        <Text style={customerStyles.sectionTitle}>Trip Details</Text>

        {/* To */}
        <View style={[customerStyles.inputGroup, { marginBottom: 20 }]}>
          <View style={customerStyles.fieldHeader}>
            <MaterialCommunityIcons
              name="map-marker-check-outline"
              size={22}
              color="#B8BCC4"
            />
            <Text style={customerStyles.fieldLabel}>To</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            {toLocation ? (
              <Text
                style={[
                  customerStyles.input,
                  { flex: 1, textAlignVertical: 'center' },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {to}
              </Text>
            ) : (
              <TextInput
                style={[customerStyles.input, { flex: 1 }]}
                placeholder="Where to?"
                placeholderTextColor="#888"
                value={to}
                onChangeText={(text) => {
                  setTo(text);
                  setToLocation(null);
                }}
                editable={status === 'Not submitted' && !resolvingDestination}
              />
            )}

            <Pressable
              onPress={() => {
                setTo('');
                setToLocation(null);
              }}
              disabled={!to || resolvingDestination}
              style={{ padding: 2 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color="#B8BCC4"
              />
            </Pressable>

            <Pressable
              onPress={() => {
                resolveDestination();
              }}
              disabled={!to.trim() || resolvingDestination || status !== 'Not submitted'}
              style={{ padding: 8 }}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={24}
                color="#B8BCC4"
              />
            </Pressable>
          </View>

          {resolvingDestination && (
            <Text style={{ color: '#B8BCC4', marginTop: 6 }}>
              Searching...
            </Text>
          )}

          {toLocation && (
            <Text
              style={{ color: '#8BCFAE', marginTop: 5 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Destination located.
            </Text>
          )}
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

        {/* To Address */}
        <View style={customerStyles.infoRow}>
          <View style={[customerStyles.infoContent, {flexDirection: 'row', alignItems: 'center'}]}>
            <Text style={customerStyles.infoLabel}>TO</Text>
            <Text style={[customerStyles.infoValue, {marginLeft: 12, flex: 1 }]}>
              {to || '-'}
            </Text>
          </View>
        </View>

        {/* Fare */}
        <View style={customerStyles.infoRow}>
          <View style={customerStyles.infoContent}>
            <Text style={customerStyles.infoLabel}>FARE</Text>
              <Text style={customerStyles.infoValue}>
                {routeFare === null ? '-' : `$${routeFare.toFixed(2)}`}
              </Text>
          </View>
        </View>

        {/* Distance */}
        <View style={customerStyles.infoRow}>
          <View style={customerStyles.infoContent}>
            <Text style={customerStyles.infoLabel}>DISTANCE</Text>
              <Text style={customerStyles.infoValue}>
                {calculatingRoute
                  ? 'Calculating...'
                  : routeDistance === null
                    ? '-'
                    : `${routeDistance.toFixed(1)} mi`}
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
              (requestingTrip || resolvingDestination) && { opacity: 0.6 },
            ]}
            onPress={requestTrip}
            disabled={requestingTrip || resolvingDestination}
          >
            <Text style={customerStyles.buttonText}>
              {resolvingDestination
                ? 'Locating Destination...'
                : requestingTrip
                  ? 'Requesting Trip...'
                  : 'Request Trip'}
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
    </ScrollView>
  );
}