import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Tap } from './Tap';
import { colors, fonts, ui } from '../theme';

import { fetchJson } from '../data/airQuality';
import { localDay } from '../date';
import { distanceKm, type Category, type ErHospital, type Place, type Shelter } from '../../supabase/functions/lookup/places';

// lat/lon: the rounded point the lookup ran for.
// source is missing on copies saved before the Photon fallback; those came from Overpass.
// er_hospitals: the county's hospitals with an emergency room (CMS); null when that lookup failed, missing on older copies.
export type PlacesResult = { lat: number; lon: number; places: Place[]; source?: 'overpass' | 'photon'; shelters: Shelter[] | null; er_hospitals?: ErHospital[] | null; fetched_at: string; stale?: boolean };

// The county's ER hospitals, the ones in the place's own town first ("Tracy, California" -> TRACY).
export function erByTown(r: PlacesResult | null | undefined, label: string | undefined): ErHospital[] {
  const town = label?.split(',')[0].trim().toUpperCase();
  const list = r?.er_hospitals ?? [];
  return [...list.filter((h) => h.city === town), ...list.filter((h) => h.city !== town)];
}

const CATEGORY_LABELS: Record<Category, string> = {
  hospital: 'Hospital',
  fire_station: 'Fire station',
  police: 'Police',
  pharmacy: 'Pharmacy',
  food_bank: 'Food bank',
};

// Their own numbers are office lines, not emergency dispatch.
const EMERGENCY: Category[] = ['hospital', 'fire_station', 'police'];

// Visited and confirmed to load on this date.
export const LINKS_CHECKED = '2026-11-14';
const LINKS = {
  twoOneOne: 'https://www.211.org/',
  evacuation: 'https://www.ready.gov/evacuation',
  redCrossShelters: 'https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html',
};

