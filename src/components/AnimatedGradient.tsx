import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

type Props = {
  /** 0..1 horizontal position of the radial centre — default 0.5 */
  centerX?: number;
  /** 0..1 vertical position of the radial centre — default 0.5 */
  centerY?: number;
  children?: React.ReactNode;
};

/**
 * Full-bleed radial background.
 *
 * A violet glow fades out to the app's deep-blue bg at the edges. The
 * centre position is configurable (callers typically pass the vertical
 * position of a focal element, e.g. the big play button on Start). The
 * whole gradient slowly scales 1 ↔ 1.06 on a ~10 s sine so the glow
 * appears to breathe.
 */
export function AnimatedGradient({ centerX = 0.5, centerY = 0.5, children }: Props) {
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

  const cx = `${Math.max(0, Math.min(1, centerX)) * 100}%`;
  const cy = `${Math.max(0, Math.min(1, centerY)) * 100}%`;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, breathStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient
              id="ah-start-radial"
              cx={cx}
              cy={cy}
              // Contained radius so the violet stays local to the play
              // button instead of bleeding all over the page.
              r="70%"
              gradientUnits="objectBoundingBox"
            >
              {/* Subtle violet halo at the heart (low opacity so the app's
                  deep blue still dominates). */}
              <Stop offset="0%" stopColor="#9E3694" stopOpacity="0.45" />
              {/* Quick transition back to the app's deep blue */}
              <Stop offset="35%" stopColor="#1B1846" stopOpacity="0.8" />
              <Stop offset="70%" stopColor="#05112E" stopOpacity="1" />
              <Stop offset="100%" stopColor="#000823" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#ah-start-radial)" />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#000823' },
});
