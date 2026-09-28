import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { styles as commonStyles } from '../components/common';
import { styles as accountStyles } from '../components/driver_account';
import { useAuth } from '../data/auth';
import { useDriver } from '../data/driver';
import { useTrip } from '../data/trip';
import { supabase } from '../lib/supabase';

export default function DriverAccountScreen() {
  const router = useRouter();
  const { driver, setDriver } = useDriver();
  const { trips } = useTrip();
  const { user: supabaseAuthUser } = useAuth();
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [truckPhoto, setTruckPhoto] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountMode, setAccountMode] =
    useState<'login' | 'open'>('login');
  const hasAccount = supabaseAuthUser !== null && driver !== null;

  const formatTripDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
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

  useEffect(() => {
    if (driver) {
      setFirstName(driver.firstName);
      setLastName(driver.lastName);
      setPhone(driver.phone);
      setEmail(driver.email);
      setMake(driver.make);
      setModel(driver.model);
      setYear(driver.year);
      setTruckPhoto(driver.truckPhoto);
      setLicenseNumber(driver.licenseNumber);
      setLicenseState(driver.licenseState);
      setDateOfBirth(driver.dateOfBirth);
      setInsurancePolicy(driver.insurancePolicy);
      setInsuranceCompany(driver.insuranceCompany);
      setBankAccount(driver.bankAccount);
    } else {
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setMake('');
      setModel('');
      setYear('');
      setTruckPhoto('');
      setLicenseNumber('');
      setLicenseState('');
      setDateOfBirth('');
      setInsurancePolicy('');
      setInsuranceCompany('');
      setBankAccount('');
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
        truck_photo: truckPhoto,
        license_number: licenseNumber,
        license_state: licenseState,
        date_of_birth: dateOfBirth,
        insurance_policy: insurancePolicy,
        insurance_company: insuranceCompany,
        bank_account: bankAccount,
        rating: null,
        number_of_ratings: 0,
        number_of_trips: 0,
      });

    if (driverError) {
      Alert.alert('Account Error', driverError.message);
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
          'Your account was created, but you will need to log in.'
        );
        return;
      }
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
      truckPhoto,
      licenseNumber,
      licenseState,
      dateOfBirth,
      insurancePolicy,
      insuranceCompany,
      bankAccount,
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

    const { error } = await supabase
      .from('drivers')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        make,
        model,
        year,
        truck_photo: truckPhoto,
        license_number: licenseNumber,
        license_state: licenseState,
        date_of_birth: dateOfBirth,
        insurance_policy: insurancePolicy,
        insurance_company: insuranceCompany,
        bank_account: bankAccount,
      })
      .eq('driver_id', driver.driverID);

    if (error) {
      Alert.alert(
        'Account Error',
        `The account could not be updated.\n\n${error.message}`
      );
      return;
    }

    setDriver({
      ...driver,
      firstName,
      lastName,
      phone,
      email,
      make,
      model,
      year,
      truckPhoto,
      licenseNumber,
      licenseState,
      dateOfBirth,
      insurancePolicy,
      insuranceCompany,
      bankAccount,
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
      Alert.alert(
        'Logout Error',
        error.message
      );
      return;
    }

    setDriver(null);
    router.replace('/(tabs)/driver');
  };

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={commonStyles.contentContainer}
    >
      {/* Page Header */}
      <View style={accountStyles.pageHeader}>
        <Text style={accountStyles.pageSubtitle}>
          Manage your Driver account
        </Text>
      </View>

      {/* Login / Open Account Toggle */}
      {!hasAccount && (
        <View style={accountStyles.toggleContainer}>
          <Pressable
            style={[
              accountStyles.toggleButton,
              accountMode === 'login' &&
                accountStyles.toggleButtonSelected,
            ]}
            onPress={() => setAccountMode('login')}
          >
            <Text
              style={[
                accountStyles.toggleText,
                accountMode === 'login' &&
                  accountStyles.toggleTextSelected,
              ]}
            >
              Login
            </Text>
          </Pressable>

          <Pressable
            style={[
              accountStyles.toggleButton,
              accountMode === 'open' &&
                accountStyles.toggleButtonSelected,
            ]}
            onPress={() => setAccountMode('open')}
          >
            <Text
              style={[
                accountStyles.toggleText,
                accountMode === 'open' &&
                  accountStyles.toggleTextSelected,
              ]}
            >
              Open Account
            </Text>
          </Pressable>
        </View>
      )}

      {/* Login */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Login</Text>

        <Text style={accountStyles.fieldLabel}>Email</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter email address"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={accountStyles.fieldLabel}>Password</Text>
        <TextInput
          style={accountStyles.input}
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
        <View style={accountStyles.section}>
          <Text style={accountStyles.sectionTitle}>Contact</Text>

          <Text style={accountStyles.fieldLabel}>First Name</Text>
          <TextInput
            style={accountStyles.input}
            placeholder="Enter first name"
            placeholderTextColor="#888"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text style={accountStyles.fieldLabel}>Last Name</Text>
          <TextInput
            style={accountStyles.input}
            placeholder="Enter last name"
            placeholderTextColor="#888"
            value={lastName}
            onChangeText={setLastName}
          />

          <Text style={accountStyles.fieldLabel}>Phone</Text>
          <TextInput
            style={accountStyles.input}
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
        <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>
          Pickup Truck
        </Text>

        <Text style={accountStyles.fieldLabel}>Make</Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter truck make"
          placeholderTextColor="#888"
          value={make}
          onChangeText={setMake}
        />

        <Text style={accountStyles.fieldLabel}>Model</Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter truck model"
          placeholderTextColor="#888"
          value={model}
          onChangeText={setModel}
        />

        <Text style={accountStyles.fieldLabel}>Year</Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter truck year"
          placeholderTextColor="#888"
          value={year}
          onChangeText={setYear}
          keyboardType="number-pad"
        />
      </View>
      )}

      {/* License */}
      {(hasAccount || accountMode === 'open') && (
        <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>License</Text>

        <Text style={accountStyles.fieldLabel}>
          License Number
        </Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter license number"
          placeholderTextColor="#888"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
        />

        <Text style={accountStyles.fieldLabel}>
          State
        </Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter license state"
          placeholderTextColor="#888"
          value={licenseState}
          onChangeText={setLicenseState}
        />

        <Text style={accountStyles.fieldLabel}>
          Date of Birth
        </Text>

        <TextInput
          style={accountStyles.input}
          placeholder="MM/DD/YYYY"
          placeholderTextColor="#888"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
        />
      </View>
      )}

      {/* Insurance */}
      {(hasAccount || accountMode === 'open') && (
        <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Insurance</Text>

        <Text style={accountStyles.fieldLabel}>
          Policy Number
        </Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter policy number"
          placeholderTextColor="#888"
          value={insurancePolicy}
          onChangeText={setInsurancePolicy}
        />

        <Text style={accountStyles.fieldLabel}>
          Insurance Company
        </Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter insurance company"
          placeholderTextColor="#888"
          value={insuranceCompany}
          onChangeText={setInsuranceCompany}
        />
      </View>
      )}

      {/* Bank Account */}
      {(hasAccount || accountMode === 'open') && (
        <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>
          Bank Account
        </Text>

        <Text style={accountStyles.fieldLabel}>
          Payment Account
        </Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter bank account information"
          placeholderTextColor="#888"
          value={bankAccount}
          onChangeText={setBankAccount}
        />
      </View>
      )}

      {/* Rating */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Rating</Text>

        <Text style={accountStyles.fieldLabel}>
          {driver?.rating !== null && driver?.rating !== undefined
            ? `${driver.rating.toFixed(1)} / 5`
            : 'No rating yet.'}
        </Text>
      </View>

      {/* Trip History */}
      {hasAccount && (
        <View style={accountStyles.section}>
          <Text style={accountStyles.sectionTitle}>
            Trip History
          </Text>

          {driverTrips.length === 0 ? (
            <Text style={accountStyles.emptyText}>
              No trip history.
            </Text>
          ) : (
            driverTrips.map((trip) => (
              <View
                key={trip.tripID}
                style={accountStyles.tripRow}
              >
                <View>
                  <Text style={accountStyles.tripDate}>
                    {formatTripDate(trip.requestedAt)}
                  </Text>

                  <Text style={accountStyles.tripRoute}>
                    {trip.status}
                  </Text>

                  {trip.customerFirstName && (
                    <Text style={accountStyles.tripRoute}>
                      Customer: {trip.customerFirstName}
                    </Text>
                  )}

                  <Text style={accountStyles.tripRoute}>
                    Cargo: {trip.cargo || '...'}
                  </Text>

                  <Text style={accountStyles.tripRoute}>
                    Distance:{' '}
                    {trip.distance !== null
                      ? `${trip.distance} mi`
                      : '...'}
                  </Text>
                </View>

                <Text style={accountStyles.tripFare}>
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
      <View style={accountStyles.actions}>
      {!hasAccount ? (
        <>
          {accountMode === 'login' ? (
            <Pressable
              style={accountStyles.primaryButton}
              onPress={login}
            >
              <Text style={accountStyles.buttonText}>
                Login
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={accountStyles.primaryButton}
              onPress={openAccount}
            >
              <Text style={accountStyles.buttonText}>
                Open
              </Text>
            </Pressable>
          )}
        </>
      ) : (
          <>
            <Pressable
              style={accountStyles.primaryButton}
              onPress={logout}
            >
              <Text style={accountStyles.buttonText}>
                Logout
              </Text>
            </Pressable>

            <Pressable
              style={accountStyles.primaryButton}
              onPress={updateAccount}
            >
              <Text style={accountStyles.buttonText}>
                Update Account
              </Text>
            </Pressable>

            <Pressable
              style={accountStyles.deleteButton}
              onPress={deleteAccount}
            >
              <Text style={accountStyles.buttonText}>
                Delete Account
              </Text>
            </Pressable>
          </>
        )}
      </View>

    </ScrollView>
  );
}