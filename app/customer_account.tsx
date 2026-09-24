import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
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
import { styles as accountStyles } from '../components/customer_account';
import { useAuth } from '../data/auth';
import { useCustomer } from '../data/customer';
import { useTrip } from '../data/trip';
import { supabase } from '../lib/supabase';

export default function CustomerAccountScreen() {
  const { customer, setCustomer } = useCustomer();
  const { trips } = useTrip();
  const { user: supabaseAuthUser } = useAuth();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('');
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState<'login' | 'open'>('login');
  const hasAccount = supabaseAuthUser !== null && customer !== null;

  useEffect(() => {
    if (mode === 'open') {
      setAccountMode('open');
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'open') {
      return;
    }

    const loadPendingTrip = async () => {
      const pendingTrip = await AsyncStorage.getItem(
        'laster_pending_trip'
      );

      if (!pendingTrip) {
        return;
      }

      const trip = JSON.parse(pendingTrip);

      setFirstName(trip.firstName);
      setPhone(trip.phone);
      setPayment(trip.payment);
    };

    loadPendingTrip();
  }, [mode]);

  const formatTripDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  // Load the saved customer information when the account exists
  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setPhone(customer.phone);
      setEmail(customer.email);
      setPayment(customer.payment);
    } else {
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setPayment('');
    }
  }, [customer]);

  const customerTrips = trips
    .filter(
      (trip) =>
        customer !== null &&
        trip.customerID === customer.customerID &&
        (trip.status === 'Completed' || trip.status === 'Aborted')
    )
    .sort(
      (a, b) =>
        new Date(b.requestedAt).getTime() -
        new Date(a.requestedAt).getTime()
    );

  const openAccount = async () => {
    if (!firstName || !lastName || !phone || !email || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your first name, last name, phone, email, and password.'
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
      Alert.alert(
        'Account Error',
        'The account could not be created.'
      );
      return;
    }

    const { error: customerError } = await supabase
      .from('customers')
      .insert({
        customer_id: data.user.id,
        auth_user_id: data.user.id,
        is_guest: false,
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        payment,
      });

    if (customerError) {
      Alert.alert('Account Error', customerError.message);
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

    setCustomer({
      customerID: data.user.id,
      firstName,
      lastName,
      phone,
      email,
      payment,
    });

    setPassword('');

    const pendingTrip = await AsyncStorage.getItem(
      'laster_pending_trip'
    );

    if (pendingTrip) {
      router.replace('/customer');
      return;
    }

    Alert.alert(
      'Account Created',
      'Your Laster customer account has been created and you are now logged in.'
    );
  };

  const login = async () => {
    if (!email || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your email and password.'
      );
      return;
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      Alert.alert('Login Error', error.message);
      return;
    }

    if (!data.user) {
      Alert.alert(
        'Login Error',
        'The account could not be logged in.'
      );
      return;
    }

    setPassword('');

    Alert.alert(
      'Login Successful',
      'You are now logged in to your Laster customer account.'
    );
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Logout Error', error.message);
      return;
    }

    setCustomer(null);
  };

  const updateAccount = () => {
    if (!phone) {
      Alert.alert(
        'Missing Information',
        'Please enter your phone number.'
      );
      return;
    }

    if (!customer) {
      return;
    }

    setCustomer({
      ...customer,
      firstName,
      phone,
      email,
      payment,
    });

    Alert.alert(
      'Account Updated',
      'Your Laster account information has been updated.'
    );
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your Laster account and associated data. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            setCustomer(null);
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={commonStyles.contentContainer}
    >
      {/* Page Header */}
      <View style={accountStyles.pageHeader}>
        <View style={accountStyles.pageHeaderContent}>
          <View>
            <Text style={accountStyles.pageSubtitle}>
              Manage your Customer account
            </Text>
          </View>
        </View>
      </View>

      {/* Account Mode */}
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

      {/* Payment */}
      {(hasAccount || accountMode === 'open') && (
        <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Payment</Text>

        <Text style={accountStyles.fieldLabel}>Payment Method</Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter payment method"
          placeholderTextColor="#888"
          value={payment}
          onChangeText={setPayment}
        />
        </View>
      )}

      {/* Trip History */}
      {hasAccount && (
        <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Trip History</Text>

        {customerTrips.length === 0 ? (
          <Text style={accountStyles.emptyText}>
            No trip history.
          </Text>
        ) : (
          customerTrips.map((trip) => (
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

                {trip.driverFirstName && (
                  <Text style={accountStyles.tripRoute}>
                    Driver: {trip.driverFirstName}
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
                {trip.fare !== null
                  ? `$${trip.fare.toFixed(2)}`
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