import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchWaterSystem, type WaterSystemResult } from '../data/waterSystem';
import { loadResult, saveResult, type Saved } from '../storage';

type Stored = { lat: number; lon: number; result: WaterSystemResult };

// US only. Shows the saved record at once, then one EPA fetch per location; keeps the saved one if that fails.
export function WaterSystem({ lat, lon, inUs }: { lat: number; lon: number; inUs: boolean }) {
  const [saved, setSaved] = useState<Saved<Stored> | null>(null);
  const [fresh, setFresh] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!inUs) return;
    let live = true;
    setSaved(null);
    setFresh(false);
    setFailed(false);
    loadResult<Stored>('waterSystem').then((s) => {
      // Storage keeps one copy; only show it for the same point.
      if (live && s && s.data.lat === lat && s.data.lon === lon) setSaved((cur) => cur ?? s);
    });
    fetchWaterSystem(lat, lon).then(async (result) => {
      if (!live) return;
      if (!result) return setFailed(true);
      const data = { lat, lon, result };
      setSaved({ data, savedAt: new Date().toISOString() });
      setFresh(true);
      await saveResult('waterSystem', data);
    });
    return () => {
      live = false;
    };
  }, [lat, lon, inUs]);

  if (!inUs) return null;
  const r = saved?.data.result;
  const date = saved ? `${fresh ? 'fetched' : 'saved'} ${saved.savedAt.slice(0, 10)}` : '';

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Your water system</Text>
      {!r ? (
        <Text style={styles.text}>
          {failed ? "Couldn't reach EPA drinking water records right now." : 'Checking EPA drinking water records…'}
        </Text>
      ) : r === 'none' ? (
        <Text style={styles.text}>
          EPA has no public water system mapped at your location. If your home uses a private well, test it once a year.
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            <Text style={styles.name}>{r.name}</Text>
            {r.population ? ` serves about ${r.population.toLocaleString()} people.` : '.'}
          </Text>
          {r.quartersWithViolations || r.current ? (
            <View accessible={r.healthBased} accessibilityRole={r.healthBased ? 'alert' : undefined} style={r.healthBased ? styles.urgent : undefined}>
              <Text style={r.healthBased ? styles.urgentText : styles.text}>
                {r.healthBased ? 'Health-based violation' : 'Violations'} in {r.quartersWithViolations} of the last 12 quarters
                {r.current ? ', one still open' : ''}
                {r.contaminants.length ? `: ${r.contaminants.join(', ')}.` : '.'}
              </Text>
            </View>
          ) : (
            <Text style={styles.text}>No violations reported in the last 3 years.</Text>
          )}
          {r.reportUrl ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(r.reportUrl!)} style={styles.linkHit}>
              <Text style={styles.link}>Full EPA report for this system</Text>
            </Pressable>
          ) : null}
        </>
      )}
      {r ? (
        <Text style={styles.source}>
          Source: EPA ECHO drinking water records (last 3 years) and EPA water system service areas, {date}.
          {failed ? ' Showing the saved copy.' : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { fontSize: 22, fontWeight: '700', marginTop: 12 },
  text: { fontSize: 15, color: '#1f1f1f' },
  name: { fontWeight: '700' },
  urgent: { backgroundColor: '#fdecea', borderLeftWidth: 4, borderLeftColor: '#b42318', borderRadius: 8, padding: 12 },
  urgentText: { fontSize: 15, fontWeight: '600', color: '#7a1a12' },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#0b5cad', textDecorationLine: 'underline', fontSize: 15 },
  source: { fontSize: 12, color: '#666' },
});
