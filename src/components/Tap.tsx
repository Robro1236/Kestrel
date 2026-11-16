import { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { spring } from '../motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A Pressable that springs down a little while held, so buttons feel physical.
// perspective keeps it on its own layer on web, so it does not snap to the pixel grid (a visible jump) when the spring settles.
// scale: pass a shared value so several pieces (a timeline dot, its branch, its text) press down together.
export function Tap({ style, onPressIn, onPressOut, scale: shared, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scale?: Animated.Value }) {
  const own = useRef(new Animated.Value(1)).current;
  const scale = shared ?? own;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => (spring(scale, 0.93), onPressIn?.(e))}
      onPressOut={(e) => (spring(scale, 1, { bouncy: true }), onPressOut?.(e))}
      style={[style, { transform: [{ perspective: 1000 }, { scale }] }]}
    />
  );
}
