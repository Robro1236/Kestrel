import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../src/components/Icon';
import { onHeaderScroll } from '../src/components/Header';
import { Logo } from '../src/components/Logo';
import { IconBadge } from '../src/components/Steps';
import { Tap } from '../src/components/Tap';
import { load } from '../src/storage';
import { preparedCount } from '../src/supabase';
import { colors, fonts, headerPad, ui } from '../src/theme';
import { useAppFonts } from '../src/useAppFonts';

const POINTS: [IconName, string, string][] = [
  ['people', 'A kit sized to your home', 'How much water, food and medicine your household needs, item by item.'],
  ['pin', 'What could hit your area', "Your county's top disaster risks, live weather warnings, and the nearest help."],
  ['phone', 'Ready when the network is down', 'Your plan saves on this device and still opens offline.'],
];

export const SHARE_TEXT = "I made our household's emergency plan with Kestrel: a supply kit sized to who lives with us and where we live. Free, no account: https://kestrel-tan.vercel.app";

// Once per app launch: a returning user goes straight to their plan. Later visits (About Kestrel, Back) stay here.
// shortcut: a deep link to another page, then Home, still redirects once; track the first route if that matters.
let opened = false;

// The demo link (?start) opens as a first visit: saved answers go, but the "counted once" mark stays so the count isn't inflated.
export async function startOver() {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k !== 'planRecorded'));
}

export default function Home() {
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  // Native and phone browsers open the share sheet; a desktop browser without one copies the text instead.
  const share = async () => {
    const web = Platform.OS === 'web' && typeof navigator !== 'undefined';
    if (web && !navigator.share) return navigator.clipboard?.writeText(SHARE_TEXT).then(() => setCopied(true), () => {});
    await Share.share({ message: SHARE_TEXT }).catch(() => {}); // closing the sheet is not an error
  };
  // This page can lay out before the fonts load; Android keeps the system-font measurements and clips the text. Re-lay out once they're in.
  const [fontsLoaded] = useAppFonts();
  // Blank while the launch check runs, so the welcome page doesn't flash before the redirect.
  const [ready, setReady] = useState(opened);
  useEffect(() => {
    if (opened) return;
    opened = true;
    if (router.canGoBack()) return setReady(true);
    if (Platform.OS === 'web' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('start')) {
      history.replaceState(null, '', '/');
      // The focus check below can read the old plan before it's cleared, so reset it here.
      startOver().then(() => { setHasPlan(false); setReady(true); });
      return;
    }
    Promise.all([load('household'), load('location')]).then(([h, l]) => (h && l ? router.replace('/plan') : setReady(true)));
  }, [router]);

  // On focus, so "View my plan" and a fresh count appear after building a kit. A null count (any failure) is hidden.
  useFocusEffect(
    useCallback(() => {
      Promise.all([load('household'), load('location')]).then(([h, l]) => setHasPlan(!!h && !!l));
      preparedCount().then(setCount);
    }, []),
  );

  if (!ready) return null;
  return (
    <ScrollView onScroll={onHeaderScroll} scrollEventThrottle={16} key={fontsLoaded ? 'fonts' : 'system'} contentContainerStyle={[ui.screen, styles.container]}>
      <View style={styles.mark}>
        <Logo size={72} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Kestrel
      </Text>
      <Text style={styles.pitch}>Be ready for a disaster. Tell us where you live and who lives with you, and get your household's emergency plan.</Text>
      <View style={styles.actions}>
        <Tap accessibilityRole="button" style={styles.primary} onPress={() => router.replace('/setup')}>
          <Text style={styles.primaryText}>Make my plan</Text>
        </Tap>
        <Text style={styles.note}>Free, about a minute, no account.</Text>
        {hasPlan ? (
          <Tap accessibilityRole="button" style={styles.secondary} onPress={() => router.replace('/plan')}>
            <Text style={styles.secondaryText}>View my plan</Text>
          </Tap>
        ) : null}
      </View>
      {count != null ? (
        <Text style={styles.count}>
          {count.toLocaleString()} {count === 1 ? 'household' : 'households'} prepared
        </Text>
      ) : null}
      <Tap accessibilityRole="button" accessibilityLabel={copied ? 'Link copied' : 'Share with a neighbor'} onPress={share} style={styles.share}>
        <Icon name="people" size={18} color={colors.primary} />
        <Text style={styles.shareText}>{copied ? 'Link copied' : 'Share with a neighbor'}</Text>
      </Tap>
      <View style={styles.points}>
        {POINTS.map(([icon, title, body]) => (
          <View key={title} style={[ui.card, styles.point]}>
            <IconBadge name={icon} />
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>{title}</Text>
              <Text style={styles.pointBody}>{body}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 32 + headerPad },
  mark: { borderRadius: 16, boxShadow: '0 8px 24px rgba(15,94,87,0.28)' },
  title: { fontFamily: fonts.display, fontSize: 48, lineHeight: 58, color: colors.ink, letterSpacing: -1, marginTop: 6, alignSelf: 'stretch', textAlign: 'center' },
  pitch: { fontFamily: fonts.body, fontSize: 17, color: colors.muted, textAlign: 'center', width: '100%', maxWidth: 340 },
  actions: { width: '100%', maxWidth: 340, gap: 10, marginTop: 10 },
  primary: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryText: { fontFamily: fonts.bold, color: '#fff', fontSize: 18 },
  secondary: { minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.bold, color: colors.primary, fontSize: 16 },
  note: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center' },
  count: { fontFamily: fonts.semi, fontSize: 14, fontVariant: ['tabular-nums'], color: colors.success, backgroundColor: colors.successSoft, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  share: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  shareText: { fontFamily: fonts.semi, color: colors.primary, fontSize: 16 },
  points: { width: '100%', gap: 10, marginTop: 14 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  pointText: { flex: 1, gap: 4 },
  pointTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  pointBody: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
});
