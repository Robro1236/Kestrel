import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { onHeaderScroll } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Loading } from '../src/components/Loading';
import { PageHeader } from '../src/components/PageHeader';
import { Tap } from '../src/components/Tap';
import { type Declaration, declarationPage, fetchDeclarations } from '../src/data/fema';
import { localDay } from '../src/date';
import { popIn, spring } from '../src/motion';
import { useLocalArea } from '../src/useLocalArea';
import { colors, fonts, headerPad, ui } from '../src/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Past federal disaster declarations for the saved county, newest first: real history, not a forecast.
export default function HistoryScreen() {
  const a = useLocalArea();
  const fips = a?.area?.county_fips;
  const [list, setList] = useState<Declaration[] | 'failed' | null>(null);
  // The event whose dot was tapped: it is highlighted and its details open in the blank space opposite.
  const [active, setActive] = useState<number | null>(null);
  // The event whose details are open full screen, over the whole page.
  const [full, setFull] = useState<Declaration | null>(null);
  useEffect(() => {
    if (!fips) return;
    let live = true;
    setList(null);
    fetchDeclarations(fips).then(
      (d) => live && setList(d),
      () => live && setList('failed'),
    );
    return () => {
      live = false;
    };
  }, [fips]);

  if (!a) return <Loading />;
  const county = a.area?.county ?? 'Your county';
  const message = !a.inUs
    ? 'Disaster history is only available for US counties.'
    : !fips
      ? a.areaFailed ? "Couldn't load your county. Check your connection and try again." : 'Checking your county…'
      : list === 'failed'
        ? "Couldn't load FEMA's disaster history right now. Check your connection and try again."
        : !list
          ? 'Loading disaster history…'
          : !list.length
            ? `FEMA has no federal disaster declarations on record for ${county}.`
            : null;

  return (
    <View style={styles.fill}>
      <ScrollView onScroll={onHeaderScroll} scrollEventThrottle={16} contentContainerStyle={styles.grow}>
        {/* A tap anywhere that isn't a control or the open card closes the card. Not a screen-reader stop: the dot toggles it too. */}
        <Pressable accessible={false} focusable={false} disabled={active === null} onPress={() => setActive(null)} style={[ui.screen, styles.grow]}>
        <PageHeader title="Disaster history" place={a.place.label} />
        {message || !Array.isArray(list) ? (
          <Text style={[styles.muted, styles.pad]}>{message}</Text>
        ) : (
          <>
            <Text style={[styles.summary, styles.pad]}>
              {county} has had <Text style={styles.num}>{list.length}</Text> federal disaster
              {list.length === 1 ? '' : 's'} declared. The most recent was {list[0].date}.
            </Text>
            {/* One spine down the middle; entries alternate sides, each joined to it by a short branch. */}
            <View style={styles.timeline}>
              <View style={styles.spine} />
              {list.map((d, i) => (
                <Event
                  key={d.id}
                  d={d}
                  left={i % 2 === 0}
                  on={d.id === active}
                  up={i > 1 && i >= list.length - 2}
                  onToggle={() => setActive(d.id === active ? null : d.id)}
                  onExpand={() => setFull(d)}
                />
              ))}
            </View>
            {/* The spine stops at a cap, so the end of FEMA's records reads as the end, not a page that failed to load more. */}
            <View style={styles.end}>
              <View style={styles.cap} />
              <Text style={styles.endText}>The data ends here</Text>
            </View>
            <Text style={[styles.source, styles.pad]}>Source: OpenFEMA disaster declarations, checked {localDay(new Date().toISOString())}</Text>
          </>
        )}
        </Pressable>
      </ScrollView>
      {full ? <FullDetails d={full} onClose={() => setFull(null)} /> : null}
    </View>
  );
}

