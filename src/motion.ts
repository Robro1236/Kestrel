import { AccessibilityInfo, Animated, Platform } from 'react-native';

// One spring for the whole app, so every movement feels the same. Off when the user asks for reduced motion.
let reduce = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => (reduce = v)).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => (reduce = v));

// layout: width and other layout values can't use the native driver; web has none at all.
// bouncy: a looser spring with visible overshoot, for presses springing back.
// pop: a small overshoot, for sheets and cards growing out of what opened them (the menu, timeline details).
export const spring = (value: Animated.Value, toValue: number, { layout = false, bouncy = false, pop = false } = {}) =>
  reduce
    ? value.setValue(toValue)
    : Animated.spring(value, {
        toValue,
        stiffness: bouncy || pop ? 300 : 400,
        damping: bouncy ? 14 : pop ? 22 : 30,
        mass: 1,
        useNativeDriver: !layout && Platform.OS !== 'web',
      }).start();

// The style for something growing out of what opened it (menu sheet, timeline details). dy: where it slides in from.
export const popIn = (shown: Animated.Value, dy = -8) => ({
  opacity: shown.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
  transform: [
    { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
    { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
  ],
});
