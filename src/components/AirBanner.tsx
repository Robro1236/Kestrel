import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { airTier, fetchAirQuality, type AirQuality } from '../data/airQuality';

// Renders nothing unless US AQI > 100. One fetch per location, never on a timer.
export function AirBanner({ lat, lon }: { lat: number; lon: number }) {
  const [air, setAir] = useState<AirQuality | null>(null);

  useEffect(() => {
    let live = true;
    setAir(null);
    fetchAirQuality(lat, lon).then((a) => live && setAir(a));
    return () => {
      live = false;
    };
  }, [lat, lon]);

  const tier = air && airTier(air.aqi);
  if (!air || !tier) return null;
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Text style={styles.title}>
        Air quality: {tier.label} (US AQI {Math.round(air.aqi)})
      </Text>
      <Text style={styles.tip}>{tier.tip}</Text>
      <Text style={styles.source}>Source: Open-Meteo air quality, fetched {air.fetchedAt.slice(0, 10)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#fff4e5', borderLeftWidth: 4, borderLeftColor: '#b45309', borderRadius: 8, padding: 12, gap: 4 },
  title: { fontSize: 16, fontWeight: '700', color: '#7c2d12' },
  tip: { fontSize: 15, color: '#1f1f1f' },
  source: { fontSize: 12, color: '#555' },
});
