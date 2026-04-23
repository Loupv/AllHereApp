import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

/**
 * Full-bleed radial background.
 *
 * A violet accent glow at the centre of the viewport fades out to the
 * app's deep-blue bg at the edges. The whole gradient slowly pulses —
 * scale 1 ↔ 1.06 on a ~10 s sine — so the backdrop feels alive without
 * ever looping a hard animation. Scaling the Svg keeps the edges fully
 * covered (the Rect is 100 % wide/tall) while only the gradient centre
 * appears to breathe.
 */
export function AnimatedGradient({ children }: { children?: React.ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.value * 0.06 }],
  }));

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, breathStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient
              id="ah-start-radial"
              cx="50%"
              cy="50%"
              r="75%"
              gradientUnits="objectBoundingBox"
            >
              {/* Violet accent at the heart */}
              <Stop offset="0%" stopColor="#9E3694" stopOpacity="0.85" />
              {/* Deeper magenta bridge so the transition to blue is smooth */}
              <Stop offset="45%" stopColor="#3C1742" stopOpacity="0.95" />
              {/* App bg at the edges */}
              <Stop offset="100%" stopColor="#000823" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#ah-start-radial)" />
        </Svg>
      </Animated.View>
      {/* Fallback solid bg behind the scaled svg so the corners stay
          blue during the +6 % scale extent */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000823', zIndex: -1 }]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#000823' },
});
