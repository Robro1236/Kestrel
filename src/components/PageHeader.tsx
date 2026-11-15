import { StyleSheet, Text, View } from 'react-native';

import { ui } from '../theme';

// Title for the detail screens, so a page reads as a page rather than one floating card.
export function PageHeader({ title, place }: { title: string; place: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={ui.eyebrow}>For {place}</Text>
      <Text accessibilityRole="header" style={ui.pageTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { paddingHorizontal: 4, paddingTop: 8, gap: 2 } });
