import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { activeOnly, alertsPage, type Warnings as WarningsData } from '../data/nws';
import { localDay, localTime } from '../date';
import type { Saved } from '../storage';
import { colors, fonts, ui } from '../theme';

type Props = {
  lat: number;
  lon: number;
  inUs: boolean;
  // Fresh or saved result; null while loading or when nothing is saved.
  warnings: Saved<WarningsData> | null;
  failed: boolean;
};

// Quiet card with one status line, used unless alerts are active.
function Quiet({ ok, children }: { ok?: boolean; children: string }) {
  return (
    <View style={[ui.card, styles.quiet]}>
      <View style={[styles.dot, ok && styles.dotOk]} />
      <View style={styles.quietText}>
        <Text accessibilityRole="header" style={styles.quietTitle}>{ok ? 'All clear' : 'Weather warnings'}</Text>
        <Text style={styles.note}>{children}</Text>
      </View>
    </View>
  );
}

// Banner only when alerts are active; otherwise one quiet status card.
export function Warnings({ lat, lon, inUs, warnings, failed }: Props) {
  if (!inUs) return <Quiet>Live warnings are only available in the US for now.</Quiet>;
  const alerts = activeOnly(warnings?.data.alerts ?? []);
  const fetched = warnings ? `${failed ? 'saved' : 'fetched'} ${localDay(warnings.data.fetched_at)}` : '';

  if (!alerts.length) {
    return (
      <Quiet ok={!failed && !!warnings}>
        {failed
          ? `Couldn't check warnings right now.${warnings ? ` The last check (${localDay(warnings.data.fetched_at)}) found none.` : ''}`
          : warnings
            ? `No active warnings from the National Weather Service (${fetched}).`
            : 'Checking for weather warnings…'}
      </Quiet>
    );
  }
  return (
    <View accessibilityRole="alert" style={[ui.card, styles.banner]}>
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
  banner: { backgroundColor: colors.dangerSoft, borderColor: '#f6c9c4', borderLeftWidth: 5, borderLeftColor: colors.danger },
  title: { fontFamily: fonts.bold, fontSize: 19, color: colors.dangerInk },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  quietText: { flex: 1, gap: 2 },
  quietTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.subtle },
  dotOk: { backgroundColor: colors.success, boxShadow: '0 0 0 5px #e9f6ec' },
  alert: { gap: 2 },
  event: { fontFamily: fonts.bold, fontSize: 16, color: '#1f1f1f' },
  severity: { fontFamily: fonts.body, color: '#444' },
  headline: { fontFamily: fonts.body, fontSize: 14, color: '#333' },
  note: { fontFamily: fonts.body, fontSize: 14, color: '#333' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fonts.semi, color: colors.primary, fontSize: 15 },
  source: { fontFamily: fonts.body, fontSize: 12, color: '#555' },
});
