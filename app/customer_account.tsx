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
import { useCustomer } from '../data/customer';
import { useTrip } from '../data/trip';

export default function CustomerAccountScreen() {
  const { customer, setCustomer } = useCustomer();
  const { trips } = useTrip();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('');

  const hasAccount = customer !== null;

  // Load the saved customer information when the account exists
  useEffect(() => {
    if (customer) {
      setPhone(customer.phone);
      setEmail(customer.email);
      setPayment(customer.payment);
    } else {
      setPhone('');
      setEmail('');
      setPayment('');
    }
  }, [customer]);

  const customerTrips = trips.filter(
    (trip) =>
      customer !== null &&
      trip.customerID === customer.customerID &&
      trip.status === 'Completed'
  );

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

      {/* Contact */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Contact</Text>

        {/* Phone */}
        <Text style={accountStyles.fieldLabel}>Phone</Text>

        <TextInput
          style={accountStyles.input}
          placeholder="Enter phone number"
          placeholderTextColor="#888"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        {/* Email */}
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
      </View>

      {/* Payment */}
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

      {/* Trip History */}
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
                  {trip.tripID}
                </Text>

                <Text style={accountStyles.tripRoute}>
                  {trip.from || '...'} → {trip.to || '...'}
                </Text>

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

      {/* Actions */}
      <View style={accountStyles.actions}>

        {hasAccount && (
          <>
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