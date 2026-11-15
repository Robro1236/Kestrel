import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, View, type ViewStyle } from 'react-native';

import { spring } from '../motion';

// Slides its children open and shut by animating height. Once shut, the children unmount so they can't take focus.
// closeDelay: ms to wait before shutting, so a change that caused it (a last checkmark) is seen first.
export function Collapse({ open, closeDelay = 0, style, children }: { open: boolean; closeDelay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const shown = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [height, setHeight] = useState(0);
  const [gone, setGone] = useState(!open);
  useEffect(() => {
    const id = shown.addListener(({ value }) => value === 0 && setGone(true));
    return () => shown.removeListener(id);
  }, [shown]);
  useEffect(() => {
    if (open) {
      setGone(false);
      return spring(shown, 1, { layout: true });
    }
    const t = setTimeout(() => spring(shown, 0, { layout: true }), closeDelay);
    return () => clearTimeout(t);
  }, [shown, open, closeDelay]);

  return (
    <Animated.View
      style={{ overflow: 'hidden', height: shown.interpolate({ inputRange: [0, 1], outputRange: [0, height], extrapolate: 'clamp' }) }}
    >
      {gone && !open ? null : (
        <View style={style} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
          {children}
        </View>
      )}
    </Animated.View>
  );
}
