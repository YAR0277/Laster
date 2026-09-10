import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { styles as accountStyles } from '../components/account-customer';
import { styles as commonStyles } from '../components/common';

export default function CustomerAccountScreen() {
  const [hasAccount, setHasAccount] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const openAccount = () => {
    if (!email || !password || !phone) {
      return;
    }

    setHasAccount(true);
    setLoggedIn(true);
  };

  const login = () => {
    if (!email || !password) {
      return;
    }

    setHasAccount(true);
    setLoggedIn(true);
  };

  const logout = () => {
    setLoggedIn(false);
    setEmail('');
    setPassword('');
    setPhone('');
  };

  const updateAccount = () => {
    // Temporary placeholder.
    Alert.alert('Account Updated', 'Your account information has been updated.');
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
            setHasAccount(false);
            setLoggedIn(false);
            setEmail('');
            setPassword('');
            setPhone('');
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
            <Text style={accountStyles.pageTitle}>Customer Account</Text>
            <Text style={accountStyles.pageSubtitle}>
              Manage your Laster account
            </Text>
          </View>
        </View>
      </View>

      {/* Login */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Login</Text>

        <Text style={accountStyles.fieldLabel}>Email</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loggedIn}
        />

        <Text style={accountStyles.fieldLabel}>Password</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loggedIn}
        />
      </View>

      {/* Contact */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Contact</Text>

        <Text style={accountStyles.fieldLabel}>Phone</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter phone number"
          placeholderTextColor="#888"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loggedIn}
        />
      </View>

      {/* Payment */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Payment</Text>

        <View style={accountStyles.infoRow}>
          <Text style={accountStyles.infoLabel}>Payment Method</Text>
          <Text style={accountStyles.infoValue}>
            {loggedIn ? 'Visa •••• 1234' : 'No payment method'}
          </Text>
        </View>
      </View>

      {/* Trip History */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Trip History</Text>

        {loggedIn ? (
          <View style={accountStyles.tripRow}>
            <View>
              <Text style={accountStyles.tripDate}>August 28, 2026</Text>
              <Text style={accountStyles.tripRoute}>
                123 Main Street → 456 Oak Avenue
              </Text>
            </View>

            <Text style={accountStyles.tripFare}>$75.00</Text>
          </View>
        ) : (
          <Text style={accountStyles.emptyText}>
            No trip history.
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={accountStyles.actions}>

        {!hasAccount && (
          <Pressable
            style={accountStyles.primaryButton}
            onPress={openAccount}
          >
            <Text style={accountStyles.buttonText}>Open Account</Text>
          </Pressable>
        )}

        {hasAccount && !loggedIn && (
          <Pressable
            style={accountStyles.primaryButton}
            onPress={login}
          >
            <Text style={accountStyles.buttonText}>Login</Text>
          </Pressable>
        )}

        {loggedIn && (
          <>
            <Pressable
              style={accountStyles.primaryButton}
              onPress={updateAccount}
            >
              <Text style={accountStyles.buttonText}>Update Account</Text>
            </Pressable>

            <Pressable
              style={accountStyles.secondaryButton}
              onPress={logout}
            >
              <Text style={accountStyles.buttonText}>Logout</Text>
            </Pressable>

            <Pressable
              style={accountStyles.deleteButton}
              onPress={deleteAccount}
            >
              <Text style={accountStyles.buttonText}>Delete Account</Text>
            </Pressable>
          </>
        )}

      </View>

    </ScrollView>
  );
}