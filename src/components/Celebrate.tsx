import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { Icon } from './Icon';
import { spring } from '../motion';
import { colors } from '../theme';

// A green spark flying out from behind a checked box (it fades and grows in over the box) into the progress bar. All in page coordinates.
// targetY is live (it follows scrolling), so a spark still lands on the bar if the user scrolls mid-flight.
export type Spark = { id: number; x: number; y: number; tx: number; targetY: Animated.AnimatedNode; delay: number };

export function SparkDot({ spark, onDone }: { spark: Spark; onDone: (id: number) => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = setTimeout(() => spring(t, 1, { layout: true }, () => onDone(spark.id)), spark.delay);
    return () => clearTimeout(id);
    // Runs once per spark; onDone is a new function each render.
  }, [t, spark]);
  // y = start + (target - start) * t, written so the live target can be an Animated node.
  const top = Animated.add(t.interpolate({ inputRange: [0, 1], outputRange: [spark.y, 0] }), Animated.multiply(spark.targetY, t));
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={[
        styles.spark,
        {
          opacity: t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [spark.x, spark.tx] }) },
            { translateY: top },
            { scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.3, 0.5] }) },
          ],
        },
      ]}
    />
  );
}

// A finished kit card: greyed out with a large check that pops in, then fades as the card folds (Collapse closeDelay).
export const DONE_HOLD_MS = 1100;
export function DoneOverlay() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    spring(v, 1, { bouncy: true });
    const id = setTimeout(() => spring(v, 0), DONE_HOLD_MS);
    return () => clearTimeout(id);
  }, [v]);
  return (
    <Animated.View testID="kit-done" pointerEvents="none" aria-hidden style={[styles.overlay, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
      <Animated.View style={[styles.badge, { transform: [{ scale: v }] }]}>
        <Icon name="check" size={44} color={colors.surface} weight={3} />
      </Animated.View>
    </Animated.View>
  );
}

export const SPARK = 10;
const styles = StyleSheet.create({
  spark: { position: 'absolute', left: -SPARK / 2, top: -SPARK / 2, width: SPARK, height: SPARK, borderRadius: SPARK / 2, backgroundColor: colors.success },
  overlay: { ...StyleSheet.absoluteFill, borderRadius: 18, backgroundColor: colors.veil, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(15,94,87,0.28)' },
});

