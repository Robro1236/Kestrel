import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Step } from './Steps';
import { colors, fonts, ui } from '../theme';

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
  // Home screen: show only the urgent boil/do-not-drink card, and nothing when water is fine.
  urgentOnly?: boolean;
};

// Renders at once with both boil times; one elevation fetch per location narrows it down.
function useGuidance({ lat, lon, gallons, countryCode, hazards, activeAlerts }: Props) {
  const [elevationM, setElevationM] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    setElevationM(null);
    fetchElevation(lat, lon).then((m) => live && setElevationM(m));
    return () => {
      live = false;
    };
  }, [lat, lon]);
  return waterGuidance({ gallons, countryCode, hazards, activeAlerts, elevationM });
}

const line = (l: WaterLine, style = styles.text) => (
  <Text key={l.id} style={style}>
    {l.text} <Text style={styles.source}>Source: {l.source}</Text>
  </Text>
);

export function WaterSafety(props: Props) {
  const g = useGuidance(props);
  const urgent = g.disaster && g.urgent;
  if (props.urgentOnly && !urgent) return null;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Water safety</Text>
      {urgent ? (
        <View accessibilityRole="alert" style={styles.urgent}>
          {line(g.disaster!, styles.urgentText)}
        </View>
      ) : null}
      {props.urgentOnly ? null : (
        <>
          <Text style={styles.text}>
            Store <Text style={styles.qty}>{g.gallons} gallons</Text> for your household (3 days).{' '}
            <Text style={styles.source}>Source: Ready.gov</Text>
          </Text>
          {g.baseline ? line(g.baseline) : null}
          {g.disaster && !g.urgent ? line(g.disaster) : null}
        </>
      )}
    </View>
  );
}

// How to treat water: its own card, at the bottom of the Water screen.
export function WaterTreatment(props: Props) {
  const g = useGuidance(props);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>If you need to make water safe</Text>
      {g.steps.map((s) => (
        <Step key={s.id}>
          {line(s)}
        </Step>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: ui.card,
  heading: ui.cardTitle,
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  qty: { fontFamily: fonts.bold, color: colors.primary },
  urgent: { backgroundColor: '#fdecea', borderLeftWidth: 4, borderLeftColor: '#b42318', borderRadius: 8, padding: 12 },
  urgentText: { fontFamily: fonts.semi, fontSize: 15, color: '#7a1a12' },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
});
