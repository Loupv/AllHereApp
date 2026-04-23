import { useEffect } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing, interpolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, type } from '../theme';

export type BigPlayMode = 'one' | 'three' | 'qm3';

type Props = {
  mode: BigPlayMode;
  label: string;
  size: number;
  onPress: () => void;
};

/**
 * Oversized minimalist play button for the Start screen.
 *
 * Layout: the text lives inside a fixed inner radius; extra rings grow
 * *outward* when the user picks a longer mode, so the text area stays
 * quiet. Three distinct slow motions keep it alive:
 *
 *   - inner ring : gentle breathing scale
 *   - middle ring: opacity pulse on an offset phase
 *   - outer ring : very slow rotation with a dashed stroke so the dashes
 *                  appear to orbit
 *
 * Each ring also fades in / out when it enters / leaves the current mode.
 */
export function BigPlayButton({ mode, label, size, onPress }: Props) {
  // ---- global breathing cue on the inner ring (also scales the text area) ----
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);

  // ---- opacity pulse for the middle ring (offset phase) ----
  const softPulse = useSharedValue(0);
  useEffect(() => {
    softPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);

  // ---- outer ring orbit (continuous slow rotation) ----
  const orbit = useSharedValue(0);
  useEffect(() => {
    orbit.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false);
  }, []);

  // ---- per-mode visibility, animated ----
  // Inner ring is always present. Middle ring shows for 'three' and 'qm3'.
  // Outer ring shows for 'qm3' only.
  const middleVis = useSharedValue(mode === 'one' ? 0 : 1);
  const outerVis  = useSharedValue(mode === 'qm3' ? 1 : 0);
  useEffect(() => {
    middleVis.value = withTiming(mode === 'one' ? 0 : 1, { duration: 500, easing: Easing.out(Easing.cubic) });
    outerVis.value  = withTiming(mode === 'qm3' ? 1 : 0, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [mode]);

  // ---- per-mode motion masks ----
  // 60s   → only the inner ring breathes
  // 3min  → only the middle ring pulses (inner sits still)
  // 3×3m  → all three motions combine
  const breathActive = useSharedValue(mode === 'one' || mode === 'qm3' ? 1 : 0);
  const pulseActive  = useSharedValue(mode === 'three' || mode === 'qm3' ? 1 : 0);
  const orbitActive  = useSharedValue(mode === 'qm3' ? 1 : 0);
  useEffect(() => {
    breathActive.value = withTiming(mode === 'one' || mode === 'qm3' ? 1 : 0, { duration: 500 });
    pulseActive.value  = withTiming(mode === 'three' || mode === 'qm3' ? 1 : 0, { duration: 500 });
    orbitActive.value  = withTiming(mode === 'qm3' ? 1 : 0, { duration: 500 });
  }, [mode]);

  // ---- geometry ----
  // Inner ring stays at a fixed modest radius so the text area keeps its
  // size across modes. Outer rings grow outward when they appear.
  const innerR  = size * 0.34;
  const middleR = size * 0.42;
  const outerR  = size * 0.49;
  const stroke = 1.4;

  // ---- animated styles for each ring wrapper ----
  const innerStyle = useAnimatedStyle(() => ({
    // Breath only applies when breathActive=1; when inactive the ring is still.
    transform: [{ scale: 1 + breath.value * 0.025 * breathActive.value }],
  }));
  const middleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      middleVis.value,
      [0, 1],
      // Base opacity 0.35; the 0.55-wide pulse only fires when pulseActive=1.
      [0, 0.35 + softPulse.value * 0.55 * pulseActive.value],
    ),
    transform: [{ scale: interpolate(middleVis.value, [0, 1], [0.82, 1]) }],
  }));
  const outerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(outerVis.value, [0, 1], [0, 0.85]),
    transform: [
      // Rotation disappears when orbitActive=0, so the dashed ring just sits
      // on its last angle rather than endlessly spinning under a hidden layer.
      { rotate: `${orbit.value * 360 * orbitActive.value}deg` },
      { scale: interpolate(outerVis.value, [0, 1], [0.82, 1]) },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.02 * breathActive.value }],
  }));

  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer ring — dashed, slow rotation */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, outerStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={outerR}
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={stroke}
              strokeDasharray="6 14"
              strokeLinecap="round"
              fill="transparent"
            />
          </Svg>
        </Animated.View>

        {/* Middle ring — opacity pulse */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, middleStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={middleR}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={stroke * 1.2}
              fill="transparent"
            />
          </Svg>
        </Animated.View>

        {/* Inner ring — breathing scale, always present */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, innerStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={innerR}
              stroke="rgba(255,255,255,0.95)"
              strokeWidth={stroke * 1.4}
              fill="transparent"
            />
          </Svg>
        </Animated.View>

        {/* Text block */}
        <Animated.View style={[styles.inner, textStyle]}>
          <Text style={[styles.playGlyph, { fontSize: Math.round(size * 0.11) }]}>▶</Text>
          <Text style={styles.label}>{label}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  center: { alignItems: 'center', justifyContent: 'center' },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
  playGlyph: { color: colors.text, marginLeft: 3, marginBottom: 2, opacity: 0.95 },
  // Don't force uppercase — the label may mix cases on purpose
  // (e.g. 'QM Format\n3 × 3 min'); each call site decides.
  label: { ...type.overline, color: colors.text, fontSize: 11, letterSpacing: 2.2, textAlign: 'center', lineHeight: 14, textTransform: 'none' },
});
