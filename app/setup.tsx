import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, type ScrollViewInstance, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Tap } from '../src/components/Tap';
import { Icon } from '../src/components/Icon';
import { Loading } from '../src/components/Loading';
import { isZip, resolveGps, resolveText, searchPlaces, type ResolvedLocation } from '../src/data/location';
import type { Household } from '../src/kit/rules';
import { colors, fonts, ui } from '../src/theme';

const DEFAULT_HOUSEHOLD: Household = {
  adults: 1, seniors: 0, children: 0, infants: 0, dogs: 0, cats: 0, medication: false, mobility: false,
};

const COUNTS: [keyof Household, string][] = [
  ['adults', 'Adults (18–64)'],
  ['seniors', 'Seniors (65+)'],
  ['children', 'Children (2–17)'],
  ['infants', 'Infants (under 2)'],
  ['dogs', 'Dogs'],
  ['cats', 'Cats'],
];

const FLAGS: [keyof Household, string][] = [
  ['medication', 'Someone takes daily medication'],
  ['mobility', 'Someone uses a mobility aid or powered medical device'],
];

export default function Setup() {
  const router = useRouter();
  const navigation = useNavigation();
  const [household, setHousehold] = useState(DEFAULT_HOUSEHOLD);
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [query, setQuery] = useState('');
  // Each error shows next to the thing that caused it: the location button, the place field, or the household.
  const [error, setError] = useState<{ at: 'gps' | 'place' | 'who'; text: string } | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const fail = (at: 'gps' | 'place' | 'who', text: string) => {
    setError({ at, text });
    // Build sits at the bottom; bring a location error back into view.
    if (at !== 'who') scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const errorAt = (at: 'gps' | 'place' | 'who') =>
    error?.at === at ? <Text accessibilityRole="alert" style={styles.error}>{error.text}</Text> : null;
  const [busy, setBusy] = useState(false);
  // After "Build my kit": a blank screen with a spinner until the plan opens.
  const [building, setBuilding] = useState(false);
  // Autocomplete list, after the W3C APG "combobox with list autocomplete" pattern: nothing is picked until the user picks it.
  const [suggestions, setSuggestions] = useState<ResolvedLocation[]>([]);
  const [active, setActive] = useState(-1);

  // One search per pause in typing (300 ms), never per keystroke; a newer query aborts the older one.
  useEffect(() => {
    const q = query.trim();
    setActive(-1);
    if (q.length < 3 || (/^\d+$/.test(q) && !isZip(q))) return setSuggestions([]);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);
    const wait = setTimeout(() => {
      searchPlaces(q, 5, ctrl.signal)
        .then((found) => !ctrl.signal.aborted && setSuggestions(found))
        // Suggestions are a convenience: Build still resolves the typed text and reports its own error.
        .catch(() => !ctrl.signal.aborted && setSuggestions([]));
    }, 300);
    return () => (clearTimeout(wait), clearTimeout(timeout), ctrl.abort());
  }, [query]);

  const pick = (place: ResolvedLocation) => {
    // Keep the exact place picked; re-resolving the text could land on a different Springfield.
    setLocation(place);
    setQuery('');
    setSuggestions([]);
    setError(null);
  };
  const open = suggestions.length > 0;
  // react-native-web passes these through to the input; RN's types do not list them.
  const comboAria = {
    'aria-autocomplete': 'list',
    'aria-controls': 'place-list',
    'aria-activedescendant': active >= 0 ? `place-opt-${active}` : undefined,
  } as object;
  const onKey = (key: string) => {
    if (!open) return;
    if (key === 'ArrowDown') setActive((i) => (i + 1) % suggestions.length);
    else if (key === 'ArrowUp') setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    else if (key === 'Escape') setSuggestions([]);
  };

  // "Edit household" comes back here: start from what was saved.
  useEffect(() => {
    AsyncStorage.multiGet(['household', 'location'])
      .then(([[, h], [, l]]) => {
        if (h) setHousehold({ ...DEFAULT_HOUSEHOLD, ...JSON.parse(h) });
        if (l) setLocation(JSON.parse(l));
      })
      .catch(() => {});
  }, []);

  const step = (key: keyof Household, by: number) =>
    setHousehold((h) => ({ ...h, [key]: Math.min(20, Math.max(0, (h[key] as number) + by)) }));

  async function useMyLocation() {
    setBusy(true);
    setError(null);
    const found = await resolveGps();
    setBusy(false);
    if (found) {
      setLocation(found);
      setQuery('');
    } else {
      fail('gps', "We couldn't get your location. Type a ZIP code or a city name instead.");
    }
  }

  async function build() {
    const { adults, seniors, children, infants } = household;
    if (adults + seniors + children + infants === 0) {
      return fail('who', 'Add at least one person to your household.');
    }
    setBusy(true);
    setError(null);
    try {
      // Typed text wins over an earlier GPS or saved location.
      const place = query.trim() ? await resolveText(query) : location;
      if (!place) {
        return fail(
          'place',
          query.trim()
            ? "We couldn't find that place. Try a ZIP code or a city name."
            : 'Enter a ZIP code or city, or use your location.',
        );
      }
      // If storage fails the plan screen has nothing to read; T4's storage.ts owns that fallback.
      await AsyncStorage.multiSet([
        ['household', JSON.stringify(household)],
        ['location', JSON.stringify(place)],
      ]).catch(() => {});
      // Deliberate exception to "never delay navigation" (DESIGN.md): a short pause so the kit reads as worked out for
      // this household. Longer the first time, shorter but still noticeable after.
      const builtBefore = await AsyncStorage.getItem('kitBuilt').catch(() => null);
      setBuilding(true);
      await new Promise((r) => setTimeout(r, builtBefore ? 1020 : 2125));
      await AsyncStorage.setItem('kitBuilt', '1').catch(() => {});
      // They opened another page from the menu during the wait: don't pull them back, and leave Setup usable.
      if (!navigation.isFocused()) return setBuilding(false);
      // replace, not push: Edit household -> Build must not stack a second plan screen.
      router.replace('/plan');
    } catch {
      fail('place', "Couldn't reach the location service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (building) return <Loading />;
  return (
    <ScrollView ref={scroll} contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
      <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.cardTitle}>Where are you?</Text>
      <Tap accessibilityRole="button" style={styles.secondary} onPress={useMyLocation} disabled={busy}>
        <Text style={styles.secondaryText}>Use my location</Text>
      </Tap>
      {errorAt('gps')}
      <TextInput
        accessibilityLabel="ZIP code or city"
        placeholder="or type a US ZIP code or a city"
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        role="combobox"
        aria-expanded={open}
        {...(Platform.OS === 'web' ? comboAria : {})}
        onKeyPress={(e) => onKey(e.nativeEvent.key)}
        onSubmitEditing={() => (open && active >= 0 ? pick(suggestions[active]) : build())}
        returnKeyType="done"
        autoCorrect={false}
      />
      {open ? (
        <View role="list" {...(Platform.OS === 'web' ? ({ role: 'listbox' } as object) : {})} nativeID="place-list" aria-label="Matching places" style={styles.list}>
          {suggestions.map((s, i) => {
            const [name, ...rest] = s.label.split(', ');
            return (
              <Tap
                key={`${s.lat},${s.lon},${i}`}
                nativeID={`place-opt-${i}`}
                role="option"
                aria-selected={i === active}
                accessibilityLabel={s.label}
                style={[styles.option, i > 0 && styles.optionRule, i === active && styles.optionActive]}
                onHoverIn={() => setActive(i)}
                onPress={() => pick(s)}
              >
                <View style={styles.optionText}>
                  <Text style={styles.optionName}>{name}</Text>
                  {rest.length ? <Text style={styles.optionPlace}>{rest.join(', ')}</Text> : null}
                </View>
              </Tap>
            );
          })}
        </View>
      ) : null}
      {errorAt('place')}
      {location && !query.trim() ? <Text style={styles.note}>Using: {location.label}</Text> : null}
      </View>

      <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.cardTitle}>Who is in your household?</Text>
      {COUNTS.map(([key, label]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Tap accessibilityRole="button" accessibilityLabel={`Fewer ${label}`} style={styles.stepper} onPress={() => step(key, -1)}>
            <Icon name="minus" color={colors.primary} weight={2.5} />
          </Tap>
          <Text accessibilityLabel={`${label}: ${household[key]}`} style={styles.value}>{household[key]}</Text>
          <Tap accessibilityRole="button" accessibilityLabel={`More ${label}`} style={styles.stepper} onPress={() => step(key, 1)}>
            <Icon name="plus" color={colors.primary} weight={2.5} />
          </Tap>
        </View>
      ))}
      {FLAGS.map(([key, label]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Switch
            accessibilityLabel={label}
            value={household[key] as boolean}
            onValueChange={(v) => setHousehold((h) => ({ ...h, [key]: v }))}
          />
        </View>
      ))}
      {errorAt('who')}
      </View>

      <Tap accessibilityRole="button" style={styles.primary} onPress={build} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Build my kit</Text>}
      </Tap>
      {/* The welcome screen left the menu; this is its way back. */}
      <Tap accessibilityRole="link" style={styles.welcome} onPress={() => router.push('/')}>
        <Text style={styles.welcomeText}>About Kestrel</Text>
      </Tap>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: fonts.body, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 12, padding: 14, fontSize: 16, color: colors.ink },
  list: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  optionRule: { borderTopWidth: 1, borderTopColor: colors.border },
  optionActive: { backgroundColor: colors.primarySoft },
  optionText: { flex: 1 },
  optionName: { fontFamily: fonts.semi, fontSize: 16, color: colors.ink },
  optionPlace: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  note: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  label: { fontFamily: fonts.body, flex: 1, fontSize: 16, color: colors.text },
  stepper: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.bold, width: 28, textAlign: 'center', fontSize: 18, color: colors.ink },
  error: { fontFamily: fonts.semi, color: colors.danger, fontSize: 15 },
  primary: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { fontFamily: fonts.bold, color: '#fff', fontSize: 18 },
  secondary: { backgroundColor: colors.primarySoft, borderRadius: 12, padding: 14, alignItems: 'center' },
  welcome: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  welcomeText: { fontFamily: fonts.semi, fontSize: 15, color: colors.primary },
  secondaryText: { fontFamily: fonts.bold, color: colors.primary, fontSize: 16 },
});