// tel: links need digits only; the number is shown as OpenStreetMap has it.
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
const directions = (lat: number, lon: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

// Uncached Overpass takes 25-34 s; the function gives it 35 s, then falls back to Photon.
async function fetchOnce(lat: number, lon: number): Promise<PlacesResult> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return fetchJson(`${url}/functions/v1/lookup?kind=places&lat=${lat}&lon=${lon}`, 60_000, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
}

// Now and Nearby help both ask for the same point (Now stays mounted under Help). Two lookups of one uncached cell at once
// get rate limited upstream and the function answers 502 in ~4 s, so they share one request.
const inFlight = new Map<string, Promise<PlacesResult>>();
export function fetchNearby(lat: number, lon: number): Promise<PlacesResult> {
  const k = `${lat},${lon}`;
  let p = inFlight.get(k);
  if (!p) {
    // A 5xx is usually that rate limit and clears in seconds: one retry, never more (no polling). Offline errors don't retry.
    p = fetchOnce(lat, lon)
      .catch((e: Error) => (/HTTP 5\d\d/.test(e.message) ? new Promise((r) => setTimeout(r, 3000)).then(() => fetchOnce(lat, lon)) : Promise.reject(e)))
      .finally(() => inFlight.delete(k));
    inFlight.set(k, p);
  }
  return p;
}

type Props = {
  lat: number;
  lon: number;
  inUs: boolean;
  county: string | null;
  // The place's label, to list ER hospitals in the same town first.
  label?: string;
  // The last saved result (T4's storage) to show offline, and a callback to save a fresh one.
  saved?: PlacesResult | null;
  onResult?: (r: PlacesResult) => void;
};

// Loads on its own so the rest of the plan never waits for Overpass. One lookup per location.
export function NearbyHelp({ lat, lon, inUs, county, label, saved, onResult }: Props) {
  const [fresh, setFresh] = useState<PlacesResult | null>(null);
  // Read every render: T4 loads `saved` from storage asynchronously, so it often arrives after mount.
  // Storage keeps one places copy, so it may be from another location; over ~1 km away it isn't "nearby" help.
  const savedHere = saved && distanceKm(saved.lat, saved.lon, lat, lon) <= 1 ? saved : null;
  const result = fresh ?? savedHere;
  const [state, setState] = useState<'loading' | 'done' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

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
  }, [lat, lon, attempt]);

  const countyText = county ? `${county} emergency services` : 'your county emergency services';

  const cats = Object.keys(CATEGORY_LABELS) as Category[];
  const byCat = (c: Category) => {
    const list = result?.places.filter((p) => p.category === c) ?? [];
    // OSM tags clinics as hospitals too; ones matched to the official ER list (phone_source 'cms') go first, each group by distance.
    return c === 'hospital' ? [...list.filter((p) => p.phone_source === 'cms'), ...list.filter((p) => p.phone_source !== 'cms')] : list;
  };
  const empty = result ? cats.filter((c) => !byCat(c).length) : [];

  // One card per topic. Categories with nothing nearby share one card at the bottom.
  return (
    <>
      {state === 'loading' && !result ? (
        <View style={[styles.section, styles.row]}>
          <ActivityIndicator />
          <Text style={styles.text}>Finding nearby help…</Text>
        </View>
      ) : null}
      {state === 'failed' ? (
        <View style={styles.section}>
          <Text style={styles.note}>
            Couldn't load nearby places right now.{result ? ` Showing what we found on ${localDay(result.fetched_at)}.` : ''}
          </Text>
          <Tap accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)} style={styles.linkHit}>
            <Text style={styles.link}>Try again</Text>
          </Tap>
        </View>
      ) : null}

      {cats.filter((c) => byCat(c).length).map((c) => (
        <View key={c} style={styles.section}>
          <Text accessibilityRole="header" style={ui.cardTitle}>{CATEGORY_LABELS[c]}</Text>
          {EMERGENCY.includes(c) && byCat(c).some((p) => p.phone) ? (
            <Text style={styles.note}>
              In an emergency call {inUs ? '911' : 'your local emergency number'}. These are office lines.
            </Text>
          ) : null}
          {byCat(c).map((p, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.name}>
                {p.name ?? CATEGORY_LABELS[c]} · {p.distance_km} km
              </Text>
              {p.phone ? (
                <Link url={telUrl(p.phone)} label={`Call ${p.name ?? CATEGORY_LABELS[c]}, ${p.phone}`}>
                  {p.phone}
                </Link>
              ) : null}
              <Link url={directions(p.lat, p.lon)} label={`Directions to ${p.name ?? CATEGORY_LABELS[c]}`}>
                Directions
              </Link>
            </View>
          ))}
        </View>
      ))}

      {inUs ? (
        <>
          {erByTown(result, label).length ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={ui.cardTitle}>Emergency rooms in and near {county ?? 'your county'}</Text>
              <Text style={styles.note}>Main hospital lines. In an emergency call 911.</Text>
              {erByTown(result, label).slice(0, 5).map((h) => (
                <View key={h.name} style={styles.row}>
                  <Text style={styles.name}>{titleCase(h.name)}, {titleCase(h.city)}</Text>
                  <Link url={telUrl(h.phone)} label={`Call ${titleCase(h.name)}, ${h.phone}`}>{h.phone}</Link>
                </View>
              ))}
              <Text style={styles.source}>Source: CMS Hospital General Information (Medicare-certified hospitals), fetched {localDay(result!.fetched_at)}.</Text>
            </View>
          ) : null}
          <View style={styles.section}>
            <Text accessibilityRole="header" style={ui.cardTitle}>Shelters</Text>
            <Text style={styles.note}>Open during active disasters only.</Text>
            {result && !result.shelters ? <Text style={styles.note}>Couldn't reach FEMA's shelter list right now.</Text> : null}
            {result?.shelters?.map((s, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.name}>
                  {s.name ?? 'Shelter'}
                  {s.address ? `, ${s.address}` : ''} · {s.distance_km} km
                </Text>
                <Link url={directions(s.lat, s.lon)} label={`Directions to ${s.name ?? 'shelter'}`}>
                  Directions
                </Link>
              </View>
            ))}
            <Link url={LINKS.redCrossShelters}>Red Cross: find an open shelter</Link>
            {result?.shelters ? (
              <Text style={styles.source}>
                Source: FEMA open shelters, fetched {localDay(result.fetched_at)}.
                {result.stale ? ' The live source is down; these shelters may have closed since.' : ''}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={ui.cardTitle}>Cooling centers and water</Text>
            <Text style={styles.text}>
              Call or text <Text style={styles.bold}>2-1-1</Text> (United Way 211), or check {countyText}.
            </Text>
            <Link url="tel:211" label="Call 2-1-1">Call 2-1-1</Link>
            <Link url={LINKS.twoOneOne}>211.org</Link>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={ui.cardTitle}>Evacuation</Text>
            <Text style={styles.text}>Check {countyText}.</Text>
            <Link url={LINKS.evacuation}>Ready.gov: evacuation</Link>
            <Text style={styles.source}>Links checked {LINKS_CHECKED}.</Text>
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <Text style={styles.text}>Check your local emergency services.</Text>
        </View>
      )}

      {empty.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={ui.cardTitle}>Not found within 10 km</Text>
          <Text style={styles.note}>{empty.map((c) => CATEGORY_LABELS[c]).join(', ')}</Text>
        </View>
      ) : null}

      {result ? (
        <Text style={[styles.source, styles.footnote]}>
          Places and phone numbers: data © OpenStreetMap contributors, fetched {localDay(result.fetched_at)}.
          {result.places.some((p) => p.phone_source === 'cms') ? ' Hospital numbers come from the CMS hospital list where it has the hospital.' : ''}
          {result.source === 'photon' ? ' Found by name search (Photon) while the main source is down, so some places may be missing.' : ''}
          {result.stale ? ' The live source is down, so this is the last saved copy.' : ''}
        </Text>
      ) : null}
    </>
  );
}

// CMS writes names in capitals.
export const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/'S\b/g, "'s");

// A Pressable, not a pressable Text, so keyboards can reach it and the tap target is 44 px tall.
function Link({ url, label, children }: { url: string; label?: string; children: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => Linking.openURL(url)} style={styles.linkHit}>
      <Text style={styles.link}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: ui.card,
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  footnote: { paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32, flexWrap: 'wrap' },
  name: { fontFamily: fonts.body, flex: 1, fontSize: 15 },
  note: { fontFamily: fonts.body, fontSize: 14, color: colors.subtle },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: fonts.body, color: colors.primary, textDecorationLine: 'underline', fontSize: 15 },
  bold: { fontFamily: fonts.bold },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
});
