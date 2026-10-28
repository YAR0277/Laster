
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

type SearchResult = {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
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
    if (visible) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setError('');

      // Initialize a new search session whenever the picker opens.
      sessionToken.current =
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      void locateMe();
    }
  }, [visible]);

  const searchAddresses = async () => {
    Keyboard.dismiss();
    setError('');

    const searchText = query.trim();

    if (!searchText) {
      setResults([]);
      return;
    }

    if (!MAPBOX_TOKEN) {
      setError('Mapbox access token is missing from .env.');
      return;
    }

    if (!sessionToken.current) {
      sessionToken.current =
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    setSearching(true);
    setResults([]);

    try {
      const params = new URLSearchParams({
        q: searchText,
        access_token: MAPBOX_TOKEN,
        session_token: sessionToken.current,
        limit: '5',
        language: 'en',
        country: 'US',
      });

      const url =
        `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Mapbox request failed (${response.status}).`);
      }

      const data = await response.json();
      const suggestions: SearchResult[] = data.suggestions ?? [];

      setResults(suggestions);

      if (suggestions.length === 0) {
        setError('No matching locations found.');
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Place search failed.'
      );
    } finally {
      setSearching(false);
    }
  };


  const chooseSearchResult = async (item: SearchResult) => {
    if (!MAPBOX_TOKEN) {
      setError('Mapbox access token is missing from .env.');
      return;
    }

    setSearching(true);
    setError('');

    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        session_token: sessionToken.current,
      });

      const url =
        `https://api.mapbox.com/search/searchbox/v1/retrieve/` +
        `${encodeURIComponent(item.mapbox_id)}?${params}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Could not retrieve location (${response.status}).`);
      }

      const data = await response.json();
      const feature = data.features?.[0];
      const coordinates = feature?.geometry?.coordinates;

      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2
      ) {
        throw new Error('This search result has no coordinates.');
      }

      const [longitude, latitude] = coordinates;
      const properties = feature.properties ?? {};
      const address =
        properties.full_address ??
        item.full_address ??
        item.name;

      await selectCoordinates(latitude, longitude, address);

      // A new session is used for the next search.
      sessionToken.current =
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
            onSubmitEditing={() => void searchAddresses()}
            returnKeyType="search"
          />
          <Button
            title={searching ? '...' : 'Search'}
            onPress={() => void searchAddresses()}
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
          <Button
            title={locating ? 'Locating...' : 'Use My Location'}
            onPress={() => void locateMe()}
            disabled={locating}
          />

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