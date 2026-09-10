import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { styles as accountStyles } from '../components/account-driver';
import { styles as commonStyles } from '../components/common';

export default function DriverAccountScreen() {
  const [hasAccount, setHasAccount] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [truckMake, setTruckMake] = useState('');
  const [truckModel, setTruckModel] = useState('');
  const [truckYear, setTruckYear] = useState('');

  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [policyNumber, setPolicyNumber] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');

  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

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
    setLicenseNumber('');
    setLicenseState('');
    setDateOfBirth('');
    setPolicyNumber('');
    setInsuranceCompany('');
    setRoutingNumber('');
    setAccountNumber('');
    setTruckMake('');
    setTruckModel('');
    setTruckYear('');
  };

  const updateAccount = () => {
    Alert.alert(
      'Account Updated',
      'Your account information has been updated.',
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
            setHasAccount(false);
            setLoggedIn(false);
            setEmail('');
            setPassword('');
            setPhone('');
            setTruckMake('');
            setTruckModel('');
            setTruckYear('');
            setLicenseNumber('');
            setLicenseState('');
            setDateOfBirth('');
            setPolicyNumber('');
            setInsuranceCompany('');
            setRoutingNumber('');
            setAccountNumber('');
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
        <Text style={accountStyles.pageTitle}>Driver Account</Text>
        <Text style={accountStyles.pageSubtitle}>
          Manage your Laster driver account
        </Text>
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

      {/* Pickup Truck */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Pickup Truck</Text>

        <Text style={accountStyles.fieldLabel}>Make</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter truck make"
          placeholderTextColor="#888"
          value={truckMake}
          onChangeText={setTruckMake}
          editable={!loggedIn}
        />

        <Text style={accountStyles.fieldLabel}>Model</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter truck model"
          placeholderTextColor="#888"
          value={truckModel}
          onChangeText={setTruckModel}
          editable={!loggedIn}
        />

        <Text style={accountStyles.fieldLabel}>Year</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter truck year"
          placeholderTextColor="#888"
          value={truckYear}
          onChangeText={setTruckYear}
          keyboardType="number-pad"
          editable={!loggedIn}
        />
      </View>

      {/* License */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>License</Text>

        <Text style={accountStyles.fieldLabel}>License Number</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter license number"
          placeholderTextColor="#888"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          editable={!loggedIn}
        />

        <Text style={accountStyles.fieldLabel}>State</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter state"
          placeholderTextColor="#888"
          value={licenseState}
          onChangeText={setLicenseState}
          autoCapitalize="characters"
          editable={!loggedIn}
        />

        <Text style={accountStyles.fieldLabel}>Date of Birth</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="MM/DD/YYYY"
          placeholderTextColor="#888"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          editable={!loggedIn}
        />
      </View>

      {/* Insurance */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Insurance</Text>

        <Text style={accountStyles.fieldLabel}>Policy Number</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter policy number"
          placeholderTextColor="#888"
          value={policyNumber}
          onChangeText={setPolicyNumber}
          editable={!loggedIn}
        />

        <Text style={accountStyles.fieldLabel}>Insurance Company</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter insurance company"
          placeholderTextColor="#888"
          value={insuranceCompany}
          onChangeText={setInsuranceCompany}
          editable={!loggedIn}
        />
      </View>

      {/* Bank Account */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Bank Account</Text>

        <Text style={accountStyles.fieldLabel}>Routing Number</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter routing number"
          placeholderTextColor="#888"
          value={routingNumber}
          onChangeText={setRoutingNumber}
          keyboardType="number-pad"
          secureTextEntry={loggedIn}
          editable={!loggedIn}
        />

        <Text style={accountStyles.fieldLabel}>Account Number</Text>
        <TextInput
          style={accountStyles.input}
          placeholder="Enter account number"
          placeholderTextColor="#888"
          value={accountNumber}
          onChangeText={setAccountNumber}
          keyboardType="number-pad"
          secureTextEntry={loggedIn}
          editable={!loggedIn}
        />
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