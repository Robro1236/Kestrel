import * as Location from 'expo-location';

// countryCode is missing when GPS can't name the place; lookup?kind=area fills it in.
export type ResolvedLocation = { lat: number; lon: number; label: string; countryCode?: string };

export const isZip = (q: string) => /^\d{5}$/.test(q.trim());

async function getJson(url: string, signal?: AbortSignal) {
  const res = signal ? await fetch(url, { signal }) : await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Location service returned ${res.status}`);
  return res.json();
}

// Returns null when the place isn't found; throws when the service can't be reached.
export async function resolveText(query: string): Promise<ResolvedLocation | null> {
  return (await searchPlaces(query, 1))[0] ?? null;
}

type GeoHit = { name: string; latitude: number; longitude: number; admin1?: string; country?: string; country_code?: string };

// Up to `count` matches for the autocomplete list. A ZIP has one answer; Open-Meteo prefix-matches names from 3 letters.
export async function searchPlaces(query: string, count = 5, signal?: AbortSignal): Promise<ResolvedLocation[]> {
  const q = query.trim();
  if (!q) return [];
  if (isZip(q)) {
    const place = (await getJson(`https://api.zippopotam.us/us/${q}`, signal))?.places?.[0];
    if (!place) return [];
    return [{
      lat: Number(place.latitude),
      lon: Number(place.longitude),
      label: `${place['place name']}, ${place['state abbreviation']} ${q}`,
      countryCode: 'US',
    }];
  }
  const hits: GeoHit[] =
    (await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${count}`, signal))
      ?.results ?? [];
  return hits.map((hit) => ({
    lat: hit.latitude,
    lon: hit.longitude,
    label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '),
    countryCode: hit.country_code,
  }));
}

// Returns null when permission is denied or the device can't get a fix.
export async function resolveGps(): Promise<ResolvedLocation | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;
    const { coords } = await Location.getCurrentPositionAsync();
    return { lat: coords.latitude, lon: coords.longitude, ...(await placeName(coords.latitude, coords.longitude)) };
  } catch {
    return null;
  }
}

// "Stockton, California 95202" for the place box. Unsupported on web and can fail offline; the fix is still good without it.
async function placeName(latitude: number, longitude: number): Promise<{ label: string; countryCode?: string }> {
  try {
    const [p] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const label = [p?.city ?? p?.subregion, [p?.region, p?.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (label) return { label, ...(p?.isoCountryCode ? { countryCode: p.isoCountryCode } : {}) };
  } catch (e) {
    console.warn('Reverse geocode unavailable', e);
  }
  return { label: 'Your current location' };
}
