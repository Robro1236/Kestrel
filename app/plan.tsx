import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ResolvedLocation } from '../src/data/location';
import { buildKit, type Hazard, type Household } from '../src/kit/rules';
import { load, loadResult, save, saveResult, type Saved } from '../src/storage';
import { lookup } from '../src/supabase';

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

  // Render from what's saved first, then refresh the area in the background.
  useEffect(() => {
    let live = true;
    (async () => {
      const [h, l, c, a] = await Promise.all([
        load<Household>('household'),
        load<ResolvedLocation>('location'),
        load<string[]>('checked'),
        loadResult<Area>('area'),
      ]);
      if (!live) return;
      if (!h || !l) return router.replace('/setup');
      setHousehold(h);
      setPlace(l);
      setChecked(c ?? []);
      setArea(a);
      // Counter insert (recordPlanOnce in src/storage.ts) is deferred to T8; see docs/SPEC.md.
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

  const kit = useMemo(() => (household ? buildKit(household, area?.data.hazards ?? []) : []), [household, area]);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Your emergency plan</Text>
      <Text style={styles.note}>{place.label}</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push('/setup')}>
        <Text style={styles.link}>Edit household</Text>
      </Pressable>

      {/* T5 <Warnings /> goes here (only if active), then T7 <AirBanner /> (only if AQI > 100). */}

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
          <Pressable
            key={item.id}
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
        );
      })}
      <Text style={styles.source}>
        {area
          ? `Sized for your area's hazards: FEMA National Risk Index, ${areaFailed ? 'saved' : 'fetched'} ${day(area.data.fetched_at)}.`
          : areaFailed
            ? "Couldn't load your area's hazards, so this is the basic kit."
            : "Checking your area's hazards…"}
      </Text>

      {/* T5 <WaterSafety />, then T5 <Hazards />, then T7 <NearbyHelp /> go here. */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