// One event on the timeline. Selecting it springs the dot (it grows and fills) and both branches (they draw out from the dot)
// on the same pop spring as the card, so the whole row moves as one; a press dips the dot, branch and text together.
function Event({ d, left, on, up, onToggle, onExpand }: { d: Declaration; left: boolean; on: boolean; up: boolean; onToggle: () => void; onExpand: () => void }) {
  const press = useRef(new Animated.Value(1)).current;
  const sel = useRef(new Animated.Value(on ? 1 : 0)).current;
  // The card stays until the close spring settles, so it shrinks away with the dot instead of vanishing.
  const [mounted, setMounted] = useState(on);
  const onNow = useRef(on);
  useEffect(() => {
    onNow.current = on;
    if (on) setMounted(true);
    // Only a close unmounts. onDone also runs when a spring is cut short, so a close cut short by reopening checks onNow.
    spring(sel, on ? 1 : 0, { pop: true }, on ? undefined : () => onNow.current || setMounted(false));
  }, [sel, on]);
  const align = left ? styles.right : null;
  return (
    // Left entries flip the row so the branch always sits next to the dot.
    <View style={[styles.row, left && styles.flip, on ? styles.raised : mounted && styles.closing]}>
      {/* The blank side: flipped the other way, so its branch also touches the dot. */}
      <View style={[styles.side, !left && styles.flip]}>{mounted ? <Details shown={sel} d={d} fromLeft={left} up={up} onExpand={onExpand} /> : null}</View>
      <Animated.View style={{ transform: [{ scale: sel.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }}>
        <Tap
          accessibilityRole="button"
          accessibilityLabel={`Details: ${d.type}, ${d.date}`}
          accessibilityState={{ expanded: on }}
          hitSlop={16}
          onPress={onToggle}
          scale={press}
          style={styles.dot}
        >
          <Animated.View style={[styles.dotFill, { opacity: clamp01(sel), transform: [{ scale: sel.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]} />
        </Tap>
      </Animated.View>
      <View style={[styles.side, left && styles.flip]}>
        <Animated.View style={{ transform: [{ scale: press }] }}>
          <Branch v={sel} from={left ? 'right' : 'left'} />
        </Animated.View>
        {/* The text opens the same card as the dot; the dot stays the one control screen readers hear. */}
        <Tap accessible={false} focusable={false} onPress={onToggle} scale={press} style={styles.entry}>
          <Text style={[styles.date, align]}>{d.date}</Text>
          <Text style={[styles.type, align, on && styles.typeOn]}>{d.type}</Text>
          {d.name ? <Text style={[styles.name, align]}>{d.name}</Text> : null}
        </Tap>
      </View>
    </View>
  );
}

// The spring overshoots; colour and length stop at full.
const clamp01 = (v: Animated.Value) => v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

// A grey branch that fills with colour, drawn out from the dot's side (from).
function Branch({ v, from }: { v: Animated.Value; from: 'left' | 'right' }) {
  return (
    <View style={styles.branch}>
      <Animated.View style={[styles.branchFill, { transformOrigin: from, transform: [{ scaleX: clamp01(v) }] }]} />
    </View>
  );
}

// The details card. Floats over the events below instead of pushing them down, and grows out of the dot like the menu sheet does.
// up: the last events open upward, so the card never hangs past the end of the page (not the first two: no room above).
// shown: the row's selection spring, so the card opens and closes with its dot.
function Details({ shown, d, fromLeft, up, onExpand }: { shown: Animated.Value; d: Declaration; fromLeft: boolean; up: boolean; onExpand: () => void }) {
  return (
    <>
      <Branch v={shown} from={fromLeft ? 'left' : 'right'} />
      <View style={styles.anchor}>
        {/* A pressable with no action: it claims taps inside the card, so they don't count as tapping outside it. */}
        <AnimatedPressable
          accessible={false}
          focusable={false}
          style={[
            ui.card,
            styles.panel,
            up ? styles.panelUp : styles.panelDown,
            { transformOrigin: `${up ? 'bottom' : 'top'} ${fromLeft ? 'left' : 'right'}` },
            popIn(shown, up ? 8 : -8),
          ]}
        >
          <Facts d={d} />
          {/* After the facts, so it is drawn on top of the first line and gets the tap. */}
          <Tap accessibilityRole="button" accessibilityLabel="Full screen" onPress={onExpand} style={styles.corner}>
            <Icon name="expand" size={18} color={colors.muted} />
          </Tap>
        </AnimatedPressable>
      </View>
    </>
  );
}

// The same details over the whole page, with the row's date, type and name too, since the timeline is hidden behind it.
function FullDetails({ d, onClose }: { d: Declaration; onClose: () => void }) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    spring(shown, 1, { pop: true });
  }, [shown]);
  // Shrinks back the way it grew, then unmounts.
  const close = () => spring(shown, 0, { pop: true }, onClose);
  return (
    <Animated.View accessibilityViewIsModal style={[styles.full, popIn(shown, 8)]}>
      <ScrollView onScroll={onHeaderScroll} scrollEventThrottle={16} contentContainerStyle={[ui.screen, styles.fullBody]}>
        <View style={styles.fullHead}>
          <Text style={ui.eyebrow}>{d.date}</Text>
          <Text accessibilityRole="header" style={ui.pageTitle}>{d.type}</Text>
          {d.name ? <Text style={styles.summary}>{d.name}</Text> : null}
        </View>
        <Facts d={d} />
      </ScrollView>
      <Tap accessibilityRole="button" accessibilityLabel="Exit full screen" onPress={close} style={[styles.corner, styles.exit]}>
        <Icon name="close" size={22} color={colors.muted} />
      </Tap>
    </Animated.View>
  );
}

// Only what the timeline row doesn't already say: the kind of declaration, the incident period and the federal help.
function Facts({ d }: { d: Declaration }) {
  const period = !d.start ? null : !d.end ? `${d.start} onward` : d.start === d.end ? d.start : `${d.start} to ${d.end}`;
  return (
    <>
      <View style={styles.first}>
        <Text style={styles.kind}>{d.kind}</Text>
        {d.code ? <Text style={styles.detail}>{d.code}</Text> : null}
      </View>
      {period ? (
        <View>
          <Text style={styles.label}>Incident period</Text>
          <Text style={styles.detail}>{period}</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        <Text style={styles.label}>Federal help</Text>
        {d.help.length ? d.help.map((h) => <Text key={h} style={styles.detail}>{h}</Text>) : <Text style={styles.detail}>None listed</Text>}
      </View>
      <Tap accessibilityRole="link" accessibilityLabel={`Source: FEMA page for ${d.code || d.type}`} onPress={() => Linking.openURL(declarationPage(d.id))} style={styles.link}>
        <Text style={styles.linkText}>Source</Text>
      </Tap>
    </>
  );
}

const styles = StyleSheet.create({
  raised: { zIndex: 2 },
  // A card still shrinking away sits under the one just opened, so its row's text can't show through the new card.
  closing: { zIndex: 1 },
  fill: { flex: 1 },
  // The tap-to-close area reaches the bottom of the screen even when the page is short.
  grow: { flexGrow: 1 },
  // Covers the page below the app header, so it stays inside the safe area the layout already gives.
  full: { ...StyleSheet.absoluteFill, zIndex: 3, backgroundColor: colors.bg },
  fullBody: { gap: 16, paddingTop: 24 + headerPad },
  fullHead: { gap: 4, paddingRight: 48 },
  // 44px touch target in the card's top right; the card's first line leaves room for it.
  corner: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Below the floating header (headerPad), or it hides the X.
  exit: { top: 12 + headerPad, right: 12 },
  first: { paddingRight: 28 },
  panelDown: { top: -4 },
  // The anchor has no height, so these offsets are from the row's top: the card always covers the branch at 8px.
  panelUp: { bottom: -20 },
  anchor: { flex: 1 },
  panel: {
    position: 'absolute', left: 0, right: 0, padding: 12, gap: 8, borderRadius: 14,
    // Same soft lift as the menu sheet, since it floats over the timeline.
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 6px rgba(28,25,23,0.08), 0 12px 40px rgba(28,25,23,0.22)',
    elevation: 8,
  },
  list: { gap: 4 },
  kind: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.subtle, letterSpacing: 0.6, textTransform: 'uppercase' },
  detail: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, fontVariant: ['tabular-nums'] },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginVertical: -8 },
  linkText: { fontFamily: fonts.semi, fontSize: 15, color: colors.primary, textDecorationLine: 'underline' },
  summary: { fontFamily: fonts.body, fontSize: 16, color: colors.text, lineHeight: 23 },
  num: { fontFamily: fonts.bold, fontVariant: ['tabular-nums'] },
  pad: { paddingHorizontal: 4 },
  timeline: { paddingVertical: 8 },
  spine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  entry: { flex: 1, gap: 2 },
  branch: { width: 10, height: 2, marginTop: 8, backgroundColor: colors.border },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.subtle },
  // Covers the ring too (-2: the border width), so a selected dot is solid.
  dotFill: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 6, backgroundColor: colors.primary },
  branchFill: { ...StyleSheet.absoluteFill, backgroundColor: colors.primary },
  typeOn: { color: colors.primary },
  right: { textAlign: 'right' },
  flip: { flexDirection: 'row-reverse' },
  name: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.muted },
  date: { fontFamily: fonts.semi, fontSize: 14, color: colors.subtle, fontVariant: ['tabular-nums'] },
  type: { fontFamily: fonts.semi, fontSize: 18, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle, marginTop: 4 },
  end: { alignItems: 'center', gap: 6, marginTop: -14 },
  cap: { width: 24, height: 2, borderRadius: 1, backgroundColor: colors.subtle },
  endText: { fontFamily: fonts.semi, fontSize: 14, color: colors.subtle },
});
