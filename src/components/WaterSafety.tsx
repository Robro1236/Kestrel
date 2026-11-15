import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Hazard } from '../kit/rules';
import { fetchElevation } from '../water/elevation';
import { waterGuidance, type WaterLine } from '../water/guidance';

type Props = {
  lat: number;
  lon: number;
  gallons: number;
  countryCode: string | null;
  hazards: Hazard[];
  // Event names of active NWS alerts.
  activeAlerts: string[];
};

// Renders at once with both boil times; one elevation fetch per location narrows it down.
export function WaterSafety({ lat, lon, gallons, countryCode, hazards, activeAlerts }: Props) {
  const [elevationM, setElevationM] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    setElevationM(null);
    fetchElevation(lat, lon).then((m) => live && setElevationM(m));
    return () => {
      live = false;
    };
  }, [lat, lon]);

  const g = waterGuidance({ gallons, countryCode, hazards, activeAlerts, elevationM });
  const line = (l: WaterLine, style = styles.text) => (
    <Text key={l.id} style={style}>
      {l.text} <Text style={styles.source}>Source: {l.source}</Text>
    </Text>
  );
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Water safety</Text>
      {g.disaster && g.urgent ? (
        <View accessibilityRole="alert" style={styles.urgent}>
          {line(g.disaster, styles.urgentText)}
        </View>
      ) : null}
      <Text style={styles.text}>
        Store <Text style={styles.qty}>{g.gallons} gallons</Text> for your household (3 days).{' '}
        <Text style={styles.source}>Source: Ready.gov</Text>
      </Text>
      {g.baseline ? line(g.baseline) : null}
      {g.disaster && !g.urgent ? line(g.disaster) : null}
      <Text accessibilityRole="header" style={styles.sub}>If you need to make water safe</Text>
      {g.steps.map((s) => line(s))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { fontSize: 22, fontWeight: '700', marginTop: 12 },
  sub: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  text: { fontSize: 15, color: '#1f1f1f' },
  qty: { fontWeight: '700', color: '#0b5cad' },
  urgent: { backgroundColor: '#fdecea', borderLeftWidth: 4, borderLeftColor: '#b42318', borderRadius: 8, padding: 12 },
  urgentText: { fontSize: 15, fontWeight: '600', color: '#7a1a12' },
  source: { fontSize: 12, color: '#666', fontWeight: '400' },
});
