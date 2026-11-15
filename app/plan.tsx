import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Tap } from '../src/components/Tap';
import { AirBanner, useAirQuality } from '../src/components/AirBanner';
import { Collapse } from '../src/components/Collapse';
import { CountyHelp } from '../src/components/CountyHelp';
import { FamilyPlanLink } from '../src/components/FamilyPlanLink';
import { Icon } from '../src/components/Icon';
import { KitReminders } from '../src/components/KitReminders';
import { Warnings } from '../src/components/Warnings';
import { WaterSafety } from '../src/components/WaterSafety';
import { WaterSystem } from '../src/components/WaterSystem';
import { localDay } from '../src/date';
import { airTier } from '../src/data/airQuality';
import type { ResolvedLocation } from '../src/data/location';
import { activeOnly, fetchWarnings, type Warnings as WarningsData } from '../src/data/nws';
import { buildKit, KIT_GROUPS, type Hazard, type Household, type KitItem, waterGallons } from '../src/kit/rules';
import { load, loadResult, recordPlanOnce, save, saveResult, type Saved } from '../src/storage';
import { lookup, recordPlan } from '../src/supabase';
import { spring } from '../src/motion';
import { colors, fonts, ui } from '../src/theme';

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

export default function Plan() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [place, setPlace] = useState<ResolvedLocation | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [area, setArea] = useState<Saved<Area> | null>(null);
  const [areaFailed, setAreaFailed] = useState(false);
  // Several details can be open at once, so opening one never collapses another and shifts the page.
  const [open, setOpen] = useState<string[]>([]);
  // Cards the user folded or opened by hand; otherwise a card folds once every item in it is checked.
  const [fold, setFold] = useState<Record<string, boolean>>({});
  const [warnings, setWarnings] = useState<Saved<WarningsData> | null>(null);
  const [warningsFailed, setWarningsFailed] = useState(false);
  const air = useAirQuality(place?.lat, place?.lon);

  // Render from what's saved first, then refresh the area in the background.
  useEffect(() => {
    let live = true;
    (async () => {
      const [h, l, c, a, w] = await Promise.all([
        load<Household>('household'),
        load<ResolvedLocation>('location'),
        load<string[]>('checked'),
        loadResult<Area>('area'),
        loadResult<WarningsData>('warnings'),
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
  const pct = kit.length ? Math.round((done / kit.length) * 100) : 0;
  // The bar grows on a spring when the plan loads and on each check.
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => spring(fill, pct, { layout: true }), [fill, pct]);
  const width = fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  // Once the hero's progress bar scrolls off screen, a slim copy slides out from under the header.
  const bar = useRef({ heroY: 0, bottom: 0 }).current;
  const [pinned, setPinned] = useState(false);
  const strip = useRef(new Animated.Value(0)).current;
  useEffect(() => spring(strip, pinned ? 1 : 0), [strip, pinned]);

  const toggle = (id: string) => {
    // A check hands the card back to the auto rule, so finishing it folds it even if it was opened by hand.
    const g = kit.find((i) => i.id === id)?.group;
    if (g && g in fold) setFold(({ [g]: _, ...rest }) => rest);
    setChecked((c) => {
      const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      save('checked', next);
      return next;
    });
  };

  if (!household || !place) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Until the area lookup answers, trust the saved country (ZIPs are US); GPS has none, so try NWS.
  const inUs = area ? area.data.in_us : (place.countryCode ?? 'US') === 'US';
  // Bad air goes near the top with the warnings; normal air is a footnote card at the bottom.
  const airUrgent = !!air && !!airTier(air.aqi);
  const alerts = activeOnly(warnings?.data.alerts ?? []).map((a) => a.event);

  return (
    <View style={styles.page}>
    <ScrollView
      contentContainerStyle={ui.screen}
      scrollEventThrottle={16}
      onScroll={(e) => setPinned(e.nativeEvent.contentOffset.y > bar.heroY + bar.bottom)}
    >
      <View style={[ui.card, styles.hero]} onLayout={(e) => (bar.heroY = e.nativeEvent.layout.y)}>
        <Text style={ui.eyebrow}>{place.label}</Text>
        <Text accessibilityRole="header" style={styles.title}>Your emergency plan</Text>
        <View style={styles.progressRow}>
          <Text style={styles.note}>
            {done} of {kit.length} ready
          </Text>
          <Text style={styles.pct}>{pct}%</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Kit progress"
          accessibilityValue={{ min: 0, max: kit.length, now: done }}
          style={styles.track}
          onLayout={(e) => (bar.bottom = e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        >
          <Animated.View style={[styles.fill, { width }]} />
        </View>
        <View style={styles.chips}>
          <Tap accessibilityRole="link" onPress={() => router.replace('/setup')} style={styles.chip}>
            <Text style={styles.chipText}>Edit household</Text>
          </Tap>
          <FamilyPlanLink style={styles.chip} textStyle={styles.chipText} />
        </View>
      </View>
      <KitReminders inUs={inUs} />

      <Warnings lat={place.lat} lon={place.lon} inUs={inUs} warnings={warnings} failed={warningsFailed} />
      {airUrgent ? <AirBanner air={air} /> : null}
      {/* Only poor conditions show here, above the kit; the full cards live on their own screens. */}
      <WaterSafety
        urgentOnly
        lat={place.lat}
        lon={place.lon}
        gallons={waterGallons(household, hazards)}
        countryCode={place.countryCode ?? area?.data.country_code ?? null}
        hazards={hazards}
        activeAlerts={alerts}
      />
      <WaterSystem onlyIfPoor lat={place.lat} lon={place.lon} inUs={inUs} />
      {alerts.length ? <CountyHelp countyFips={area?.data.county_fips} /> : null}

      <View style={[styles.progressRow, styles.kitLabel]}>
        <Text accessibilityRole="header" style={ui.eyebrow}>Supply kit</Text>
        <Text style={styles.count}>{done}/{kit.length}</Text>
      </View>
      {/* One card per group, so the list reads in short sections. Checked items stay put: a tapped row never moves. */}
      {KIT_GROUPS.map((g) => {
        const items = kit.filter((i) => i.group === g);
        if (!items.length) return null;
        const got = items.filter((i) => checked.includes(i.id)).length;
        const folded = fold[g] ?? got === items.length;
        return (
          <View key={g} style={[ui.card, styles.groupCard]}>
            {/* Tapping the title folds the card down to its title and count. */}
            <Tap
              accessibilityRole="button"
              accessibilityLabel={`${g}, ${got} of ${items.length}`}
              aria-expanded={!folded}
              onPress={() => setFold({ ...fold, [g]: !folded })}
              style={[styles.progressRow, styles.groupHead]}
            >
              <Text accessibilityRole="header" style={ui.cardTitle}>{g}</Text>
              <View style={styles.groupEnd}>
                <Text style={[styles.groupCount, got === items.length && styles.groupDone]}>
                  {got} of {items.length}
                </Text>
                <Icon name={folded ? 'chevronRight' : 'chevronDown'} size={18} color={colors.muted} />
              </View>
            </Tap>
            {/* Folding by hand is instant; folding because the card is now complete waits a beat. */}
            <Collapse open={!folded} closeDelay={g in fold ? 0 : 600} style={styles.groupBody}>
            {items.map((item) => {
              const on = checked.includes(item.id);
              return (
                <Info key={item.id} item={item} open={open} setOpen={setOpen}>
                <Check on={on} label={item.qty ? `${item.label}, ${item.qty}` : item.label} onPress={() => toggle(item.id)}>
                  <View style={styles.itemText}>
                    <Text style={[styles.label, on && styles.labelOn]}>
                      {item.label}
                      {item.qty ? <Text style={styles.qty}>  {item.qty}</Text> : null}
                    </Text>
                    <Text style={styles.reason}>
                      {item.reason} <Text style={styles.source}>Source: {item.source}</Text>
                    </Text>
                  </View>
                </Check>
                </Info>
              );
            })}
            </Collapse>
          </View>
        );
      })}
      <Text style={[styles.source, styles.kitLabel]}>
        {area
          ? `Sized for your area's hazards: FEMA National Risk Index, ${areaFailed ? 'saved' : 'fetched'} ${localDay(area.data.fetched_at)}.`
          : areaFailed
            ? "Couldn't load your area's hazards, so this is the basic kit."
            : "Checking your area's hazards…"}
      </Text>

      {tips.length ? (
        <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.cardTitle}>Extra advice</Text>
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
        </View>
      ) : null}
    </ScrollView>
    {/* Display only, and a duplicate of the hero bar, so it takes no taps and is hidden from screen readers. */}
    <Animated.View
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.strip, { opacity: strip, transform: [{ translateY: strip.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }]}
    >
      <Text style={styles.note}>{done} of {kit.length} ready</Text>
      <View style={[styles.track, styles.stripTrack]}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
      <Text style={styles.pct}>{pct}%</Text>
    </Animated.View>
    </View>
  );
}

// The box dips while held and pops back on release, so even a quick tap visibly registers.
function Check({ on, label, onPress, children }: { on: boolean; label: string; onPress: () => void; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => spring(scale, 0.78)}
      onPressOut={() => spring(scale, 1, { bouncy: true })}
      style={styles.item}
    >
      <Animated.View style={[styles.box, on && styles.boxOn, { transform: [{ perspective: 1000 }, { scale }] }]}>
        {on ? <Icon name="check" size={16} color="#fff" weight={3} /> : null}
      </Animated.View>
      {children}
    </Pressable>
  );
}

// A row with an optional info button that shows the item's longer details underneath.
function Info({ item, open, setOpen, children }: {
  item: KitItem;
  open: string[];
  setOpen: (f: (ids: string[]) => string[]) => void;
  children: ReactNode;
}) {
  const shown = open.includes(item.id);
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.itemText}>{children}</View>
        {item.details ? (
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`More about ${item.label}`}
            aria-expanded={shown}
            onPress={() => setOpen((ids) => (shown ? ids.filter((x) => x !== item.id) : [...ids, item.id]))}
            style={styles.info}
          >
            <Icon name={shown ? 'closeCircle' : 'info'} size={24} color={colors.primary} weight={1.75} />
          </Tap>
        ) : null}
      </View>
      {shown ? <Text style={styles.details}>{item.details}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  info: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  details: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, backgroundColor: colors.bg, borderRadius: 10, padding: 12, marginLeft: 38, marginBottom: 6 },
  page: { flex: 1 },
  strip: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border, boxShadow: '0 8px 16px -12px rgba(28,25,23,0.25)',
  },
  stripTrack: { flex: 1, height: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { gap: 8, paddingVertical: 20 },
  title: ui.pageTitle,
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pct: { fontFamily: fonts.bold, fontSize: 15, fontVariant: ['tabular-nums'], color: colors.success },
  count: { fontFamily: fonts.bold, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  note: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.bold, color: colors.primary, fontSize: 14 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.success },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingVertical: 8 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.subtle, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.success, borderColor: colors.success },
  itemText: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.semi, fontSize: 16, color: colors.ink },
  labelOn: { color: colors.subtle, textDecorationLine: 'line-through' },
  qty: { fontFamily: fonts.bold, color: colors.primary },
  reason: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
  kitLabel: { paddingHorizontal: 4 },
  groupCount: { fontFamily: fonts.semi, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.muted },
  groupDone: { color: colors.success },
  groupHead: { minHeight: 44 },
  // The card's gap moves inside the slide, so a folded card has no empty space under its title.
  groupCard: { gap: 0 },
  groupBody: { gap: 10, paddingTop: 10 },
  groupEnd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
