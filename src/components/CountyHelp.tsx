import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>San Joaquin County</Text>

      <Text style={styles.subheading}>Get county emergency alerts</Text>
      <Text>SJReady sends evacuation orders and warnings by text, call or email. It's free.</Text>
      <Link url={LINKS.alerts}>Sign up for SJReady alerts</Link>

      <Text style={styles.subheading}>Know your evacuation zone</Text>
      <Text>Every address has a zone code, like SJC-001. Look yours up now, write it on your family plan card, and check the map for orders during an emergency.</Text>
      <Link url={LINKS.zoneMap}>Find your zone on the county map</Link>
      <Link url={LINKS.knowYourZone}>How zones work</Link>

      <Text style={styles.subheading}>Cooling centers</Text>
      <Text>During heat waves the county lists open cooling centers on SJReady.</Text>
      <Link url={LINKS.sjReady}>sjready.org</Link>

      <Text style={styles.source}>Source: San Joaquin County Office of Emergency Services. Links checked {COUNTY_LINKS_CHECKED}.</Text>
    </View>
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
  section: { gap: 6 },
  heading: { fontSize: 20, fontWeight: '700' },
  subheading: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#0b5cad', textDecorationLine: 'underline', fontSize: 15 },
  source: { fontSize: 12, color: '#555' },
});
