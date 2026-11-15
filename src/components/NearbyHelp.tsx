import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { fetchJson } from '../data/airQuality';
import { distanceKm, type Category, type Place, type Shelter } from '../../supabase/functions/lookup/places';

// lat/lon: the rounded point the lookup ran for.
export type PlacesResult = { lat: number; lon: number; places: Place[]; shelters: Shelter[]; fetched_at: string; stale?: boolean };

const CATEGORY_LABELS: Record<Category, string> = {
  hospital: 'Hospital',
  fire_station: 'Fire station',
  police: 'Police',
  pharmacy: 'Pharmacy',
  food_bank: 'Food bank',
};

// Visited and confirmed to load on this date.
export const LINKS_CHECKED = '2026-11-14';
const LINKS = {
  twoOneOne: 'https://www.211.org/',
  evacuation: 'https://www.ready.gov/evacuation',
  redCrossShelters: 'https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html',
};

const directions = (lat: number, lon: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

// Uncached Overpass takes 25-34 s and the function waits up to 45 s for it.
export async function fetchNearby(lat: number, lon: number): Promise<PlacesResult> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return fetchJson(`${url}/functions/v1/lookup?kind=places&lat=${lat}&lon=${lon}`, 60_000, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
}

type Props = {
  lat: number;
  lon: number;
  inUs: boolean;
  county: string | null;
  // The last saved result (T4's storage) to show offline, and a callback to save a fresh one.
  saved?: PlacesResult | null;
  onResult?: (r: PlacesResult) => void;
};

// Loads on its own so the rest of the plan never waits for Overpass. One lookup per location.
export function NearbyHelp({ lat, lon, inUs, county, saved, onResult }: Props) {
  const [fresh, setFresh] = useState<PlacesResult | null>(null);
  // Read every render: T4 loads `saved` from storage asynchronously, so it often arrives after mount.
  // Storage keeps one places copy, so it may be from another location; over ~1 km away it isn't "nearby" help.
  const savedHere = saved && distanceKm(saved.lat, saved.lon, lat, lon) <= 1 ? saved : null;
  const result = fresh ?? savedHere;
  const [state, setState] = useState<'loading' | 'done' | 'failed'>('loading');

  useEffect(() => {
    let live = true;
    setState('loading');
    setFresh(null); // don't show the previous location's places while the new ones load
    fetchNearby(lat, lon)
      .then((r) => {
        if (!live) return;
        setFresh(r);
        setState('done');
        onResult?.(r);
      })
      .catch(() => live && setState('failed'));
    return () => {
      live = false;
    };
    // onResult is left out on purpose: a new callback each render must not refetch.
  }, [lat, lon]);

  const countyText = county ? `${county} emergency services` : 'your county emergency services';

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Nearby help</Text>

      {state === 'loading' && !result ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text>Finding nearby help…</Text>
        </View>
      ) : null}
      {state === 'failed' ? (
        <Text style={styles.note}>
          Couldn't load nearby places right now.{result ? ` Showing what we found on ${result.fetched_at.slice(0, 10)}.` : ''}
        </Text>
      ) : null}

      {result ? (
        <>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => {
            const list = result.places.filter((p) => p.category === c);
            return (
              <View key={c} style={styles.group}>
                <Text style={styles.subheading}>{CATEGORY_LABELS[c]}</Text>
                {list.length === 0 ? <Text style={styles.note}>None found within 10 km.</Text> : null}
                {list.map((p, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.name}>
                      {p.name ?? CATEGORY_LABELS[c]} · {p.distance_km} km
                    </Text>
                    <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL(directions(p.lat, p.lon))}>
                      Directions
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
          <Text style={styles.source}>
            Data © OpenStreetMap contributors, fetched {result.fetched_at.slice(0, 10)}.
            {result.stale ? ' The live source is down, so this is the last saved copy.' : ''}
          </Text>
        </>
      ) : null}

      {inUs ? (
        <>
          <View style={styles.group}>
            <Text style={styles.subheading}>Shelters</Text>
            <Text style={styles.note}>Open during active disasters only.</Text>
            {result?.shelters.map((s, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.name}>
                  {s.name ?? 'Shelter'}
                  {s.address ? `, ${s.address}` : ''} · {s.distance_km} km
                </Text>
                <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL(directions(s.lat, s.lon))}>
                  Directions
                </Text>
              </View>
            ))}
            {result ? (
              <Text style={styles.source}>
                Source: FEMA open shelters, fetched {result.fetched_at.slice(0, 10)}.
                {result.stale ? ' The live source is down; these shelters may have closed since.' : ''}
              </Text>
            ) : null}
            <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL(LINKS.redCrossShelters)}>
              Red Cross: find an open shelter
            </Text>
          </View>

          <View style={styles.group}>
            <Text style={styles.subheading}>Cooling centers and water distribution</Text>
            <Text>
              Call or text <Text style={styles.bold}>2-1-1</Text> (United Way 211).{' '}
              <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL(LINKS.twoOneOne)}>211.org</Text>
            </Text>
            <Text>Check {countyText}.</Text>
          </View>

          <View style={styles.group}>
            <Text style={styles.subheading}>Evacuation</Text>
            <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL(LINKS.evacuation)}>
              Ready.gov: evacuation
            </Text>
            <Text>Check {countyText}.</Text>
          </View>
          <Text style={styles.source}>Links checked {LINKS_CHECKED}.</Text>
        </>
      ) : (
        <Text>Check your local emergency services.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { fontSize: 20, fontWeight: '700' },
  group: { gap: 4, marginTop: 4 },
  subheading: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32, flexWrap: 'wrap' },
  name: { flex: 1, fontSize: 15 },
  note: { fontSize: 14, color: '#555' },
  link: { color: '#0b5cad', textDecorationLine: 'underline', fontSize: 15 },
  bold: { fontWeight: '700' },
  source: { fontSize: 12, color: '#555' },
});
