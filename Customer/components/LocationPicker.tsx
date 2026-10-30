import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {
  Marker,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import {
  createSessionToken,
  searchLocations as fetchLocations,
  retrieveLocation,
  type SearchResult,
} from '../lib/locationSearch';

export type SelectedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

type LocationPickerProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onSelect: (location: SelectedLocation) => void;
};

const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

const DEFAULT_REGION: Region = {
  latitude: 39.0,
  longitude: -98.0,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

export default function LocationPicker({
  visible,
  title,
  onCancel,
  onSelect,
}: LocationPickerProps) {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [selected, setSelected] =
    useState<SelectedLocation | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const sessionToken = useRef('');
  const searchRequestId = useRef(0);
  const coordinateAddress = (
    latitude: number,
    longitude: number
  ) => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  const reverseGeocode = async (
    latitude: number,
    longitude: number
  ): Promise<string | null> => {
    if (!MAPBOX_TOKEN) {
      return null;
    }

    try {
      const url =
        'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
        `${longitude},${latitude}.json` +
        `?access_token=${MAPBOX_TOKEN}&limit=1`;

      const response = await fetch(url);
      if (!response.ok) return null;

      const data = await response.json();
      return data.features?.[0]?.place_name ?? null;
    } catch {
      return null;
    }
  };

  const selectCoordinates = async (
    latitude: number,
    longitude: number,
    address?: string
  ) => {
    const fallback = coordinateAddress(latitude, longitude);
    const initialAddress = address ?? fallback;

    setSelected({
      address: initialAddress,
      latitude,
      longitude,
    });
    setQuery(initialAddress);
    setResults([]);

    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    });

    if (!address) {
      const resolved = await reverseGeocode(latitude, longitude);

      if (resolved) {
        setSelected({
          address: resolved,
          latitude,
          longitude,
        });
        setQuery(resolved);
      }
    }
  };

  const locateMe = async () => {
    setLocating(true);
    setError('');

    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setError('Location permission was not granted.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({});

      await selectCoordinates(
        position.coords.latitude,
        position.coords.longitude
      );
    } catch {
      setError('Could not determine your current location.');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!visible) return;

    setSelected(null);
    setQuery('');
    setResults([]);
    setError('');
    setSearching(false);
    setLocating(false);

    sessionToken.current =
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const searchText = query.trim();

    if (searchText.length < 2) {
      ++searchRequestId.current;
      setResults([]);
      setSearching(false);
      setError('');
      return;
    }

    const timer = setTimeout(() => {
      void searchLocations(searchText);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, visible]);

  const searchLocations = async (
    text: string,
    dismissKeyboard = false
  ) => {
    const requestId = ++searchRequestId.current;

    if (dismissKeyboard) {
      Keyboard.dismiss();
    }

    setError('');
    setResults([]);

    if (text.trim().length < 2) {
      setSearching(false);
      return;
    }

    if (!sessionToken.current) {
      sessionToken.current = createSessionToken();
    }

    setSearching(true);

    try {
      const suggestions = await fetchLocations(
        text,
        sessionToken.current
      );

      if (requestId !== searchRequestId.current) return;

      setResults(suggestions);

      if (suggestions.length === 0) {
        setError('No matching locations found.');
      }
    } catch (e) {
      if (requestId === searchRequestId.current) {
        setError(
          e instanceof Error ? e.message : 'Place search failed.'
        );
      }
    } finally {
      if (requestId === searchRequestId.current) {
        setSearching(false);
      }
    }
  };

  const chooseSearchResult = async (item: SearchResult) => {
    if (!sessionToken.current) {
      sessionToken.current = createSessionToken();
    }

    setSearching(true);
    setError('');

    try {
      const location = await retrieveLocation(
        item,
        sessionToken.current
      );

      await selectCoordinates(
        location.latitude,
        location.longitude,
        location.address
      );

      sessionToken.current = createSessionToken();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not select this location.'
      );
    } finally {
      setSearching(false);
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } =
      event.nativeEvent.coordinate;

    setError('');
    void selectCoordinates(latitude, longitude);
  };

  const confirmSelection = () => {
    if (!selected) {
      Alert.alert(
        'Choose a Location',
        'Search for an address or tap the map first.'
      );
      return;
    }

    onSelect(selected);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Search an address or place"
            placeholderTextColor="#8B9099"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void searchLocations(query, true)}
            returnKeyType="search"
          />
          <Button
            title={searching ? '...' : 'Search'}
            onPress={() => void searchLocations(query, true)}
            disabled={searching}
          />
        </View>

        {searching && <ActivityIndicator />}

        {results.length > 0 && (
          <ScrollView style={styles.results}>
            {results.map((item) => (
              <TouchableOpacity
                key={item.mapbox_id}
                style={styles.result}
                onPress={() => chooseSearchResult(item)}
              >
                <Text style={styles.resultText}>
                  {item.full_address ??
                    [item.name, item.place_formatted].filter(Boolean).join(', ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.mapContainer}>
          <MapView
            style={StyleSheet.absoluteFill}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
          >
            {selected && (
              <Marker
                coordinate={{
                  latitude: selected.latitude,
                  longitude: selected.longitude,
                }}
              />
            )}
          </MapView>
        </View>

        <View style={styles.footer}>

          {selected && (
            <Text style={styles.address}>
              {selected.address}
            </Text>
          )}

          <View style={styles.actions}>
            <Button title="Cancel" onPress={onCancel} />
            <Button
              title="Use This Location"
              onPress={confirmSelection}
              disabled={!selected}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#252A32',
    paddingTop: 48,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    color: '#222222',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  results: {
    maxHeight: 180,
    marginHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  result: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CCCCCC',
  },
  resultText: {
    color: '#222222',
  },
  error: {
    color: '#FFB4AB',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapContainer: {
    flex: 1,
    marginTop: 8,
  },
  footer: {
    backgroundColor: '#303641',
    padding: 12,
    gap: 8,
  },
  address: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});