import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Menu } from './Menu';
import { Tap } from './Tap';
import { spring } from '../motion';
import { colors, fonts } from '../theme';

const BAR = 64;

// App header: slides away while scrolling down and comes back on any scroll up, so reading gets the whole screen.
// It collapses (not floats), so whatever pins under it, like the plan's progress strip, rises with it.
export function Header({ route }: { route: { name: string } }) {
  const router = useRouter();
  const top = useSafeAreaInsets().top;
  const shown = useRef(new Animated.Value(1)).current;
  const focused = useIsFocused();

  useEffect(() => {
    // shortcut: web only (one capture listener sees every screen's scroller); native keeps a fixed header, add onScroll per screen to match.
    if (Platform.OS !== 'web' || !focused) return;
    spring(shown, 1, { layout: true });
    let last = 0;
    let hidden = false;
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (typeof el.scrollTop !== 'number') return;
      const y = el.scrollTop;
      // Collapsing grows the scroller, which can clamp scrollTop at the bottom; that is not the user scrolling up.
      const atBottom = y >= el.scrollHeight - el.clientHeight - 2;
      if (Math.abs(y - last) < 6 || (y < last && atBottom)) return;
      const hide = y > last && y > BAR;
      last = y;
      if (hide !== hidden) spring(shown, (hidden = hide) ? 0 : 1, { layout: true });
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [focused, shown]);

  return (
    <Animated.View style={[styles.wrap, { height: shown.interpolate({ inputRange: [0, 1], outputRange: [0, BAR + top] }) }]}>
      <View style={[styles.bar, { marginTop: top }]}>
        {/* The welcome screen has no wordmark. It is a way home: it opens the plan (which sends a new user to setup). */}
        {route.name === 'index' ? <View /> : (
          <Tap accessibilityRole="link" accessibilityLabel="Kestrel, go to your plan" onPress={() => router.navigate('/plan')}>
            <Text style={styles.brand}>Kestrel</Text>
          </Tap>
        )}
        <Menu />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Bottom-aligned, so collapsing clips the top and the bar reads as sliding up.
  wrap: { overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.bg },
  bar: { height: BAR, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8 },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
});
