import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, ui } from '../theme';

// San Joaquin County, CA (Mountain House, Tracy, Stockton). Links from sjready.org, the county OES site.
export const SAN_JOAQUIN_FIPS = '06077';
// Visited and confirmed to load on this date.
export const COUNTY_LINKS_CHECKED = '2026-11-14';
const LINKS = {
  alerts: 'https://member.everbridge.net/index/397890065268824',
  knowYourZone: 'https://www.sjready.org/preparedness/disasterreadiness/knowyourzone',
  zoneMap: 'https://perimetermap.com/San-Joaquin-CA',
  sjReady: 'https://www.sjready.org/',
};

// shortcut: only San Joaquin County has local links; add a county here (keyed by FIPS) when the app launches somewhere else.
export function CountyHelp({ countyFips }: { countyFips?: string | null }) {
  if (countyFips !== SAN_JOAQUIN_FIPS) return null;
  // One card per task; the county name labels the group.
  return (
    <>
      <Text accessibilityRole="header" style={[ui.eyebrow, styles.label]}>San Joaquin County</Text>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={ui.cardTitle}>Get county emergency alerts</Text>
        <Text style={styles.text}>SJReady sends evacuation orders and warnings by text, call or email. It's free.</Text>
        <Link url={LINKS.alerts}>Sign up for SJReady alerts</Link>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={ui.cardTitle}>Know your evacuation zone</Text>
        <Text style={styles.text}>Every address has a zone code, like SJC-001. Look yours up now, write it on your family plan card, and check the map for orders during an emergency.</Text>
        <Link url={LINKS.zoneMap}>Find your zone on the county map</Link>
        <Link url={LINKS.knowYourZone}>How zones work</Link>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={ui.cardTitle}>Cooling centers</Text>
        <Text style={styles.text}>During heat waves the county lists open cooling centers on SJReady.</Text>
        <Link url={LINKS.sjReady}>sjready.org</Link>
        <Text style={styles.source}>Source: San Joaquin County Office of Emergency Services. Links checked {COUNTY_LINKS_CHECKED}.</Text>
      </View>
    </>
  );
}

function Link({ url, children }: { url: string; children: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)} style={styles.linkHit}>
      <Text style={styles.link}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: ui.card,
  label: { paddingHorizontal: 4, marginBottom: -6 },
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: fonts.body, color: colors.primary, textDecorationLine: 'underline', fontSize: 15 },
  source: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle },
});
