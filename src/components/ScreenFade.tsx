import { useIsFocused } from 'expo-router';
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { spring } from '../motion';

// Web has no stack transition, so screens swap instantly. This eases each one in when it gains focus.
// It never delays rendering: content is there from the first frame, only fading up.
export function ScreenFade({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!focused) return;
    v.setValue(0);
    spring(v, 1);
  }, [focused, v]);
  return (
    <Animated.View style={{ flex: 1, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}
