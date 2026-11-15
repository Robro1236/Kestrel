import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '../src/components/Icon';
import { Loading } from '../src/components/Loading';
import { erByTown, fetchNearby, telUrl, titleCase, type PlacesResult } from '../src/components/NearbyHelp';
import { PageHeader } from '../src/components/PageHeader';
import { Tap } from '../src/components/Tap';
import { localDay } from '../src/date';
import { EMERGENCIES, pickFromAlerts, STEPS_CHECKED } from '../src/kit/emergencies';
import { buildKit } from '../src/kit/rules';
import { load, saveResult } from '../src/storage';
import { useLocalArea } from '../src/useLocalArea';
import { colors, fonts, ui } from '../src/theme';
import { distanceKm, type Category } from '../supabase/functions/lookup/places';

const CALL: [Category, string][] = [['hospital', 'Hospital'], ['police', 'Police'], ['fire_station', 'Fire station']];

// "What's happening?": pick an emergency (or get it picked from an active NWS warning) and see what to do, what to grab, who to call.
export default function NowScreen() {
  const a = useLocalArea();
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [places, setPlaces] = useState<PlacesResult | null>(null);
  useEffect(() => {
    load<string[]>('checked').then((c) => setChecked(c ?? []));
  }, []);

  // Phone numbers: the copy saved by Nearby help if it is for this place, else one fresh lookup.
  const lat = a?.place.lat;
  const lon = a?.place.lon;
  const saved = a?.places && lat != null && lon != null && distanceKm(a.places.lat, a.places.lon, lat, lon) <= 1 ? a.places : null;
  useEffect(() => {
    if (lat == null || lon == null || saved) return;
    let live = true;
    fetchNearby(lat, lon).then(
      (r) => {
        if (live) setPlaces(r);
        saveResult('places', r);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [lat, lon, saved]);

  if (!a) return <Loading />;
  const auto = a.warnings ? pickFromAlerts(a.warnings.alerts) : null;
  const pickedId = chosen ?? auto?.emergency.id ?? null;
  const e = EMERGENCIES.find((x) => x.id === pickedId) ?? null;
  const kit = buildKit(a.household, a.area?.hazards ?? []).filter((i) => !i.tip);
  const grab = e ? e.kit.flatMap((id) => kit.filter((i) => i.id === id)) : [];
  const got = grab.filter((i) => checked.includes(i.id)).length;
  const result = saved ?? places;
  const near = result?.places ?? [];
  const calls = CALL.flatMap(([cat, label]) => {
    // places come sorted by distance; take the nearest one with a number.
    const p = near.find((x) => x.category === cat && x.phone);
    if (p) return [{ label, name: p.name ?? label, phone: p.phone!, src: p.phone_source === 'cms' ? 'CMS hospital list' : 'OpenStreetMap' }];
    // No nearby hospital with a number: an ER in the same county from the official list, same town first.
    const er = cat === 'hospital' ? erByTown(result, a?.place.label)[0] : undefined;
    return er ? [{ label, name: titleCase(er.name), phone: er.phone, src: 'CMS hospital list' }] : [];
  });

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <PageHeader title="What's happening?" place={a.place.label} />
      <View style={styles.chips}>
        {EMERGENCIES.map((x) => (
          <Tap
            key={x.id}
            accessibilityRole="button"
            accessibilityState={{ selected: x.id === pickedId }}
            onPress={() => setChosen(x.id)}
            style={[styles.chip, x.id === pickedId && styles.chipOn]}
          >
            <Text style={[styles.chipText, x.id === pickedId && styles.chipTextOn]}>{x.label}</Text>
          </Tap>
        ))}
      </View>
      {auto && pickedId === auto.emergency.id && a.warnings ? (
        <Text style={styles.why}>
          Picked for you: the National Weather Service has an active {auto.alert.event} here (checked {localDay(a.warnings.fetched_at)}).
        </Text>
      ) : !e ? (
        <Text style={styles.why}>Pick what is happening to see what to do now.</Text>
      ) : null}

      {e ? (
        <>
          <View style={ui.card}>
            <Text accessibilityRole="header" style={ui.cardTitle}>Do this now</Text>
            {e.steps.map((s, i) => (
              <View key={s} style={styles.step}>
                <Text style={styles.num}>{i + 1}</Text>
                <Text style={[styles.text, styles.grow]}>{s}</Text>
              </View>
            ))}
            <Tap accessibilityRole="link" onPress={() => Linking.openURL(e.url)} style={styles.linkHit}>
              <Text style={styles.source}>Source: Ready.gov, {e.page}, checked {STEPS_CHECKED}.</Text>
            </Tap>
          </View>

          <View style={ui.card}>
            <View style={styles.titleRow}>
              <Text accessibilityRole="header" style={ui.cardTitle}>Grab from your kit</Text>
              <Text style={styles.count}>{got} of {grab.length} packed</Text>
            </View>
            {grab.map((i) => {
              const has = checked.includes(i.id);
              return (
                <View key={i.id} style={styles.item} accessibilityLabel={`${i.label}, ${has ? 'packed' : 'not packed'}`}>
                  <View style={[styles.box, has && styles.boxOn]}>{has ? <Icon name="check" size={14} color={colors.surface} /> : null}</View>
                  <Text style={[styles.text, styles.grow]}>{i.label}</Text>
                  {has ? null : <Text style={styles.missing}>Not packed</Text>}
                </View>
              );
            })}
          </View>

          <View style={ui.card}>
            <Text accessibilityRole="header" style={ui.cardTitle}>Who to call</Text>
            {a.inUs ? (
              <Tap accessibilityRole="link" accessibilityLabel="Call 911" onPress={() => Linking.openURL('tel:911')} style={[styles.call, styles.call911]}>
                <Text style={styles.call911Text}>Call 911</Text>
                <Text style={styles.call911Sub}>Life in danger, fire, or crime</Text>
              </Tap>
            ) : (
              <Text style={styles.text}>For life-threatening danger, call your local emergency number.</Text>
            )}
            {calls.map((c) => (
              <Tap key={c.label} accessibilityRole="link" accessibilityLabel={`Call ${c.name}, ${c.phone}`} onPress={() => Linking.openURL(telUrl(c.phone))} style={styles.call}>
                <Text style={styles.callLabel}>{c.label} · {c.src}</Text>
                <Text style={styles.text}>{c.name}, <Text style={styles.phone}>{c.phone}</Text></Text>
              </Tap>
            ))}
            <Text style={styles.source}>
              {calls.length ? 'These are main office lines, not emergency dispatch.' : 'No nearby office numbers found.'}
            </Text>
            <Tap accessibilityRole="link" onPress={() => router.navigate('/help')} style={styles.linkHit}>
              <Text style={styles.link}>All nearby help</Text>
            </Tap>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  chipTextOn: { color: colors.surface },
  why: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, paddingHorizontal: 4 },
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  grow: { flex: 1 },
  step: { flexDirection: 'row', gap: 10 },
  num: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, width: 16, fontVariant: ['tabular-nums'] },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  count: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.success, borderColor: colors.success },
  missing: { fontFamily: fonts.semi, fontSize: 13, color: colors.warn },
  call: { minHeight: 44, justifyContent: 'center', gap: 2 },
  call911: { backgroundColor: colors.danger, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  call911Text: { fontFamily: fonts.bold, fontSize: 18, color: colors.surface },
  call911Sub: { fontFamily: fonts.body, fontSize: 13, color: colors.surface },
  callLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.subtle },
  phone: { fontFamily: fonts.semi, color: colors.primary, textDecorationLine: 'underline', fontVariant: ['tabular-nums'] },
  linkHit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: fonts.semi, color: colors.primary, textDecorationLine: 'underline', fontSize: 15 },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
});
