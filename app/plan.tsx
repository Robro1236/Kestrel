import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';

import { Tap } from '../src/components/Tap';
import { AirBanner, useAirQuality } from '../src/components/AirBanner';
import { DONE_HOLD_MS, DoneOverlay, SPARK_LAND_MS, type Spark, SparkDot } from '../src/components/Celebrate';
import { Collapse } from '../src/components/Collapse';
import { CountyHelp } from '../src/components/CountyHelp';
import { FamilyPlanLink } from '../src/components/FamilyPlanLink';
import { headerShown, onHeaderScroll } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { KitReminders } from '../src/components/KitReminders';
import { Warnings } from '../src/components/Warnings';
import { WaterSafety } from '../src/components/WaterSafety';
import { WaterSystem } from '../src/components/WaterSystem';
import { localDay } from '../src/date';
import { airTier } from '../src/data/airQuality';
import type { ResolvedLocation } from '../src/data/location';
import { pickFromAlerts } from '../src/kit/emergencies';
import { activeOnly, fetchWarnings, type Warnings as WarningsData } from '../src/data/nws';
import { buildKit, KIT_GROUPS, type Hazard, type Household, type KitItem, waterGallons } from '../src/kit/rules';
import { load, loadResult, recordPlanOnce, save, saveResult, type Saved } from '../src/storage';
import { lookup, recordPlan } from '../src/supabase';
import { motionReduced, spring } from '../src/motion';
import { colors, fonts, headerPad, statusTop, ui } from '../src/theme';

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
  // The bar grows on a spring when the plan loads, and on a check once the sparks reach it (toggle sets flying).
  const fill = useRef(new Animated.Value(0)).current;
  const flying = useRef(false);
  useEffect(() => {
    const wait = flying.current && !motionReduced() ? SPARK_LAND_MS : 0;
    flying.current = false;
    const id = setTimeout(() => spring(fill, pct, { layout: true }), wait);
    return () => clearTimeout(id);
  }, [fill, pct]);
  const width = fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  // Once the hero's progress bar slides up behind the header, a slim copy slides out from under it.
  const bar = useRef({ heroY: 0, mid: 0 }).current;
  const [pinned, setPinned] = useState(false);
  const strip = useRef(new Animated.Value(0)).current;
  useEffect(() => spring(strip, pinned ? 1 : 0), [strip, pinned]);
  // The strip rides just under the header (web: it floats and slides away).
  // Tracks the header's bottom edge exactly (it slides headerPad tall), then rests under the status bar: no gap mid-slide.
  const under = headerShown.interpolate({ inputRange: [0, statusTop / headerPad, 1], outputRange: [statusTop, statusTop, headerPad], extrapolate: 'clamp' });

  // On each check, green sparks fly from the box into the bar. Positions are in the page's coordinates.
  const page = useRef<ViewInstance>(null);
  const track = useRef<ViewInstance>(null);
  const stripTrack = useRef<ViewInstance>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollNow = useRef(0);
  const sparkId = useRef(0);
  const [sparks, setSparks] = useState<Spark[]>([]);
  // Like game XP, the sparks hit the tip of the fill on whichever bar is showing; the bar then grows past them.
  const fly = (box: ViewInstance | null | undefined) =>
    page.current?.measureInWindow((px, py) =>
      box?.measureInWindow((bx, by, bw, bh) => track.current?.measureInWindow((tx, ty, tw, th) => (pinned ? stripTrack : track).current?.measureInWindow((ax, _ay, aw) => {
        // The hero bar's centre moves with scrolling; once it's above the strip's line, aim at the strip instead.
        const base = ty - py + th / 2 + scrollNow.current;
        const hero = scrollY.interpolate({ inputRange: [0, 1], outputRange: [base, base - 1] });
        const stripMid = Animated.add(under, STRIP_MID);
        const targetY = pinned ? stripMid : Animated.add(stripMid, Animated.subtract(hero, stripMid).interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' }));
        // shortcut: the bar is picked at launch; a scroll that pins or unpins the strip mid-flight lands on the other bar's x.
        const x = ax - px + (aw * pct) / 100;
        const born = [0, 1, 2, 3, 4].map((i) => ({
          id: ++sparkId.current, x: bx + bw / 2 - px + (i - 2) * 2, y: by + bh / 2 - py + (i % 2 ? 2 : -2), tx: x, targetY, delay: i * 70, dx: (i - 2) * 16, dy: -12 - (2 - Math.abs(i - 2)) * 8,
        }));
        setSparks((s) => [...s, ...born]);
      }))),
    );
  // Kit cards that just got their last check: greyed with a big check until they fold.
  const [celebrating, setCelebrating] = useState<string[]>([]);
  // Pending un-celebrate timers, cleared on leaving so they never update a gone screen.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]).current;
  useEffect(() => () => timers.forEach(clearTimeout), [timers]);

  const toggle = (id: string, box?: ViewInstance | null) => {
    // A check hands the card back to the auto rule, so finishing it folds it even if it was opened by hand.
    const g = kit.find((i) => i.id === id)?.group;
    if (g && g in fold) setFold(({ [g]: _, ...rest }) => rest);
    const adding = !checked.includes(id);
    if (g) {
      // Only a check that finishes the card celebrates; an uncheck mid-animation cancels it.
      const complete = adding && kit.filter((i) => i.group === g).every((i) => i.id === id || checked.includes(i.id));
      setCelebrating((c) => (complete ? [...c, g] : c.filter((x) => x !== g)));
      if (complete) timers.push(setTimeout(() => setCelebrating((c) => c.filter((x) => x !== g)), DONE_HOLD_MS + 500));
    }
    if (adding && kit.length) {
      flying.current = true;
      fly(box);
    }
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
  const now = pickFromAlerts(warnings?.data.alerts ?? []);
  const alerts = activeOnly(warnings?.data.alerts ?? []).map((a) => a.event);

  return (
    <View ref={page} style={styles.page}>
    <ScrollView
      contentContainerStyle={ui.screen}
      scrollEventThrottle={16}
      onScroll={(e) => {
        const y = e.nativeEvent.contentOffset.y;
        scrollNow.current = y;
        scrollY.setValue(y);
        // Pin once the hero bar's centre passes the strip's line (header showing): from there the header hides it.
        setPinned(y > bar.heroY + bar.mid - headerPad - STRIP_MID);
        onHeaderScroll(e);
      }}
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
          ref={track}
          style={styles.track}
          onLayout={(e) => (bar.mid = e.nativeEvent.layout.y + e.nativeEvent.layout.height / 2)}
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
      {/* During an emergency: what to do now, sized to the active warning if there is one. */}
      <Tap accessibilityRole="link" onPress={() => router.navigate('/now')} style={[ui.card, styles.nowCard]}>
        <View style={styles.grow}>
          <Text style={styles.nowTitle}>{now ? `${now.alert.event}: what to do now` : 'Something happening now?'}</Text>
          <Text style={styles.note}>Steps, what to grab from your kit, and who to call.</Text>
        </View>
        <Icon name="chevronRight" size={20} color={colors.primary} />
      </Tap>
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
            <Collapse open={!folded} closeDelay={g in fold ? 0 : DONE_HOLD_MS} style={styles.groupBody}>
            {items.map((item) => {
              const on = checked.includes(item.id);
              return (
                <Info key={item.id} item={item} open={open} setOpen={setOpen}>
                <Check on={on} label={item.qty ? `${item.label}, ${item.qty}` : item.label} onPress={(box) => toggle(item.id, box)}>
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
            {celebrating.includes(g) ? <DoneOverlay /> : null}
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
      style={[styles.strip, { opacity: strip, transform: [{ translateY: Animated.add(under, strip.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] })) }] }]}
    >
      <Text style={styles.note}>{done} of {kit.length} ready</Text>
      <View ref={stripTrack} style={[styles.track, styles.stripTrack]}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
      <Text style={styles.pct}>{pct}%</Text>
    </Animated.View>
    {sparks.map((s) => <SparkDot key={s.id} spark={s} onDone={(id) => setSparks((all) => all.filter((x) => x.id !== id))} />)}
    </View>
  );
}

// The box dips while held and pops back on release, so even a quick tap visibly registers.
function Check({ on, label, onPress, children }: { on: boolean; label: string; onPress: (box: ViewInstance | null) => void; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const box = useRef<ViewInstance>(null); // the sparks start from here

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onPress(box.current)}
      onPressIn={() => spring(scale, 0.78)}
      onPressOut={() => spring(scale, 1, { bouncy: true })}
      style={styles.item}
    >
      <Animated.View ref={box} style={[styles.box, on && styles.boxOn, { transform: [{ perspective: 1000 }, { scale }] }]}>
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

// The strip track's centre below the strip's top edge: its paddingVertical plus half a line of text.
const STRIP_MID = 21;
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
  nowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  nowTitle: { fontFamily: fonts.semi, fontSize: 17, color: colors.ink },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primarySoft },
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
