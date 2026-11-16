import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { Icon } from './Icon';
import { glide, spring } from '../motion';
import { colors } from '../theme';

// A green spark flying out from behind a checked box (it fades and grows in over the box) into the progress bar. All in page coordinates.
// targetY is live (it follows scrolling), so a spark still lands on the bar if the user scrolls mid-flight.
export type Spark = { id: number; x: number; y: number; tx: number; targetY: Animated.AnimatedNode; delay: number; dx: number; dy: number };

// Like game XP: the sparks pop out in a little fan, hang a beat, then curve in faster and faster to the bar.
const FLIGHT_MS = 1000;
// When the first spark reaches the bar (the plan starts filling it then).
export const SPARK_LAND_MS = FLIGHT_MS - 100;
export function SparkDot({ spark, onDone }: { spark: Spark; onDone: (id: number) => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Native driver: targetY shares headerShown with the plan's strip, which runs natively, so a JS animation here throws on phones.
    const id = setTimeout(() => glide(t, 1, FLIGHT_MS, () => onDone(spark.id)), spark.delay);
    return () => clearTimeout(id);
    // Runs once per spark; onDone is a new function each render.
  }, [t, spark]);
  // The fan-out, gone again by the time the pull is under way.
  const burst = (d: number) => t.interpolate({ inputRange: [0, 0.08, 0.22, 0.6], outputRange: [0, d * 0.75, d, 0], extrapolate: 'clamp' });
  // Progress toward the bar. Height leads width, so the path bends (up first, then across); both speed up at the end.
  const py = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 0, 0.3, 0.68, 1] });
  const px = [0, 0, 0.08, 0.3, 1];
  // y = start + (target - start) * py, written so the live target can be an Animated node.
  const top = Animated.add(
    Animated.add(py.interpolate({ inputRange: [0, 1], outputRange: [spark.y, 0] }), Animated.multiply(spark.targetY, py)),
    burst(spark.dy),
  );
  const left = Animated.add(
    t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: px.map((p) => spark.x + (spark.tx - spark.x) * p) }),
    burst(spark.dx),
  );
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={[
        styles.spark,
        {
          opacity: t.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: left },
            { translateY: top },
            { scale: t.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0.3, 1.3, 1, 0.5] }) },
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

