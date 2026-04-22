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
      {/* Layer A — always visible, deep blue → magenta (Silent Mind tint) */}
      <LinearGradient
        colors={['#000823', '#1B2F5A', '#6F1F68', '#9E3694']}
        locations={[0, 0.4, 0.8, 1]}
        start={[0.1, 0]}
        end={[0.9, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Layer B — fades in/out, swaps the warm tones for QM teal */}
      <AniGradient
        colors={['#000823', '#0F3A44', '#1F6F6E', '#36A09E']}
        locations={[0, 0.4, 0.8, 1]}
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
