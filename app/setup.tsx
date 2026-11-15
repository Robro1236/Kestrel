import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, type ScrollViewInstance, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Tap } from '../src/components/Tap';
import { Icon } from '../src/components/Icon';
import { resolveGps, resolveText, type ResolvedLocation } from '../src/data/location';
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
      // replace, not push: Edit household -> Build must not stack a second plan screen.
      router.replace('/plan');
    } catch {
      fail('place', "Couldn't reach the location service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

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
        onSubmitEditing={build}
        returnKeyType="done"
        autoCorrect={false}
      />
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
