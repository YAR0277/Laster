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
import { useDriver } from '../data/driver';

export default function DriverAccountScreen() {
  const { driver, setDriver } = useDriver();

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  const hasAccount = driver !== null;

  useEffect(() => {
    if (driver) {
      setPhone(driver.phone);
      setEmail(driver.email);
      setMake(driver.make);
      setModel(driver.model);
      setYear(driver.year);
      setLicenseNumber(driver.licenseNumber);
      setLicenseState(driver.licenseState);
      setDateOfBirth(driver.dateOfBirth);
      setInsurancePolicy(driver.insurancePolicy);
      setInsuranceCompany(driver.insuranceCompany);
      setBankAccount(driver.bankAccount);
    } else {
      setPhone('');
      setEmail('');
      setMake('');
      setModel('');
      setYear('');
      setLicenseNumber('');
      setLicenseState('');
      setDateOfBirth('');
      setInsurancePolicy('');
      setInsuranceCompany('');
      setBankAccount('');
    }
  }, [driver]);

  const openAccount = () => {
    if (!phone) {
      Alert.alert(
        'Missing Information',
        'Please enter your phone number.'
      );
      return;
    }

    const newDriver = {
      driverID: 'D0001',
      phone,
      email,
      make,
      model,
      year,
      licenseNumber,
      licenseState,
      dateOfBirth,
      insurancePolicy,
      insuranceCompany,
      bankAccount,
      rating: null,
    };

    setDriver(newDriver);

    Alert.alert(
      'Account Opened',
      'Your Laster driver account has been opened.'
    );
  };

  const updateAccount = () => {
    if (!phone) {
      Alert.alert(
        'Missing Information',
        'Please enter your phone number.'
      );
      return;
    }

    if (!driver) {
      return;
    }

    setDriver({
      ...driver,
      phone,
      email,
      make,
      model,
      year,
      licenseNumber,
      licenseState,
      dateOfBirth,
      insurancePolicy,
      insuranceCompany,
      bankAccount,
    });

    Alert.alert(
      'Account Updated',
      'Your Laster driver account information has been updated.'
    );
  };

  const deleteAccount = () => {
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
          onPress: () => {
            setDriver(null);
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
        <Text style={accountStyles.pageSubtitle}>
          Manage your Driver account
        </Text>
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
        />

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

      {/* Pickup Truck */}
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

      {/* License */}
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

      {/* Insurance */}
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

      {/* Bank Account */}
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

      {/* Rating */}
      <View style={accountStyles.section}>
        <Text style={accountStyles.sectionTitle}>Rating</Text>

        <Text style={accountStyles.fieldLabel}>
          {driver?.rating !== null && driver?.rating !== undefined
            ? `${driver.rating.toFixed(1)} / 5`
            : 'No rating yet.'}
        </Text>
      </View>

      {/* Actions */}
      <View style={accountStyles.actions}>
        {!hasAccount ? (
          <Pressable
            style={accountStyles.primaryButton}
            onPress={openAccount}
          >
            <Text style={accountStyles.buttonText}>
              Open Account
            </Text>
          </Pressable>
        ) : (
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