import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [insuranceProviderFocused, setInsuranceProviderFocused] = useState(false);
  const insuranceProviderRef = useRef<TextInput>(null);
  const [insuranceExpirationDate, setInsuranceExpirationDate] = useState('');
  const [insuranceCardPhoto, setInsuranceCardPhoto] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<'login' | 'open'>('login');
  const hasAccount = supabaseAuthUser !== null && driver !== null;
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<
    'checking' | 'required' | 'ready' | 'restricted' | 'error'
  >('checking');

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

  const captureDocumentPhoto = async (
    setPhoto: (uri: string) => void
  ) => {
    try {
      console.log('Camera: requesting permission');

      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Camera Permission',
          'LasterDriver needs camera access to photograph your documents.'
        );
        return;
      }

      console.log('Camera: launching');

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      console.log('Camera: returned', result.canceled);

      if (!result.canceled && result.assets?.length > 0) {
        console.log('Camera: image URI', result.assets[0].uri);
        setPhoto(result.assets[0].uri);
        console.log('Camera: photo state update requested');
      }
    } catch (error) {
      console.error('Camera error:', error);

      Alert.alert(
        'Camera Error',
        error instanceof Error ? error.message : 'Unable to capture photo.'
      );
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
    } catch (error) {
      setVinVerification(
        'Unable to verify VIN. Please try again.'
      );
    } finally {
      setIsVerifyingVin(false);
    }
  };

  const documentPhotoControl = (
    title: string,
    photo: string | null,
    setPhoto: (uri: string) => void
  ) => (
    <View style={{ marginTop: 12 }}>
      <Text style={accountStylesCommon.fieldLabel}>
        {title}
      </Text>

      <Pressable
        onPress={() => captureDocumentPhoto(setPhoto)}
        style={accountStyles.photoButton}
      >
        <MaterialCommunityIcons
          name="camera-outline"
          size={20}
          color="#FFFFFF"
        />
        <Text style={accountStyles.photoButtonText}>
          {photo ? 'Retake Photo' : 'Take Photo'}
        </Text>
      </Pressable>

      {photo && (
        <Image
          source={{ uri: photo }}
          style={{
            width: '100%',
            height: 180,
            marginTop: 10,
            borderRadius: 8,
          }}
          resizeMode="contain"
        />
      )}
    </View>
  );

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
    }, [refreshTrips])
  );

  useEffect(() => {
    if (!insuranceProviderFocused) {
      insuranceProviderRef.current?.setNativeProps({
        selection: { start: 0, end: 0 },
      });
    }
  }, [insuranceCompany, insuranceProviderFocused]);

  useEffect(() => {
    const recoverPendingPhoto = async () => {
      try {
        const result = await ImagePicker.getPendingResultAsync();

        if (result && !('code' in result) && !result.canceled) {
          const uri = result.assets?.[0]?.uri;

          if (uri) {
            console.log('Recovered camera photo:', uri);
            setInsuranceCardPhoto(uri);
          }
        }
      } catch (error) {
        console.error('Pending photo recovery error:', error);
      }
    };

    recoverPendingPhoto();
  }, []);

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

    Alert.alert(
      'Login Successful',
      'Welcome back.'
    );

    router.replace('/(tabs)/driver');
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

  const uploadDriverDocument = async (
    photo: string | null,
    driverID: string,
    documentType: string
  ): Promise<string> => {
    if (!photo) {
      throw new Error(`${documentType} photo is missing.`);
    }

    const file = new File(photo);
    const arrayBuffer = await file.arrayBuffer();

    const fileName = `${driverID}/${uuidv4()}.jpg`;

    const { error } = await supabase.storage
      .from('driver-documents')
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return fileName;
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
    let insuranceCardPath: string | null = null;
    try {
      truckPhotoUrl = await uploadTruckPhoto();

      insuranceCardPath = await uploadDriverDocument(
        insuranceCardPhoto,
        data.user.id,
        'Insurance Card'
      );
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
        insurance_card_path: insuranceCardPath,
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
      insuranceCardPath,
      rating: null,
      numberOfRatings: 0,
      numberOfTrips: 0,
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
    let insuranceCardPath = driver.insuranceCardPath;

    try {
      truckPhotoUrl = await uploadTruckPhoto();

      if (insuranceCardPhoto) {
        insuranceCardPath = await uploadDriverDocument(
          insuranceCardPhoto,
          driver.driverID,
          'Insurance Card'
        );
      }
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
        insurance_card_path: insuranceCardPath,
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
      insuranceCardPath,
    });

    // Clear local document selections after successful save.
    setInsuranceCardPhoto(null);

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
              Manage your Driver account
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
        <View style={accountStylesCommon.section}>
          <View style={accountStylesCommon.sectionHeading}>
            <MaterialCommunityIcons
              name="account-outline"
              size={23}
              color="#D8DCE3"
            />
            <Text style={accountStylesCommon.sectionTitle}>Contact</Text>
          </View>

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
        </View>
      )}

      {/* Pickup Truck */}
      {(hasAccount || accountMode === 'open') && (
        <View style={accountStylesCommon.section}>
        <View style={accountStylesCommon.sectionHeading}>
          <MaterialCommunityIcons
            name="car-pickup"
            size={23}
            color="#D8DCE3"
          />
          <Text style={accountStylesCommon.sectionTitle}>Pickup Truck</Text>
        </View>

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
      </View>
      )}

      {/* Driver's License */}
      {(hasAccount || accountMode === 'open') && (
        <View style={accountStylesCommon.section}>
          <View style={accountStylesCommon.sectionHeading}>
            <MaterialCommunityIcons
              name="card-account-details-outline"
              size={23}
              color="#D8DCE3"
            />
            <Text style={accountStylesCommon.sectionTitle}>
              Driver&apos;s License
            </Text>
          </View>

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
        </View>
      )}

      {/* Insurance */}
      {(hasAccount || accountMode === 'open') && (
        <View style={accountStylesCommon.section}>
          <View style={accountStylesCommon.sectionHeading}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={23}
              color="#D8DCE3"
            />
            <Text style={accountStylesCommon.sectionTitle}>Insurance</Text>
          </View>

          <Text style={accountStylesCommon.fieldLabel}>Insurance Provider</Text>
          <TextInput
            ref={insuranceProviderRef}
            style={accountStylesCommon.input}
            placeholder="Enter insurance provider"
            placeholderTextColor="#888"
            value={insuranceCompany}
            onChangeText={setInsuranceCompany}
            onFocus={() => setInsuranceProviderFocused(true)}
            onBlur={() => setInsuranceProviderFocused(false)}
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
        <View style={accountStylesCommon.section}>
          <View style={accountStylesCommon.sectionHeading}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={23}
              color="#D8DCE3"
            />
            <Text style={accountStylesCommon.sectionTitle}>
              Payout Settings
            </Text>
          </View>

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
              {payoutLoading ? 'Opening Payout Settings...' : 'Set Up Payouts'}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#8F96A3"
            />
          </Pressable>
        </View>
      )}

      {/* Rating */}
      {hasAccount && driver?.rating != null && (
        <View style={accountStylesCommon.section}>
          {/* <Text style={accountStyles.sectionTitle}>Rating</Text> */}
          <View style={accountStylesCommon.sectionHeading}>
            <MaterialCommunityIcons
              name="star"
              size={23}
              color="#E7B94C"
            />
            <Text style={accountStylesCommon.sectionTitle}>Rating</Text>
          </View>
          <Text style={accountStylesCommon.fieldLabel}>
            {driver.rating.toFixed(1)} / 5
          </Text>
        </View>
      )}

      {/* Trip History */}
      {hasAccount && (
        <View style={accountStylesCommon.section}>
          <View style={accountStylesCommon.sectionHeading}>
            <MaterialCommunityIcons
              name="history"
              size={23}
              color="#D8DCE3"
            />
            <Text style={accountStylesCommon.sectionTitle}>Trip History</Text>
          </View>

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
        </View>
      )}

      {/* Actions */}
      <View style={accountStylesCommon.actions}>
        {!hasAccount ? (
          <Pressable
            style={accountStyles.primaryButton}
            onPress={accountMode === 'login' ? login : openAccount}
          >
            <Text style={accountStylesCommon.buttonText}>
              {accountMode === 'login' ? 'Login' : 'Open'}
            </Text>
          </Pressable>
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
