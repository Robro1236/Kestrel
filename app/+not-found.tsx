import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Tap } from '../src/components/Tap';
import { colors, fonts, ui } from '../src/theme';

// Any unknown URL lands here instead of Expo's developer "Unmatched Route" screen.
export default function NotFoundScreen() {
  return (
    <View style={ui.screen}>
      <Text accessibilityRole="header" style={ui.pageTitle}>Page not found</Text>
      <View style={ui.card}>
        <Text style={styles.text}>This link doesn't go anywhere in Kestrel. Anything you saved is still on this device.</Text>
        <Tap accessibilityRole="button" style={styles.primary} onPress={() => router.replace('/')}>
          <Text style={styles.primaryText}>Go to Kestrel</Text>
        </Tap>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  primary: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 14 },
  primaryText: { fontFamily: fonts.bold, color: '#fff', fontSize: 18 },
});
