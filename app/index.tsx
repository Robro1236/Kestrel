import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { load } from '../src/storage';

export default function Home() {
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState(false);

  // On focus, so "View my plan" appears after building a kit.
  // The "Households prepared" counter is deferred to T8 (see docs/SPEC.md).
  useFocusEffect(
    useCallback(() => {
      Promise.all([load('household'), load('location')]).then(([h, l]) => setHasPlan(!!h && !!l));
    }, []),
  );

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Kestrel
      </Text>
      <Text style={styles.pitch}>An emergency kit sized to your household and your area.</Text>
      <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push('/setup')}>
        <Text style={styles.primaryText}>Start</Text>
      </Pressable>
      {hasPlan ? (
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/plan')}>
          <Text style={styles.secondaryText}>View my plan</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700' },
  pitch: { fontSize: 16, textAlign: 'center' },
  primary: { backgroundColor: '#0b5cad', borderRadius: 8, paddingVertical: 16, alignItems: 'center', width: '100%', maxWidth: 320, marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: '#0b5cad', borderRadius: 8, paddingVertical: 12, alignItems: 'center', width: '100%', maxWidth: 320 },
  secondaryText: { color: '#0b5cad', fontSize: 16, fontWeight: '600' },
});
