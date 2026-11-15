import { AccessibilityInfo, Animated, Platform } from 'react-native';

// One spring for the whole app, so every movement feels the same. Off when the user asks for reduced motion.
let reduce = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => (reduce = v)).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => (reduce = v));

// layout: width and other layout values can't use the native driver; web has none at all.
// bouncy: a looser spring with visible overshoot, for releases and things popping out.
export const spring = (value: Animated.Value, toValue: number, { layout = false, bouncy = false } = {}) =>
  reduce
    ? value.setValue(toValue)
    : Animated.spring(value, {
        toValue,
        stiffness: bouncy ? 300 : 400,
        damping: bouncy ? 14 : 30,
        mass: 1,
        useNativeDriver: !layout && Platform.OS !== 'web',
      }).start();
