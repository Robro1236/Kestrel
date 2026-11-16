import { useIsFocused, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Menu } from './Menu';
import { Tap } from './Tap';
import { spring } from '../motion';
import { colors, fonts, HEADER_BAR as BAR } from '../theme';

// 1 while the header is on screen, 0 once it has slid away. Shared so the plan's progress strip can ride under it.
export const headerShown = new Animated.Value(1);

// App header: slides away while scrolling down and comes back on any scroll up, so reading gets the whole screen.
// On web it floats over the page (headerTransparent in _layout) and slides, so showing it never pushes the page down.
export function Header({ route }: { route: { name: string } }) {
  const router = useRouter();
  const top = useSafeAreaInsets().top;
  const focused = useIsFocused();

  useEffect(() => {
    // shortcut: web only (one capture listener sees every screen's scroller); native keeps a fixed header, add onScroll per screen to match.
    if (Platform.OS !== 'web' || !focused) return;
    spring(headerShown, 1, { layout: true });
    let last = 0;
    let hidden = false;
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (typeof el.scrollTop !== 'number') return;
      const y = el.scrollTop;
      if (Math.abs(y - last) < 6) return;
      const hide = y > last && y > BAR;
      last = y;
      if (hide !== hidden) spring(headerShown, (hidden = hide) ? 0 : 1, { layout: true });
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [focused]);

  // Clamped: the shared spring overshoots a little, which would drop the header below the top edge and show the page above it.
  const slide = Platform.OS === 'web' ? [{ translateY: headerShown.interpolate({ inputRange: [0, 1], outputRange: [-(BAR + top), 0], extrapolate: 'clamp' }) }] : [];
  return (
    <Animated.View style={[styles.wrap, { paddingTop: top, transform: slide }]}>
      <View style={styles.bar}>
        {/* The welcome screen has no wordmark. It is a way home: it opens the plan (which sends a new user to setup). */}
        {route.name === 'index' ? <View /> : (
          <Tap accessibilityRole="link" accessibilityLabel="Kestrel, go to your plan" onPress={() => router.navigate('/plan')} style={styles.home}>
            <Text style={styles.brand}>Kestrel</Text>
          </Tap>
        )}
        <Menu />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg },
  bar: { minHeight: BAR, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8 },
  home: { minHeight: 44, justifyContent: 'center' },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
});
