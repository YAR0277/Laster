
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text
} from 'react-native';

export default function App() {
  const [photo, setPhoto] = useState<string | null>(null);

  const takePhoto = async () => {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Camera permission',
        'Camera permission was not granted.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Camera Test</Text>

      <Button title="Take Photo" onPress={takePhoto} />

      {photo && (
        <Image source={{ uri: photo }} style={styles.photo} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  heading: {
    fontSize: 24,
    marginBottom: 30,
  },
  photo: {
    width: 300,
    height: 400,
    resizeMode: 'contain',
    marginTop: 25,
  },
});
