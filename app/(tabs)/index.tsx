import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { styles } from '../../components/styles';


export default function RenterScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fare, setFare] = useState<number | null>(null);
  const [status, setStatus] = useState('Not submitted');

  const requestTrip = () => {
    // Temporary fare calculation
    const randomFare = Math.floor(Math.random() * 76) + 25;

    setFare(randomFare);
    setStatus('Requested');
  };

  const abortTrip = () => {
    setStatus('Aborted');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TruckTaxi</Text>
      <Text style={styles.subtitle}>Please enter trip details</Text>

      <View style={styles.card}>

        <Text style={styles.label}>From</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter starting address"
          placeholderTextColor="#888"
          value={from}
          onChangeText={setFrom}
        />

        <Text style={styles.label}>To</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter destination address"
          placeholderTextColor="#888"
          value={to}
          onChangeText={setTo}
        />

        <Text style={styles.label}>Fare</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>
            {fare !== null ? `$${fare.toFixed(2)}` : 'Calculated by App'}
          </Text>
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{status}</Text>
        </View>

        {status === 'Not submitted' && (
          <Pressable style={styles.button} onPress={requestTrip}>
            <Text style={styles.buttonText}>Request Trip</Text>
          </Pressable>
        )}

        {status === 'Requested' && (
          <Pressable style={styles.abortButton} onPress={abortTrip}>
            <Text style={styles.buttonText}>Abort Trip</Text>
          </Pressable>
        )}

      </View>
    </View>
  );
}
