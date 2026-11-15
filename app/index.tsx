import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Tap } from '../src/components/Tap';
import { load } from '../src/storage';
import { preparedCount } from '../src/supabase';
import { colors, fonts, ui } from '../src/theme';

const POINTS: [string, string][] = [
  ['Sized to you', 'Water, food and medicine for exactly who lives with you.'],
  ['Local risks', 'FEMA hazards, live NWS warnings and EPA water records.'],
  ['Works offline', 'Saved on your device, ready when the network is down.'],
];

export default function Home() {
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  // On focus, so "View my plan" and a fresh count appear after building a kit. A null count (any failure) is hidden.
  useFocusEffect(
    useCallback(() => {
      Promise.all([load('household'), load('location')]).then(([h, l]) => setHasPlan(!!h && !!l));
      preparedCount().then(setCount);
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={[ui.screen, styles.container]}>
      <View style={styles.mark}>
        <Text style={styles.markText}>K</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Kestrel
      </Text>
      <Text style={styles.pitch}>An emergency kit sized to your household and your area.</Text>
      <View style={styles.actions}>
        <Tap accessibilityRole="button" style={styles.primary} onPress={() => router.push('/setup')}>
          <Text style={styles.primaryText}>Start</Text>
        </Tap>
        {hasPlan ? (
          <Tap accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/plan')}>
            <Text style={styles.secondaryText}>View my plan</Text>
          </Tap>
        ) : null}
      </View>
      {count != null ? (
        <Text style={styles.count}>
          {count.toLocaleString()} {count === 1 ? 'household' : 'households'} prepared
        </Text>
      ) : null}
      <View style={styles.points}>
        {POINTS.map(([title, body]) => (
          <View key={title} style={[ui.card, styles.point]}>
            <Text style={styles.pointTitle}>{title}</Text>
            <Text style={styles.pointBody}>{body}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 32 },
  mark: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(15,94,87,0.28)' },
  markText: { fontFamily: fonts.display, color: '#fff', fontSize: 32 },
  title: { fontFamily: fonts.display, fontSize: 48, color: colors.ink, letterSpacing: -1, marginTop: 6 },
  pitch: { fontFamily: fonts.body, fontSize: 17, color: colors.muted, textAlign: 'center', maxWidth: 340 },
  actions: { width: '100%', maxWidth: 340, gap: 10, marginTop: 10 },
  primary: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryText: { fontFamily: fonts.bold, color: '#fff', fontSize: 18 },
  secondary: { minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.bold, color: colors.primary, fontSize: 16 },
  count: { fontFamily: fonts.semi, fontSize: 14, fontVariant: ['tabular-nums'], color: colors.success, backgroundColor: colors.successSoft, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  points: { width: '100%', gap: 10, marginTop: 14 },
  point: { gap: 4, padding: 16 },
  pointTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  pointBody: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
});
