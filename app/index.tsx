import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { load } from '../src/storage';
import { preparedCount } from '../src/supabase';

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
      {count != null ? (
        <Text style={styles.count}>
          {count.toLocaleString()} {count === 1 ? 'household' : 'households'} prepared
        </Text>
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
  secondary: { minHeight: 44, borderWidth: 1, borderColor: '#0b5cad', borderRadius: 8, paddingVertical: 12, alignItems: 'center', width: '100%', maxWidth: 320 },
  count: { fontSize: 15, color: '#333', marginTop: 8 },
  secondaryText: { color: '#0b5cad', fontSize: 16, fontWeight: '600' },
});
