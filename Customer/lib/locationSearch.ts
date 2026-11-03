
export type SelectedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

export type SearchResult = {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
};

const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

  console.log(
  'Mapbox token loaded:',
  !!MAPBOX_TOKEN,
  'length:',
  MAPBOX_TOKEN?.length
);

export const createSessionToken = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const searchLocations = async (
  text: string,
  sessionToken: string,
  proximity?: { latitude: number; longitude: number }
): Promise<SearchResult[]> => {
  const searchText = text.trim();

  if (searchText.length < 2) {
    return [];
  }

  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox access token is missing from .env.');
  }

  const params = new URLSearchParams({
    q: searchText,
    session_token: sessionToken,
    ...(proximity && {proximity: `${proximity.longitude},${proximity.latitude}`,}),
    access_token: MAPBOX_TOKEN,
  });

  const url =
    `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`;

  const response = await fetch(url);

if (!response.ok) {
  const details = await response.text();
  console.warn('Mapbox suggest response:', details);
  throw new Error(`Mapbox request failed (${response.status}).`);
}

  const data = await response.json();

  return data.suggestions ?? [];
};

export const retrieveLocation = async (
  item: SearchResult,
  sessionToken: string
): Promise<SelectedLocation> => {
  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox access token is missing from .env.');
  }

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    session_token: sessionToken,
  });

  const url =
    `https://api.mapbox.com/search/searchbox/v1/retrieve/` +
    `${encodeURIComponent(item.mapbox_id)}?${params}`;

  const response = await fetch(url);

if (!response.ok) {
  const details = await response.text();
  console.warn('Mapbox retrieve response:', details);
  throw new Error(`Mapbox request failed (${response.status}).`);
}

  const data = await response.json();
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error('This search result has no coordinates.');
  }

  const [longitude, latitude] = coordinates;
  const properties = feature.properties ?? {};

  return {
    address:
      properties.full_address ??
      item.full_address ??
      item.name,
    latitude,
    longitude,
  };
};
