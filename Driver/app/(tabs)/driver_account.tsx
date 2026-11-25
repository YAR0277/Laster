import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';

import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { styles as accountStylesCommon } from '../../../Common/src/components/account';
import { styles as commonStyles } from '../../../Common/src/components/common';
import { styles as accountStyles } from '../../components/driver_account';
import { useAuth } from '../../data/auth';
import { useDriver } from '../../data/driver';
import { useTrip } from '../../data/trip';
import { supabase } from '../../lib/supabase';

export default function DriverAccountScreen() {
  const router = useRouter();
  const { payout } = useLocalSearchParams<{ payout?: string }>();
  const { driver, setDriver } = useDriver();
  const { trips, refreshTrips } = useTrip();
  const { user: supabaseAuthUser } = useAuth();
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vinNumber, setVinNumber] = useState('');
  const [vinVerification, setVinVerification] = useState('');
  const [isVerifyingVin, setIsVerifyingVin] = useState(false);  
  const [truckPhoto, setTruckPhoto] = useState<string | null>(
    driver?.truckPhoto || null
  );
  const [licenseExpirationDate, setLicenseExpirationDate] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insuranceExpirationDate, setInsuranceExpirationDate] = useState('');
  const [accountMode, setAccountMode] = useState<'login' | 'open'>('login');
  const hasAccount = supabaseAuthUser !== null && driver !== null;
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<
    'checking' | 'required' | 'ready' | 'restricted' | 'error'
  >('checking');
  const [contactExpanded, setContactExpanded] = useState(false);
  const [pickupTruckExpanded, setPickupTruckExpanded] = useState(false);
  const [licenseExpanded, setLicenseExpanded] = useState(false);
  const [insuranceExpanded, setInsuranceExpanded] = useState(false);
  const [payoutSettingsExpanded, setPayoutSettingsExpanded] = useState(false);
  const [ratingExpanded, setRatingExpanded] = useState(false);
  const [tripHistoryExpanded, setTripHistoryExpanded] = useState(false);
  const verifyPayoutStatus = useCallback(async () => {
    if (!hasAccount) {
      return;
    }

    setPayoutStatus('checking');

    try {
      const { data, error } = await supabase.functions.invoke(
        'verify-driver-payout-method'
      );

      if (error) {
        throw error;
      }

      switch (data?.status) {
        case 'ready':
          setPayoutStatus('ready');
          break;
        case 'onboarding_required':
          setPayoutStatus('required');
          break;
        case 'restricted':
          setPayoutStatus('restricted');
          break;
        default:
          throw new Error(
            data?.error ?? 'Unexpected payout verification response.'
          );
      }
    } catch (error) {
      console.error('Payout verification error:', error);
      setPayoutStatus('error');
    }
  }, [hasAccount]);
    
  const formatTripDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const pickTruckPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setTruckPhoto(result.assets[0].uri);
    }
  };

  const verifyVin = async () => {
    const vin = vinNumber.trim().toUpperCase();

    // Check format: 17 characters, excluding I, O, and Q.
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      setVinVerification(
        'Invalid VIN. Enter 17 characters; I, O, and Q are not allowed.'
      );
      return;
    }

    setIsVerifyingVin(true);
    setVinVerification('Checking VIN...');

    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`
      );

      if (!response.ok) {
        throw new Error('VIN lookup failed.');
      }

      const data = await response.json();
      const vehicle = data.Results?.[0];

      if (!vehicle?.Make || !vehicle?.Model) {
        setVinVerification('VIN could not be verified by NHTSA.');
        return;
      }

      setVinVerification(
        `Verified: ${vehicle.ModelYear || 'Year unknown'} ${vehicle.Make} ${vehicle.Model}`
      );
    } catch {
      setVinVerification(
        'Unable to verify VIN. Please try again.'
      );
    } finally {
      setIsVerifyingVin(false);
    }
  };

  const driverTrips = trips
    .filter(
      (trip) =>
        driver !== null &&
        trip.driverID === driver.driverID &&
        (trip.status === 'Completed' || trip.status === 'Aborted')
    )
    .sort(
      (a, b) =>
        new Date(b.requestedAt).getTime() -
        new Date(a.requestedAt).getTime()
    );

  useFocusEffect(
    useCallback(() => {
      void refreshTrips();
      void verifyPayoutStatus();
    }, [refreshTrips, verifyPayoutStatus])
  );

  useEffect(() => {
    if (payout === 'return' && hasAccount) {
      void verifyPayoutStatus();
    }
  }, [payout, hasAccount, verifyPayoutStatus]);

  useEffect(() => {
    if (driver) {
      setFirstName(driver.firstName);
      setLastName(driver.lastName);
      setPhone(driver.phone);
      setEmail(driver.email);
      setMake(driver.make);
      setModel(driver.model);
      setYear(driver.year);
      setVinNumber(driver.vinNumber);
      setTruckPhoto(driver.truckPhoto);
      setLicenseExpirationDate(driver.licenseExpirationDate);
      setLicenseNumber(driver.licenseNumber);
      setLicenseState(driver.licenseState);
      setDateOfBirth(driver.dateOfBirth);
      setInsurancePolicy(driver.insurancePolicy);
      setInsuranceCompany(driver.insuranceCompany);
      setInsuranceExpirationDate(driver.insuranceExpirationDate);
    } else {
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setMake('');
      setModel('');
      setYear('');
      setVinNumber('');
      setTruckPhoto('');
      setLicenseExpirationDate('');
      setLicenseNumber('');
      setLicenseState('');
      setDateOfBirth('');
      setInsurancePolicy('');
      setInsuranceCompany('');
      setInsuranceExpirationDate('');
      setVinVerification('');
      setIsVerifyingVin(false);
    }
  }, [driver]);

  const login = async () => {
    if (!email || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your email address and password.'
      );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert(
        'Login Error',
        error.message
      );
      return;
    }

    setPassword('');
  };

  const uploadTruckPhoto = async (): Promise<string> => {
    if (!truckPhoto) {
      return '';
    }

    if (!truckPhoto.startsWith('file://')) {
      return truckPhoto;
    }

    const file = new File(truckPhoto);
    const arrayBuffer = await file.arrayBuffer();

    const fileName = `${uuidv4()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('truck-photos')
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('truck-photos')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const deleteTruckPhoto = async (photoUrl: string) => {
    if (!photoUrl) {
      return;
    }

    const fileName = photoUrl.split('/').pop();

    if (!fileName) {
      return;
    }

    const { error } = await supabase.storage
      .from('truck-photos')
      .remove([fileName]);

    if (error) {
      throw error;
    }
  };

  const openAccount = async () => {
    if (!firstName || !lastName || !phone || !email || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your first name, last name, phone number, email, and password.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Invalid Password',
        'Your password must be at least 6 characters.'
      );
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert('Account Error', error.message);
      return;
    }

    if (!data.user) {
      Alert.alert('Account Error', 'The account could not be created.');
      return;
    }

    if (!data.session) {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        Alert.alert(
          'Account Created',
          'Your account was created, but you will need to log in before submitting your documents.'
        );
        return;
      }
    }

      let truckPhotoUrl = '';

      try {
        truckPhotoUrl = await uploadTruckPhoto();
      } catch (error) {
      Alert.alert(
        'Photo Upload Error',
        error instanceof Error
          ? error.message
          : 'The truck photo could not be uploaded.'
      );
      return;
    }

    const { error: driverError } = await supabase
      .from('drivers')
      .insert({
        driver_id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        make,
        model,
        year,
        vin_number: vinNumber,
        truck_photo: truckPhotoUrl,
        license_expiration_date: licenseExpirationDate,
        license_number: licenseNumber,
        license_state: licenseState,
        date_of_birth: dateOfBirth,
        insurance_policy: insurancePolicy,
        insurance_company: insuranceCompany,
        insurance_expiration_date: insuranceExpirationDate,
        rating: null,
        number_of_ratings: 0,
        number_of_trips: 0,
      });

    if (driverError) {
      Alert.alert('Account Error', driverError.message);
      return;
    }

    setDriver({
      driverID: data.user.id,
      firstName,
      lastName,
      phone,
      email,
      make,
      model,
      year,
      vinNumber,
      truckPhoto: truckPhotoUrl,
      licenseExpirationDate,
      licenseNumber,
      licenseState,
      dateOfBirth,
      insurancePolicy,
      insuranceCompany,
      insuranceExpirationDate,
      insuranceCardPath: null,
      rating: null,
      numberOfRatings: 0,
      numberOfTrips: 0,
      licenseStatus: false,
      insuranceStatus: false,
      payoutStatus: false,
      accountStatus: false,      
    });

    setPassword('');

    Alert.alert(
      'Account Opened',
      'You have opened a Laster driver account and you are now logged in.'
    );
  };

  const updateAccount = async () => {
    if (!driver) {
      return;
    }

    let truckPhotoUrl = '';

    try {
      truckPhotoUrl = await uploadTruckPhoto();

    } catch (error) {
      Alert.alert(
        'Photo Upload Error',
        error instanceof Error
          ? error.message
          : 'A photo could not be uploaded.'
      );
      return;
    }

    const { error } = await supabase
      .from('drivers')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        make,
        model,
        vin_number: vinNumber,
        year,
        truck_photo: truckPhotoUrl,
        license_expiration_date: licenseExpirationDate,
        license_number: licenseNumber,
        license_state: licenseState,
        date_of_birth: dateOfBirth,
        insurance_policy: insurancePolicy,
        insurance_company: insuranceCompany,
        insurance_expiration_date: insuranceExpirationDate,
      })
      .eq('driver_id', driver.driverID);

    if (error) {
      Alert.alert(
        'Account Error',
        `The account could not be updated.\n\n${error.message}`
      );
      return;
    }

    // Delete old truck photo
    if (
      driver.truckPhoto &&
      driver.truckPhoto !== truckPhotoUrl
    ) {
      try {
        await deleteTruckPhoto(driver.truckPhoto);
      } catch (error) {
        console.error(
          'Old truck photo could not be deleted:',
          error
        );
      }
    }

    setDriver({
      ...driver,
      firstName,
      lastName,
      phone,
      email,
      make,
      model,
      vinNumber,
      year,
      truckPhoto: truckPhotoUrl,
      licenseExpirationDate,
      licenseNumber,
      licenseState,
      dateOfBirth,
      insurancePolicy,
      insuranceCompany,
      insuranceExpirationDate,
    });

    Alert.alert(
      'Account Updated',
      'Your driver account has been updated.'
    );
  };

  const deleteAccount = async () => {
    if (!driver) {
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
        'Account Error',
        `The driver's current trip could not be checked.\n\n${acceptedTripError.message}`
      );
      return;
    }

    if (acceptedTrip) {
      Alert.alert(
        'Cannot Delete Account',
        'You cannot delete your driver account while you have an accepted trip. Please complete or abort your current trip first.'
      );
      return;
    }

    Alert.alert(
      'Delete Account',
      'This will permanently delete your Laster driver account and associated data. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase.functions.invoke(
              'delete-driver-account'
            );

            if (error) {
              Alert.alert(
                'Delete Account Error',
                error.message
              );
              return;
            }

            if (!data?.success) {
              Alert.alert(
                'Delete Account Error',
                data?.error ?? 'The driver account could not be deleted.'
              );
              return;
            }

            setDriver(null);

            Alert.alert(
              'Account Deleted',
              'Your Laster driver account has been permanently deleted.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace('/(tabs)/driver');
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Logout Error', error.message);
      return;
    }

    setDriver(null);
  };

  const setUpPayouts = async () => {
    if (payoutLoading) {
      return;
    }

    setPayoutLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'create-driver-payout-onboarding'
      );

      if (error) {
        throw error;
      }

      if (!data?.url || typeof data.url !== 'string') {
        throw new Error(
          data?.error ?? 'The payout setup link could not be created.'
        );
      }

      const supported = await Linking.canOpenURL(data.url);

      if (!supported) {
        throw new Error('The payout setup page could not be opened.');
      }

      await Linking.openURL(data.url);
    } catch (error) {
      Alert.alert(
        'Payout Setup Error',
        error instanceof Error
          ? error.message
          : 'Payout setup could not be started. Please try again.'
      );
    } finally {
      setPayoutLoading(false);
    }
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
              Manage your account
            </Text>
          </View>

          <Pressable
            style={accountStylesCommon.accountButton}
            onPress={() => router.push('/driver_account')}
          >
            <MaterialCommunityIcons
              name={hasAccount ? 'account-check' : 'account-outline'}
              size={30}
              color={hasAccount ? '#F59E0B' : '#B8BCC4'}
            />
            {driver && (
              <Text style={accountStylesCommon.accountName}>
                {driver.firstName}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Login / Open Account Toggle */}
      {!hasAccount && (
        <View style={accountStylesCommon.toggleContainer}>
          <Pressable
            style={[
              accountStylesCommon.toggleButton,
              accountMode === 'login' &&
                accountStylesCommon.toggleButtonSelected,
            ]}
            onPress={() => setAccountMode('login')}
          >
            <Text
              style={[
                accountStylesCommon.toggleText,
                accountMode === 'login' &&
                  accountStylesCommon.toggleTextSelected,
              ]}
            >
              Login
            </Text>
          </Pressable>

          <Pressable
            style={[
              accountStylesCommon.toggleButton,
              accountMode === 'open' &&
                accountStylesCommon.toggleButtonSelected,
            ]}
            onPress={() => setAccountMode('open')}
          >
            <Text
              style={[
                accountStylesCommon.toggleText,
                accountMode === 'open' &&
                  accountStylesCommon.toggleTextSelected,
              ]}
            >
              Open Account
            </Text>
          </Pressable>
        </View>
      )}

      {/* Login */}
      <View style={accountStylesCommon.section}>
        <Text style={accountStylesCommon.fieldLabel}>Email</Text>
        <TextInput
          style={accountStylesCommon.input}
          placeholder="Enter email address"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={accountStylesCommon.fieldLabel}>Password</Text>
        <TextInput
          style={accountStylesCommon.input}
          placeholder="Enter password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>

      {/* Contact */}
      {(hasAccount || accountMode === 'open') && (
        <View style={[accountStylesCommon.section, 
                      !contactExpanded && accountStylesCommon.sectionCollapsed,]}>
          <Pressable
            onPress={() => setContactExpanded((expanded) => !expanded)}
            style={accountStylesCommon.sectionHeader}
          >
            <View style={[accountStylesCommon.sectionHeading,
                          !contactExpanded && accountStylesCommon.sectionHeadingCollapsed,]}>
              <MaterialCommunityIcons
                name="account-outline"
                size={23}
                color="#D8DCE3"
              />
              <Text style={accountStylesCommon.sectionTitle}>Contact</Text>
            </View>
            <MaterialCommunityIcons
              name={contactExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#B8BCC4"
            />
          </Pressable>

          {contactExpanded && (
            <>
            <Text style={accountStylesCommon.fieldLabel}>First Name</Text>
              <TextInput
                style={accountStylesCommon.input}
                placeholder="Enter first name"
                placeholderTextColor="#888"
                value={firstName}
                onChangeText={setFirstName}
              />

              <Text style={accountStylesCommon.fieldLabel}>Last Name</Text>
              <TextInput
                style={accountStylesCommon.input}
                placeholder="Enter last name"
                placeholderTextColor="#888"
                value={lastName}
                onChangeText={setLastName}
              />

              <Text style={accountStylesCommon.fieldLabel}>Phone</Text>
              <TextInput
                style={accountStylesCommon.input}
                placeholder="Enter phone number"
                placeholderTextColor="#888"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </>
          )}
        </View>
      )}

      {/* Pickup Truck */}
      {(hasAccount || accountMode === 'open') && (
        <View style={[accountStylesCommon.section, 
                      !pickupTruckExpanded && accountStylesCommon.sectionCollapsed,]}>
          <Pressable
            onPress={() => setPickupTruckExpanded((expanded) => !expanded)}
            style={accountStylesCommon.sectionHeader}
          >
            <View style={[accountStylesCommon.sectionHeading,
                          !pickupTruckExpanded && accountStylesCommon.sectionHeadingCollapsed,]}>
              <MaterialCommunityIcons
                name="car-pickup"
                size={23}
                color="#D8DCE3"
              />
              <Text style={accountStylesCommon.sectionTitle}>Pickup Truck</Text>
            </View>
            <MaterialCommunityIcons
              name={pickupTruckExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#B8BCC4"
            />
          </Pressable>

          {pickupTruckExpanded && (
            <>
            <Text style={accountStylesCommon.fieldLabel}>Make</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="Enter truck make"
              placeholderTextColor="#888"
              value={make}
              onChangeText={setMake}
            />

            <Text style={accountStylesCommon.fieldLabel}>Model</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="Enter truck model"
              placeholderTextColor="#888"
              value={model}
              onChangeText={setModel}
            />

            <Text style={accountStylesCommon.fieldLabel}>Year</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="Enter truck year"
              placeholderTextColor="#888"
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
            />

            <Text style={accountStylesCommon.fieldLabel}>VIN Number</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="Enter VIN"
              placeholderTextColor="#8F96A3"
              value={vinNumber}
              onChangeText={(value) => {
                setVinNumber(value.toUpperCase());
                setVinVerification('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={17}
              onEndEditing={verifyVin}
            />

            {vinVerification !== '' && (
              <Text style={{ color: vinVerification.startsWith('Verified:') ? '#328F7D' : '#D9534F', marginTop: 6 }}>
                {isVerifyingVin ? 'Checking VIN...' : vinVerification}
              </Text>
            )}

            <Text style={accountStylesCommon.fieldLabel}>Truck Photo</Text>
            <Pressable
              style={accountStyles.photoButton}
              onPress={pickTruckPhoto}
            >
              <Text style={accountStyles.photoButtonText}>
                {truckPhoto ? 'Change Truck Photo' : 'Add Truck Photo'}
              </Text>
            </Pressable>

            {truckPhoto && (
              <Image
                source={{ uri: truckPhoto }}
                style={accountStyles.truckPhoto}
                resizeMode="cover"
              />
            )}
            </>
          )}
      </View>
      )}

      {/* Driver's License */}
      {(hasAccount || accountMode === 'open') && (
        <View style={[accountStylesCommon.section, 
                      !licenseExpanded && accountStylesCommon.sectionCollapsed,]}>
          <Pressable
            onPress={() => setLicenseExpanded((expanded) => !expanded)}
            style={accountStylesCommon.sectionHeader}
          >
            <View style={[accountStylesCommon.sectionHeading,
                          !licenseExpanded && accountStylesCommon.sectionHeadingCollapsed,]}>
              <MaterialCommunityIcons
                name="card-account-details-outline"
                size={23}
                color="#D8DCE3"
              />
              <Text style={accountStylesCommon.sectionTitle}>Driver&apos;s License</Text>
              {hasAccount && (
                <MaterialCommunityIcons
                  name={driver?.licenseStatus ? 'check-circle' : 'circle-outline'}
                  size={22}
                  color={driver?.licenseStatus ? '#328F7D' : '#8F96A3'}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </View>
            <MaterialCommunityIcons
              name={licenseExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#B8BCC4"
            />
          </Pressable>

          {licenseExpanded && (
            <>
            <Text style={accountStylesCommon.fieldLabel}>Number</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="Enter license number"
              placeholderTextColor="#888"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
            />

            <Text style={accountStylesCommon.fieldLabel}>Expiration Date</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#888"
              value={licenseExpirationDate}
              onChangeText={setLicenseExpirationDate}
            />

            <Text style={accountStylesCommon.fieldLabel}>State</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="Enter license state"
              placeholderTextColor="#888"
              value={licenseState}
              onChangeText={setLicenseState}
            />

            <Text style={accountStylesCommon.fieldLabel}>Date of Birth</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#888"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
            />
            </>
          )}
        </View>
      )}

      {/* Insurance */}
      {(hasAccount || accountMode === 'open') && (
        <View style={[accountStylesCommon.section, 
                      !insuranceExpanded && accountStylesCommon.sectionCollapsed,]}>
          <Pressable
            onPress={() => setInsuranceExpanded((expanded) => !expanded)}
            style={accountStylesCommon.sectionHeader}
          >
            <View style={[accountStylesCommon.sectionHeading,
                          !insuranceExpanded && accountStylesCommon.sectionHeadingCollapsed,]}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={23}
                color="#D8DCE3"
              />
              <Text style={accountStylesCommon.sectionTitle}>Insurance</Text>
              {hasAccount && (
                <MaterialCommunityIcons
                  name={driver?.insuranceStatus ? 'check-circle' : 'circle-outline'}
                  size={22}
                  color={driver?.insuranceStatus ? '#328F7D' : '#8F96A3'}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </View>
            <MaterialCommunityIcons
              name={insuranceExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#B8BCC4"
            />
          </Pressable>

          {insuranceExpanded && (
            <>
            <Text style={accountStylesCommon.fieldLabel}>Insurance Provider</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="Enter insurance provider"
              placeholderTextColor="#888"
              value={insuranceCompany}
              onChangeText={setInsuranceCompany}
            />            
            <Text style={accountStylesCommon.fieldLabel}>Policy Number</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="Enter policy number"
              placeholderTextColor="#888"
              value={insurancePolicy}
              onChangeText={setInsurancePolicy}
            />

            <Text style={accountStylesCommon.fieldLabel}>Expiration Date</Text>
            <TextInput
              style={accountStylesCommon.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#8F96A3"
              value={insuranceExpirationDate}
              onChangeText={setInsuranceExpirationDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            </>
          )}
        </View>
      )}


      {/* Update Account */}
      {hasAccount && (
        <View style={accountStylesCommon.actions}>
          <Pressable
            style={accountStyles.primaryButton}
            onPress={updateAccount}
          >
            <Text style={accountStylesCommon.buttonText}>Update Account</Text>
          </Pressable>
        </View>
      )}

      {/* Payout Settings */}
      {hasAccount && (
        <View style={[accountStylesCommon.section, 
                      !payoutSettingsExpanded && accountStylesCommon.sectionCollapsed,]}>
          <Pressable
            onPress={() => setPayoutSettingsExpanded((expanded) => !expanded)}
            style={accountStylesCommon.sectionHeader}
          >
            <View style={[accountStylesCommon.sectionHeading,
                          !payoutSettingsExpanded && accountStylesCommon.sectionHeadingCollapsed,]}>
              <MaterialCommunityIcons
                name="wallet-outline"
                size={23}
                color="#D8DCE3"
              />
              <Text style={accountStylesCommon.sectionTitle}>Payout Settings</Text>
              {hasAccount && (
                <MaterialCommunityIcons
                  name={driver?.payoutStatus ? 'check-circle' : 'circle-outline'}
                  size={22}
                  color={driver?.payoutStatus ? '#328F7D' : '#8F96A3'}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </View>
            <MaterialCommunityIcons
              name={payoutSettingsExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#B8BCC4"
            />
          </Pressable>

          {payoutSettingsExpanded && (
            <>
            <Text style={accountStyles.payoutDescription}>
              Set up your payout account with our payment provider
              to receive payments from Laster. Your driver application
              is not complete until you finish this setup.
            </Text>

            <Pressable
              style={accountStyles.actionRow}
              onPress={setUpPayouts}
              disabled={payoutLoading}
            >
              <Text style={accountStyles.actionRowText}>
                {payoutLoading ? 'Opening Payout Settings...' : 'Go To Setup'}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color="#8F96A3"
              />
            </Pressable>
            </>
          )}
        </View>
      )}

      {/* Rating */}
      {hasAccount && driver?.rating != null && (
        <View style={[accountStylesCommon.section, 
                      !ratingExpanded && accountStylesCommon.sectionCollapsed,]}>
          <Pressable
            onPress={() => setRatingExpanded((expanded) => !expanded)}
            style={accountStylesCommon.sectionHeader}
          >
            <View style={[accountStylesCommon.sectionHeading,
                          !ratingExpanded && accountStylesCommon.sectionHeadingCollapsed,]}>
              <MaterialCommunityIcons
                name="star"
                size={23}
                color="#D8DCE3"
              />
              <Text style={accountStylesCommon.sectionTitle}>Rating</Text>
            </View>
            <MaterialCommunityIcons
              name={ratingExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#B8BCC4"
            />
          </Pressable>

          {ratingExpanded && (
            <>
            <Text style={accountStylesCommon.fieldLabel}>
              {driver.rating.toFixed(1)} / 5
            </Text>
            </>
          )}          
        </View>
      )}

      {/* Trip History */}
      {hasAccount && (
        <View style={[accountStylesCommon.section, 
                      !tripHistoryExpanded && accountStylesCommon.sectionCollapsed,]}>
          <Pressable
            onPress={() => setTripHistoryExpanded((expanded) => !expanded)}
            style={accountStylesCommon.sectionHeader}
          >
            <View style={[accountStylesCommon.sectionHeading,
                          !tripHistoryExpanded && accountStylesCommon.sectionHeadingCollapsed,]}>
              <MaterialCommunityIcons
                name="history"
                size={23}
                color="#D8DCE3"
              />
              <Text style={accountStylesCommon.sectionTitle}>Trip History</Text>
            </View>
            <MaterialCommunityIcons
              name={tripHistoryExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#B8BCC4"
            />
          </Pressable>

          {tripHistoryExpanded && (
            <>
            {driverTrips.length === 0 ? (
              <Text style={accountStylesCommon.emptyText}>
                No trip history.
              </Text>
            ) : (
              driverTrips.map((trip) => (
                <View
                  key={trip.tripID}
                  style={accountStylesCommon.tripRow}
                >
                  <View>
                    <Text style={accountStylesCommon.tripDate}>
                      {formatTripDate(trip.requestedAt)}
                    </Text>

                    <Text style={accountStylesCommon.tripRoute}>
                      Status: {trip.status}
                    </Text>

                    {trip.customerFirstName && (
                      <Text style={accountStylesCommon.tripRoute}>
                        Customer: {trip.customerFirstName}
                      </Text>
                    )}

                    <Text style={accountStylesCommon.tripRoute}>
                      Cargo: {trip.cargo || '...'}
                    </Text>

                    <Text style={accountStylesCommon.tripRoute}>
                      Distance:{' '}
                      {trip.distance !== null
                        ? `${trip.distance.toFixed(2)} mi`
                        : '...'}
                    </Text>

                    <Text style={accountStylesCommon.tripRoute}>
                      Rating:{' '}
                      {trip.driverRating != null
                        ? `${trip.driverRating}/5`
                        : 'Not rated'}
                    </Text>
                  </View>

                  <Text style={accountStylesCommon.tripFare}>
                    {trip.payout !== null
                      ? `$${trip.payout.toFixed(2)}`
                      : '...'}
                  </Text>
                </View>
              ))
            )}
            </>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={accountStylesCommon.actions}>
        {!hasAccount ? (
          <>
            <Pressable
              style={accountStyles.primaryButton}
              onPress={accountMode === 'login' ? login : openAccount}
            >
              <Text style={accountStylesCommon.buttonText}>
                {accountMode === 'login' ? 'Login' : 'Open'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={accountStyles.primaryButton}
              onPress={logout}
            >
              <Text style={accountStylesCommon.buttonText}>
                Logout
              </Text>
            </Pressable>

            <Pressable
              style={accountStylesCommon.deleteButton}
              onPress={deleteAccount}
            >
              <Text style={accountStylesCommon.buttonText}>
                Delete Account
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}
