import { useIsFocused, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from './Logo';
import { Menu } from './Menu';
import { Tap } from './Tap';
import { spring } from '../motion';
import { colors, fixed, fonts, HEADER_BAR as BAR } from '../theme';

// 1 while the header is on screen, 0 once it has slid away. Shared so the plan's progress strip can ride under it.
export const headerShown = new Animated.Value(1);

// The page's scroll position, followed by whichever screen is in front.
let last = 0;
let hidden = false;
const follow = (y: number) => {
  if (Math.abs(y - last) < 6) return;
  const hide = y > last && y > BAR;
  last = y;
  // Native driver on phones: the plan's strip and sparks share this value and run natively.
  if (hide !== hidden) spring(headerShown, (hidden = hide) ? 0 : 1);
};

// Phones: each screen's ScrollView passes this (with scrollEventThrottle={16}). Web listens to every scroller at once below.
export const onHeaderScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
  if (Platform.OS !== 'web') follow(e.nativeEvent.contentOffset.y);
};

// App header: slides away while scrolling down and comes back on any scroll up, so reading gets the whole screen.
// It floats over the page (headerTransparent in _layout) and slides, so showing it never pushes the page down.
export function Header({ route }: { route: { name: string } }) {
  const router = useRouter();
  const top = useSafeAreaInsets().top;
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused) return;
    // A newly opened screen starts at its top, with the header showing.
    last = 0;
    hidden = false;
    spring(headerShown, 1);
    if (Platform.OS !== 'web') return;
    // Web: the document scrolls (theme pageScroll); an inner scroller (a sheet) reports its own scrollTop.
    window.scrollTo(0, 0);
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      follow(typeof el.scrollTop === 'number' ? el.scrollTop : window.scrollY);
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [focused]);

  // Clamped: the shared spring overshoots a little, which would drop the header below the top edge and show the page above it.
  const slide = [{ translateY: headerShown.interpolate({ inputRange: [0, 1], outputRange: [-(BAR + top), 0], extrapolate: 'clamp' }) }];
  return (
    // box-none: once the header slides away, taps and scrolls reach the page under where it was.
    <View pointerEvents="box-none" style={fixed && [fixed, styles.pinned]}>
    <Animated.View style={[styles.wrap, { paddingTop: top, transform: slide }]}>
      <View style={styles.bar}>
        {/* The welcome screen has no wordmark. It is a way home: it opens the plan (which sends a new user to setup). */}
        {route.name === 'index' ? <View /> : (
          <Tap accessibilityRole="link" accessibilityLabel="Kestrel, go to your plan" onPress={() => router.dismissTo('/plan')} style={styles.home}>
            <View style={styles.wordmark}>
              <Logo size={26} bare />
              <Text style={styles.brand}>Kestrel</Text>
            </View>
          </Tap>
        )}
        <Menu top={top} />
      </View>
    </Animated.View>
    {/* Covers the status bar (phones) once the header has slid under it, so text never scrolls under the clock. */}
    <View style={[styles.status, { height: top }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg },
  pinned: { top: 0, left: 0, right: 0 },
  status: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.bg },
  bar: { minHeight: BAR, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8 },
  home: { minHeight: 44, justifyContent: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
});
