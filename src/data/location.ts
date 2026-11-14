import * as Location from 'expo-location';

// countryCode is missing for GPS; lookup?kind=area fills it in.
export type ResolvedLocation = { lat: number; lon: number; label: string; countryCode?: string };

export const isZip = (q: string) => /^\d{5}$/.test(q.trim());

async function getJson(url: string) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Location service returned ${res.status}`);
  return res.json();
}

// Returns null when the place isn't found; throws when the service can't be reached.
export async function resolveText(query: string): Promise<ResolvedLocation | null> {
  const q = query.trim();
  if (!q) return null;
  if (isZip(q)) {
    const place = (await getJson(`https://api.zippopotam.us/us/${q}`))?.places?.[0];
    if (!place) return null;
    return {
      lat: Number(place.latitude),
      lon: Number(place.longitude),
      label: `${place['place name']}, ${place['state abbreviation']} ${q}`,
      countryCode: 'US',
    };
  }
  const hit = (
    await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`)
  )?.results?.[0];
  if (!hit) return null;
  return {
    lat: hit.latitude,
    lon: hit.longitude,
    label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '),
    countryCode: hit.country_code,
  };
}

// Returns null when permission is denied or the device can't get a fix.
export async function resolveGps(): Promise<ResolvedLocation | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;
    const { coords } = await Location.getCurrentPositionAsync();
    return { lat: coords.latitude, lon: coords.longitude, label: 'Your current location' };
  } catch {
    return null;
  }
}
