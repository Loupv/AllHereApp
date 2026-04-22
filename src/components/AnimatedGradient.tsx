import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const AniGradient = Animated.createAnimatedComponent(LinearGradient as any) as any;

/**
 * Slow-morphing full-bleed background gradient. Two layered LinearGradients
 * cross-fade on a ~16 s loop — layer A (deep blue → magenta) and layer B
 * (deep blue → teal) take turns dominating, so the hero reads as calm and
 * alive without looping a hard animation.
 *
 * Pure decoration: pointerEvents=none and positioned absolutely so it sits
 * behind whatever is laid on top.
 */
export function AnimatedGradient({ children }: { children?: React.ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);

  const layerB = useAnimatedStyle(() => ({ opacity: t.value }));

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Layer A — blue → violet → red running one way */}
      <LinearGradient
        colors={['#0B1A4A', '#3A2568', '#7A2D91', '#A92C58', '#8B1A2B']}
        locations={[0, 0.28, 0.55, 0.82, 1]}
        start={[0.1, 0]}
        end={[0.9, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Layer B — same palette rotated, cross-fades in and out so the sky
          feels like it's slowly shifting without ever looping a hard frame */}
      <AniGradient
        colors={['#081236', '#5C2D6E', '#B5356A', '#C23B4B', '#5C0F1F']}
        locations={[0, 0.3, 0.6, 0.85, 1]}
        start={[0.9, 0]}
        end={[0.1, 1]}
        style={[StyleSheet.absoluteFill, layerB]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
