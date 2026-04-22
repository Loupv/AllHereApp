import { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native';

/**
 * Slow-breathing ring used as a decorative, meditative signal in the hero.
 * A single outlined circle that pulses in / out on a 4s-in / 4s-out cycle
 * roughly matching a relaxed breath. No fill, no color dependency — the
 * ring colour is driven by the `color` prop.
 */
export function BreathingRing({
  size = 220,
  color = '#ffffff',
  thickness = 1.5,
  inMs = 4000,
  outMs = 4000,
  minScale = 0.82,
  maxScale = 1.04,
  minOpacity = 0.12,
  maxOpacity = 0.5,
}: {
  size?: number;
  color?: string;
  thickness?: number;
  inMs?: number;
  outMs?: number;
  minScale?: number;
  maxScale?: number;
  minOpacity?: number;
  maxOpacity?: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: inMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: outMs, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: minScale + (maxScale - minScale) * t.value }],
    opacity: minOpacity + (maxOpacity - minOpacity) * t.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: thickness,
        },
        ringStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
  },
});
