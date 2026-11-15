import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

// Entry point to the family plan card (app/family.tsx), kept out of plan.tsx so it can move or restyle alone.
export function FamilyPlanLink() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push('/family')}>
      <Text style={styles.link}>Family plan card</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { color: '#0b5cad', fontSize: 16, fontWeight: '600', paddingVertical: 4 },
});
