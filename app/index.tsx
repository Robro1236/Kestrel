import { StyleSheet, Text, View } from 'react-native';

// Placeholder home screen; T4 replaces it with the counter and Start button.
export default function Home() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Kestrel
      </Text>
      <Text style={styles.pitch}>An emergency kit sized to your household and your area.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700' },
  pitch: { fontSize: 16, marginTop: 8, textAlign: 'center' },
});
