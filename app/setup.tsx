import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { resolveGps, resolveText, type ResolvedLocation } from '../src/data/location';
import type { Household } from '../src/kit/rules';

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
  const [message, setMessage] = useState('');
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
    setMessage('');
    const found = await resolveGps();
    setBusy(false);
    if (found) {
      setLocation(found);
      setQuery('');
    } else {
      setMessage("We couldn't get your location. Type a ZIP code or a city name instead.");
    }
  }

  async function build() {
    const { adults, seniors, children, infants } = household;
    if (adults + seniors + children + infants === 0) {
      return setMessage('Add at least one person to your household.');
    }
    setBusy(true);
    setMessage('');
    try {
      // Typed text wins over an earlier GPS or saved location.
      const place = query.trim() ? await resolveText(query) : location;
      if (!place) {
        return setMessage(
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
      setMessage("Couldn't reach the location service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.heading}>Where are you?</Text>
      <Pressable accessibilityRole="button" style={styles.secondary} onPress={useMyLocation} disabled={busy}>
        <Text style={styles.secondaryText}>Use my location</Text>
      </Pressable>
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
      {location && !query.trim() ? <Text style={styles.note}>Using: {location.label}</Text> : null}

      <Text accessibilityRole="header" style={styles.heading}>Who is in your household?</Text>
      {COUNTS.map(([key, label]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Fewer ${label}`} style={styles.stepper} onPress={() => step(key, -1)}>
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Text accessibilityLabel={`${label}: ${household[key]}`} style={styles.value}>{household[key]}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`More ${label}`} style={styles.stepper} onPress={() => step(key, 1)}>
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
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

      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
      <Pressable accessibilityRole="button" style={styles.primary} onPress={build} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Build my kit</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, fontSize: 16 },
  note: { fontSize: 14, color: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  label: { flex: 1, fontSize: 16 },
  stepper: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#888', alignItems: 'center', justifyContent: 'center' },
  stepperText: { fontSize: 22 },
  value: { width: 28, textAlign: 'center', fontSize: 18, fontWeight: '600' },
  error: { color: '#b00020', fontSize: 15 },
  primary: { backgroundColor: '#0b5cad', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: '#0b5cad', borderRadius: 8, padding: 12, alignItems: 'center' },
  secondaryText: { color: '#0b5cad', fontSize: 16, fontWeight: '600' },
});
