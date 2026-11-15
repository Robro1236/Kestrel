import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Tap } from './Tap';
import { Icon } from './Icon';
import { SAN_JOAQUIN_FIPS } from './CountyHelp';
import { popIn, spring } from '../motion';
import { loadResult } from '../storage';
import { colors, fonts } from '../theme';

const LINKS: [string, Href][] = [
  ['Home', '/plan'],
  ['Local hazards', '/hazards'],
  ['Water', '/water'],
  ['Nearby help', '/help'],
  ['After a disaster', '/after'],
  ['County alerts', '/county'],
  ['Disaster history', '/history'],
  ['Family plan card', '/family'],
];

// Header hamburger: navigation plus device settings. Replaces the back arrow.
export function Menu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // The sheet grows out of the menu button (top right) with a small overshoot.
  const shown = useRef(new Animated.Value(0)).current;
  // County alerts only has content for San Joaquin County; hide the link elsewhere.
  const [county, setCounty] = useState(false);
  useEffect(() => {
    if (open) {
      loadResult<{ county_fips?: string }>('area').then((a) => setCounty(a?.data.county_fips === SAN_JOAQUIN_FIPS));
      shown.setValue(0);
      spring(shown, 1, { pop: true });
    }
  }, [open, shown]);

  const close = () => {
    setOpen(false);
    setConfirm(false);
  };
  const go = (href: Href) => {
    close();
    router.navigate(href);
  };
  // Keeps planRecorded so a reset device isn't counted twice in "households prepared".
  const reset = async () => {
    if (!confirm) return setConfirm(true);
    const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
    await AsyncStorage.multiRemove(keys.filter((k) => k !== 'planRecorded')).catch(() => {});
    close();
    router.replace('/');
  };

  return (
    <>
      <Tap accessibilityRole="button" accessibilityLabel="Menu" onPress={() => setOpen(true)} style={styles.burger}>
        <Icon name="menu" size={24} />
      </Tap>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable accessibilityLabel="Close menu" style={styles.backdrop} onPress={close} />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, popIn(shown)]}
        >
          <View style={styles.head}>
            <Text style={styles.brand}>Kestrel</Text>
            <Tap accessibilityRole="button" accessibilityLabel="Close menu" onPress={close} style={styles.close}>
              <Icon name="close" size={22} color={colors.muted} />
            </Tap>
          </View>
          {LINKS.filter(([, href]) => county || href !== '/county').map(([label, href]) => (
            <Tap key={label} accessibilityRole="link" onPress={() => go(href)} style={styles.item}>
              <Text style={styles.itemText}>{label}</Text>
              <Icon name="chevronRight" size={18} color={colors.subtle} />
            </Tap>
          ))}
          <Text style={styles.section}>Settings</Text>
          <Tap accessibilityRole="button" onPress={reset} style={styles.item}>
            <Text style={[styles.itemText, styles.danger]}>{confirm ? 'Tap again to erase' : 'Reset this device'}</Text>
          </Tap>
          <Text style={styles.foot}>
            {confirm
              ? 'Erases your household, location, checklist and family card from this device.'
              : 'Everything is saved on this device only. Data from FEMA, NWS, EPA, Open-Meteo and Ready.gov.'}
          </Text>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  burger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(28,25,23,0.35)' },
  sheet: {
    transformOrigin: 'top right', position: 'absolute', top: 8, right: 8, left: 8, maxWidth: 340, marginLeft: 'auto',
    backgroundColor: colors.surface, borderRadius: 18, padding: 8, paddingBottom: 14,
    boxShadow: '0 12px 40px rgba(28,25,23,0.22)',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12 },
  brand: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 10 },
  itemText: { fontFamily: fonts.semi, fontSize: 16, color: colors.text },
  danger: { color: colors.danger },
  section: { fontFamily: fonts.bold, fontSize: 12, color: colors.subtle, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 12, marginTop: 10, marginBottom: 2 },
  foot: { fontFamily: fonts.body, fontSize: 13, color: colors.subtle, paddingHorizontal: 12, marginTop: 4 },
});
