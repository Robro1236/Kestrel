import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AirBanner } from '../src/components/AirBanner';
import { Hazards } from '../src/components/Hazards';
import { NearbyHelp, type PlacesResult } from '../src/components/NearbyHelp';
import { Warnings } from '../src/components/Warnings';
import { WaterSafety } from '../src/components/WaterSafety';
import type { ResolvedLocation } from '../src/data/location';
import { activeOnly, fetchWarnings, type Warnings as WarningsData } from '../src/data/nws';
import { buildKit, type Hazard, type Household, type KitItem, waterGallons } from '../src/kit/rules';
import { load, loadResult, recordPlanOnce, save, saveResult, type Saved } from '../src/storage';
import { lookup, recordPlan } from '../src/supabase';

// Response of lookup?kind=area (see docs/SPEC.md).
export type Area = {
  country_code: string | null;
  in_us: boolean;
  county?: string;
  state?: string;
  county_fips?: string;
  hazards: Hazard[];
  fetched_at: string;
  stale: boolean;
};

const day = (iso: string) => new Date(iso).toLocaleDateString();

export default function Plan() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [place, setPlace] = useState<ResolvedLocation | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [area, setArea] = useState<Saved<Area> | null>(null);
  const [areaFailed, setAreaFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Saved<WarningsData> | null>(null);
  const [warningsFailed, setWarningsFailed] = useState(false);
  const [places, setPlaces] = useState<PlacesResult | null>(null);

  // Render from what's saved first, then refresh the area in the background.
  useEffect(() => {
    let live = true;
    (async () => {
      const [h, l, c, a, w, p] = await Promise.all([
        load<Household>('household'),
        load<ResolvedLocation>('location'),
        load<string[]>('checked'),
        loadResult<Area>('area'),
        loadResult<WarningsData>('warnings'),
        loadResult<PlacesResult>('places'),
      ]);
      if (!live) return;
      if (!h || !l) return router.replace('/setup');
      setHousehold(h);
      setPlace(l);
      setChecked(c ?? []);
      setArea(a);
      // Storage keeps one warnings copy; only show it for the same point.
      if (w && w.data.lat === l.lat && w.data.lon === l.lon) setWarnings(w);
      // NWS only covers the US; skip the call when we already know the place is elsewhere.
      if ((l.countryCode ?? 'US') === 'US') {
        fetchWarnings(l.lat, l.lon).then(
          async (fresh) => {
            await saveResult('warnings', fresh);
            if (live) setWarnings({ data: fresh, savedAt: new Date().toISOString() });
          },
          () => live && setWarningsFailed(true),
        );
      }
      setPlaces(p?.data ?? null);
      // First kit on this device adds one counter row; never awaited, so the plan doesn't wait on it.
      recordPlanOnce(recordPlan);
      try {
        const fresh = await lookup<Area>('area', l.lat, l.lon);
        await saveResult('area', fresh);
        if (live) setArea({ data: fresh, savedAt: new Date().toISOString() });
      } catch {
        if (live) setAreaFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [router]);

  const hazards = useMemo(() => area?.data.hazards ?? [], [area]);
  const all = useMemo(() => (household ? buildKit(household, hazards) : []), [household, hazards]);
  const kit = all.filter((i) => !i.tip);
  const tips = all.filter((i) => i.tip);
  // Checkmarks are kept by id; items the household no longer needs just don't count.
  const done = kit.filter((i) => checked.includes(i.id)).length;

  const toggle = (id: string) =>
    setChecked((c) => {
      const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      save('checked', next);
      return next;
    });

  if (!household || !place) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Until the area lookup answers, trust the saved country (ZIPs are US); GPS has none, so try NWS.
  const inUs = area ? area.data.in_us : (place.countryCode ?? 'US') === 'US';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Your emergency plan</Text>
      <Text style={styles.note}>{place.label}</Text>
      <Pressable accessibilityRole="link" onPress={() => router.replace('/setup')}>
        <Text style={styles.link}>Edit household</Text>
      </Pressable>

      <Warnings lat={place.lat} lon={place.lon} inUs={inUs} warnings={warnings} failed={warningsFailed} />
      <AirBanner lat={place.lat} lon={place.lon} />

      <Text accessibilityRole="header" style={styles.heading}>Supply kit</Text>
      <Text style={styles.note}>
        {done} of {kit.length} ready
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Kit progress"
        accessibilityValue={{ min: 0, max: kit.length, now: done }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${kit.length ? (done / kit.length) * 100 : 0}%` }]} />
      </View>
      {kit.map((item) => {
        const on = checked.includes(item.id);
        return (
          <Info key={item.id} item={item} open={open} setOpen={setOpen}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={item.qty ? `${item.label}, ${item.qty}` : item.label}
            onPress={() => toggle(item.id)}
            style={styles.item}
          >
            <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
            <View style={styles.itemText}>
              <Text style={[styles.label, on && styles.labelOn]}>
                {item.label}
                {item.qty ? <Text style={styles.qty}>  {item.qty}</Text> : null}
              </Text>
              <Text style={styles.reason}>
                {item.reason} <Text style={styles.source}>Source: {item.source}</Text>
              </Text>
            </View>
          </Pressable>
          </Info>
        );
      })}
      <Text style={styles.source}>
        {area
          ? `Sized for your area's hazards: FEMA National Risk Index, ${areaFailed ? 'saved' : 'fetched'} ${day(area.data.fetched_at)}.`
          : areaFailed
            ? "Couldn't load your area's hazards, so this is the basic kit."
            : "Checking your area's hazards…"}
      </Text>

      {tips.length ? (
        <>
          <Text accessibilityRole="header" style={styles.heading}>Extra advice</Text>
          {tips.map((item) => (
            <Info key={item.id} item={item} open={open} setOpen={setOpen}>
              <View style={styles.itemText}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.reason}>
                  {item.reason} <Text style={styles.source}>Source: {item.source}</Text>
                </Text>
              </View>
            </Info>
          ))}
        </>
      ) : null}

      <WaterSafety
        lat={place.lat}
        lon={place.lon}
        gallons={waterGallons(household, hazards)}
        countryCode={place.countryCode ?? area?.data.country_code ?? null}
        hazards={hazards}
        activeAlerts={activeOnly(warnings?.data.alerts ?? []).map((a) => a.event)}
      />
      <Hazards
        hazards={area ? area.data.hazards : null}
        inUs={inUs}
        county={area?.data.county}
        fetchedAt={area?.data.fetched_at}
        failed={areaFailed}
      />
      <NearbyHelp
        lat={place.lat}
        lon={place.lon}
        inUs={inUs}
        county={area?.data.county ?? null}
        saved={places}
        onResult={(r) => saveResult('places', r)}
      />
    </ScrollView>
  );
}

// A row with an optional info button that shows the item's longer details underneath.
function Info({ item, open, setOpen, children }: {
  item: KitItem;
  open: string | null;
  setOpen: (id: string | null) => void;
  children: ReactNode;
}) {
  const shown = open === item.id;
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.itemText}>{children}</View>
        {item.details ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More about ${item.label}`}
            aria-expanded={shown}
            onPress={() => setOpen(shown ? null : item.id)}
            style={styles.info}
          >
            <Text style={styles.infoText}>{shown ? '×' : 'i'}</Text>
          </Pressable>
        ) : null}
      </View>
      {shown ? <Text style={styles.details}>{item.details}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  info: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  infoText: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#0b5cad', color: '#0b5cad', fontWeight: '700', textAlign: 'center', lineHeight: 22 },
  details: { fontSize: 14, color: '#333', backgroundColor: '#f2f5f9', borderRadius: 8, padding: 12, marginLeft: 38 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 24, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 22, fontWeight: '700', marginTop: 12 },
  note: { fontSize: 15, color: '#333' },
  link: { color: '#0b5cad', fontSize: 16, fontWeight: '600', paddingVertical: 4 },
  track: { height: 12, borderRadius: 6, backgroundColor: '#e3e8ef', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#1a7f37' },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingVertical: 6 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  boxOn: { backgroundColor: '#1a7f37', borderColor: '#1a7f37' },
  tick: { color: '#fff', fontSize: 16, fontWeight: '700' },
  itemText: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '600' },
  labelOn: { color: '#555', textDecorationLine: 'line-through' },
  qty: { fontWeight: '700', color: '#0b5cad' },
  reason: { fontSize: 14, color: '#444' },
  source: { fontSize: 12, color: '#666' },
});
