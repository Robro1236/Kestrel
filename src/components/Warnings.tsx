import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { activeOnly, alertsPage, type Warnings as WarningsData } from '../data/nws';
import { localDay, localTime } from '../date';
import type { Saved } from '../storage';

type Props = {
  lat: number;
  lon: number;
  inUs: boolean;
  // Fresh or saved result; null while loading or when nothing is saved.
  warnings: Saved<WarningsData> | null;
  failed: boolean;
};

// Banner only when alerts are active; otherwise one plain status line.
export function Warnings({ lat, lon, inUs, warnings, failed }: Props) {
  if (!inUs) return <Text style={styles.note}>Live warnings are only available in the US for now.</Text>;
  const alerts = activeOnly(warnings?.data.alerts ?? []);
  const fetched = warnings ? `${failed ? 'saved' : 'fetched'} ${localDay(warnings.data.fetched_at)}` : '';

  if (!alerts.length) {
    return (
      <Text style={styles.note}>
        {failed
          ? `Couldn't check warnings right now.${warnings ? ` The last check (${localDay(warnings.data.fetched_at)}) found none.` : ''}`
          : warnings
            ? `No active warnings from the National Weather Service (${fetched}).`
            : 'Checking for weather warnings…'}
      </Text>
    );
  }
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Text accessibilityRole="header" style={styles.title}>
        {alerts.length === 1 ? 'Active warning' : `${alerts.length} active warnings`}
      </Text>
      {failed ? <Text style={styles.note}>Couldn't check warnings right now. Showing the last saved list.</Text> : null}
      {alerts.map((a) => (
        <View key={a.id} style={styles.alert}>
          <Text style={styles.event}>
            {a.event} <Text style={styles.severity}>({a.severity})</Text>
          </Text>
          <Text style={styles.headline}>{a.headline}</Text>
          {a.ends ? (
            <Text style={styles.note}>Until {localTime(a.ends)}</Text>
          ) : a.expires ? (
            <Text style={styles.note}>Next update by {localTime(a.expires)}</Text>
          ) : null}
        </View>
      ))}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Read the full warnings on weather.gov"
        onPress={() => Linking.openURL(alertsPage(lat, lon))}
        style={styles.link}
      >
        <Text style={styles.linkText}>Read the full warnings on weather.gov</Text>
      </Pressable>
      <Text style={styles.source}>Source: National Weather Service, {fetched}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#fdecea', borderLeftWidth: 4, borderLeftColor: '#b42318', borderRadius: 8, padding: 12, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#7a1a12' },
  alert: { gap: 2 },
  event: { fontSize: 16, fontWeight: '700', color: '#1f1f1f' },
  severity: { fontWeight: '400', color: '#444' },
  headline: { fontSize: 14, color: '#333' },
  note: { fontSize: 14, color: '#333' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: '#0b5cad', fontSize: 15, fontWeight: '600' },
  source: { fontSize: 12, color: '#555' },
});
