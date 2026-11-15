import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Loading } from '../src/components/Loading';
import { PageHeader } from '../src/components/PageHeader';
import { Tap } from '../src/components/Tap';
import { type Declaration, declarationPage, fetchDeclarations } from '../src/data/fema';
import { localDay } from '../src/date';
import { popIn, spring } from '../src/motion';
import { useLocalArea } from '../src/useLocalArea';
import { colors, fonts, ui } from '../src/theme';

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
      <ScrollView contentContainerStyle={styles.grow}>
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
              {list.map((d, i) => {
                const left = i % 2 === 0;
                const align = left ? styles.right : null;
                const on = d.id === active;
                return (
                  // Left entries flip the row so the branch always sits next to the dot.
                  <View key={d.id} style={[styles.row, left && styles.flip, on && styles.raised]}>
                    {/* The blank side: flipped the other way, so its branch also touches the dot. */}
                    <View style={[styles.side, !left && styles.flip]}>{on ? <Details d={d} fromLeft={left} up={i > 1 && i >= list.length - 2} onExpand={() => setFull(d)} /> : null}</View>
                    <Tap
                      accessibilityRole="button"
                      accessibilityLabel={`Details: ${d.type}, ${d.date}`}
                      accessibilityState={{ expanded: on }}
                      hitSlop={16}
                      onPress={() => setActive(on ? null : d.id)}
                      style={[styles.dot, on && styles.dotOn]}
                    />
                    <View style={[styles.side, left && styles.flip]}>
                      <View style={[styles.branch, on && styles.on]} />
                      {/* The text opens the same card as the dot; the dot stays the one control screen readers hear. */}
                      <Tap accessible={false} focusable={false} onPress={() => setActive(on ? null : d.id)} style={styles.entry}>
                        <Text style={[styles.date, align]}>{d.date}</Text>
                        <Text style={[styles.type, align, on && styles.typeOn]}>{d.type}</Text>
                        {d.name ? <Text style={[styles.name, align]}>{d.name}</Text> : null}
                      </Tap>
                    </View>
                  </View>
                );
              })}
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

// The details card. Floats over the events below instead of pushing them down, and grows out of the dot like the menu sheet does.
// up: the last events open upward, so the card never hangs past the end of the page (not the first two: no room above).
function Details({ d, fromLeft, up, onExpand }: { d: Declaration; fromLeft: boolean; up: boolean; onExpand: () => void }) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    spring(shown, 1, { pop: true });
  }, [shown]);
  return (
    <>
      <View style={[styles.branch, styles.on]} />
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
  return (
    <Animated.View accessibilityViewIsModal style={[styles.full, popIn(shown, 8)]}>
      <ScrollView contentContainerStyle={[ui.screen, styles.fullBody]}>
        <View style={styles.fullHead}>
          <Text style={ui.eyebrow}>{d.date}</Text>
          <Text accessibilityRole="header" style={ui.pageTitle}>{d.type}</Text>
          {d.name ? <Text style={styles.summary}>{d.name}</Text> : null}
        </View>
        <Facts d={d} />
      </ScrollView>
      <Tap accessibilityRole="button" accessibilityLabel="Exit full screen" onPress={onClose} style={[styles.corner, styles.exit]}>
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
  raised: { zIndex: 1 },
  fill: { flex: 1 },
  // The tap-to-close area reaches the bottom of the screen even when the page is short.
  grow: { flexGrow: 1 },
  // Covers the page below the app header, so it stays inside the safe area the layout already gives.
  full: { ...StyleSheet.absoluteFill, zIndex: 2, backgroundColor: colors.bg },
  fullBody: { gap: 16, paddingTop: 24 },
  fullHead: { gap: 4, paddingRight: 48 },
  // 44px touch target in the card's top right; the card's first line leaves room for it.
  corner: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  exit: { top: 12, right: 12 },
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
  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  on: { backgroundColor: colors.primary },
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
