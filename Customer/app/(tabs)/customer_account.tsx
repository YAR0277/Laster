import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatDisplayTripID } from '@laster/common';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStripe } from '@stripe/stripe-react-native';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { styles as accountStylesCommon } from '../../../Common/src/components/account';
import { styles as commonStyles } from '../../../Common/src/components/common';
import { styles as accountStyles } from '../../components/customer_account';
import { useAuth } from '../../data/auth';
import { useCustomer } from '../../data/customer';
import { useTrip } from '../../data/trip';
import { supabase } from '../../lib/supabase';

export default function CustomerAccountScreen() {
  const { customer, setCustomer } = useCustomer();
  const { trips, refreshTrips } = useTrip();
  const { user: supabaseAuthUser } = useAuth();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('');
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState<'login' | 'open'>('login');
  const hasAccount = supabaseAuthUser !== null && customer !== null;

  useFocusEffect(
    useCallback(() => {
      void refreshTrips();
    }, [refreshTrips])
  );

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
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        payment: 'No card saved',
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
          'Account Opened',
          'You have opened a Laster customer account, but you will need to log in.'
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
      payment: 'No card saved',
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
      'Account Opened',
      'You have opened a Laster customer account, and you are now logged in.'
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
      'Welcome back.'
    );
  };

  const setupCustomerCard = async () => {
    if (!customer || !supabaseAuthUser) {
      Alert.alert('Login Required', 'Please log in to add a payment card.');
      return;
    }

    setPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-customer-payment-setup',
        { body: {} },
      );

      if (error || !data?.setupIntentClientSecret || !data?.customerId || !data?.ephemeralKeySecret) {
        throw new Error(data?.error || error?.message || 'Could not start secure card setup.');
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Laster',
        customerId: data.customerId,
        customerEphemeralKeySecret: data.ephemeralKeySecret,
        setupIntentClientSecret: data.setupIntentClientSecret,
        returnURL: 'laster://stripe-redirect',
        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return;
        throw new Error(presentError.message);
      }

      const setupIntentId = data.setupIntentClientSecret.split('_secret_')[0];
      const { data: verified, error: verifyError } = await supabase.functions.invoke(
        'verify-customer-payment-method',
        { body: { setupIntentId } },
      );

      if (verifyError || verified?.status !== 'saved') {
        throw new Error(verified?.error || verifyError?.message || 'Card setup could not be verified.');
      }

      const cardLabel = `${String(verified.brand).toUpperCase()} ending in ${verified.last4}`;
      setPayment(cardLabel);
      setCustomer({
        ...customer,
        payment: cardLabel,
        paymentMethodBrand: verified.brand,
        paymentMethodLast4: verified.last4,
        paymentMethodExpMonth: verified.expMonth,
        paymentMethodExpYear: verified.expYear,
      });
      Alert.alert('Card Saved', `Your ${cardLabel} card is saved for Laster payments.`);
    } catch (error) {
      Alert.alert(
        'Payment Setup Error',
        error instanceof Error ? error.message : 'Unable to save your card.',
      );
    } finally {
      setPaymentLoading(false);
    }
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
      <View style={accountStylesCommon.pageHeader}>
        <View style={accountStylesCommon.pageHeaderContent}>
          <View style={accountStylesCommon.pageHeaderText}>
            <Text style={accountStylesCommon.pageSubtitle}>
              Manage your Customer account
            </Text>
          </View>

          <Pressable
            style={accountStylesCommon.accountButton}
            onPress={() => router.push('/customer_account?mode=default')}
          >
            <MaterialCommunityIcons
              name={customer ? 'account-check' : 'account-outline'}
              size={30}
              color={customer ? '#F59E0B' : '#B8BCC4'}
            />

            {customer && (
              <Text style={accountStylesCommon.accountName}>
                {customer.firstName}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Account Mode */}
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

      {/* Update Account */}
      {hasAccount && (
        <View style={accountStylesCommon.actions}>
          <Pressable
            style={accountStyles.primaryButton}
            onPress={updateAccount}
          >
            <Text style={accountStylesCommon.buttonText}>
              Update Account
            </Text>
          </Pressable>
        </View>
      )}

      {/* Payment */}
      {(hasAccount || accountMode === 'open') && (
        <View style={accountStylesCommon.section}>
          <View style={accountStylesCommon.sectionHeading}>
            <MaterialCommunityIcons
              name="credit-card-outline"
              size={23}
              color="#D8DCE3"
            />
            <Text style={accountStylesCommon.sectionTitle}>Payment</Text>
          </View>
          {hasAccount && customer?.paymentMethodBrand && customer.paymentMethodLast4 ? (
            <>
              <Text style={accountStylesCommon.fieldLabel}>Saved card</Text>
              <Text style={accountStyles.infoValue}>
                {String(customer.paymentMethodBrand).toUpperCase()} ending in {customer.paymentMethodLast4}
              </Text>
              {customer.paymentMethodExpMonth != null && customer.paymentMethodExpYear != null && (
                <Text style={accountStyles.infoLabel}>
                  Expires {String(customer.paymentMethodExpMonth).padStart(2, '0')}/{customer.paymentMethodExpYear}
                </Text>
              )}
            </>
          ) : (
            <Text style={accountStylesCommon.emptyText}>
              {hasAccount ? 'No payment card saved yet.' : 'You can add a card after opening your account.'}
            </Text>
          )}
          {hasAccount && (
            <Pressable
              style={[accountStyles.primaryButton, accountStyles.paymentButton]}
              onPress={setupCustomerCard}
              disabled={paymentLoading}
            >
              <Text style={accountStylesCommon.buttonText}>
                {paymentLoading ? 'Processing…' : customer?.paymentMethodLast4 ? 'Change Card' : 'Add Payment Card'}
              </Text>
            </Pressable>
          )}
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

        {customerTrips.length === 0 ? (
          <Text style={accountStylesCommon.emptyText}>
            No trip history.
          </Text>
        ) : (
          customerTrips.map((trip) => (
            <View
              key={trip.tripID}
              style={accountStylesCommon.tripRow}
            >
              <View>
                <Text style={accountStylesCommon.tripDate}>
                  {formatTripDate(trip.requestedAt)}
                </Text>

                <Text style={accountStylesCommon.tripRoute}>
                  Trip: {formatDisplayTripID(trip.displayTripID)}
                </Text>

                <Text style={accountStylesCommon.tripRoute}>
                  Status: {trip.status}
                </Text>

                <Text style={accountStylesCommon.tripRoute}>
                  Cargo: {trip.cargo || '...'}
                </Text>

                <Text style={accountStylesCommon.tripRoute}>
                  Distance:{' '}
                  {trip.distance !== null
                    ? `${trip.distance.toFixed(2)} mi`
                    : '...'}
                </Text>

                {trip.driverFirstName && (
                  <Text style={accountStylesCommon.tripRoute}>
                    Driver: {trip.driverFirstName}
                  </Text>
                )}

                <Text style={accountStylesCommon.tripRoute}>
                  Rating:{' '}
                  {trip.driverRating != null
                    ? `${trip.driverRating}/5`
                    : 'Not rated'}
                </Text>                
              </View>

              <Text style={accountStylesCommon.tripFare}>
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
      <View style={accountStylesCommon.actions}>

        {!hasAccount ? (
          <>
            {accountMode === 'login' ? (
              <Pressable
                style={accountStyles.primaryButton}
                onPress={login}
              >
                <Text style={accountStylesCommon.buttonText}>
                  Login
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={accountStyles.primaryButton}
                onPress={openAccount}
              >
                <Text style={accountStylesCommon.buttonText}>
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