import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { airTier, fetchAirQuality, type AirQuality } from '../data/airQuality';
import { localDay } from '../date';
import { colors, fonts, ui } from '../theme';

// One fetch per location, never on a timer. The plan holds the result so it can place the card.
// Waits (no fetch) until the location is known.
export function useAirQuality(lat?: number, lon?: number) {
  const [air, setAir] = useState<AirQuality | null>(null);
  useEffect(() => {
    let live = true;
    setAir(null);
    if (lat == null || lon == null) return;
    fetchAirQuality(lat, lon).then((a) => live && setAir(a));
    return () => {
      live = false;
    };
  }, [lat, lon]);
  return air;
}

// Above AQI 100: an alert banner. At or below: a quiet card. No data: nothing, never "fine" without data.
export function AirBanner({ air }: { air: AirQuality | null }) {
  if (!air) return null;
  const tier = airTier(air.aqi);
  const source = <Text style={styles.source}>Source: Open-Meteo air quality, fetched {localDay(air.fetchedAt)}</Text>;
  if (!tier) {
    return (
      <View style={ui.card}>
        <View style={styles.row}>
          <Text accessibilityRole="header" style={ui.cardTitle}>Air quality</Text>
          <Text style={[styles.pill, air.aqi > 50 && styles.pillModerate]}>{air.aqi <= 50 ? 'Good' : 'Moderate'} · AQI {Math.round(air.aqi)}</Text>
        </View>
        {source}
      </View>
    );
  }
  return (
    <View accessibilityRole="alert" style={[ui.card, styles.banner]}>
      <Text style={styles.title}>
        Air quality: {tier.label} (US AQI {Math.round(air.aqi)})
      </Text>
      <Text style={styles.tip}>{tier.tip}</Text>
      {source}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.warnSoft, borderColor: '#f5d9b0', borderLeftWidth: 5, borderLeftColor: colors.warn },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { fontFamily: fonts.bold, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.success, backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  pillModerate: { color: colors.warn, backgroundColor: colors.warnSoft },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.warnInk },
  tip: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
});
