import { useEffect } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, type } from '../theme';

export type BigPlayMode = 'one' | 'three' | 'qm3';

type Props = {
  mode: BigPlayMode;
  label: string;
  sublabel?: string;
  size: number;
  onPress: () => void;
};

/**
 * Oversized minimalist play button for the Start screen. Pure SVG rings —
 * no bitmap, no solid fill — so the animated gradient behind shows through.
 *
 * - 'one'  (1 min)   : a single thin ring
 * - 'three' (3 min)  : one thin outer ring + one thicker inner ring
 * - 'qm3'  (3×3 min) : three stacked concentric rings, hinting at the three
 *                       rounds of a QM session
 *
 * A slow breathing pulse on the whole SVG keeps the button alive without
 * being agitated.
 */
export function BigPlayButton({ mode, label, sublabel, size, onPress }: Props) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.014 }],
  }));

  const center = size / 2;
  const stroke = 1.4;
  const outerR = center - stroke;
  // Per-mode ring configuration
  const rings =
    mode === 'one'
      ? [{ r: outerR, w: 1.4, alpha: 0.85 }]
      : mode === 'three'
        ? [
            { r: outerR, w: 1, alpha: 0.5 },
            { r: outerR - 14, w: 2, alpha: 0.95 },
          ]
        : [
            { r: outerR, w: 1, alpha: 0.4 },
            { r: outerR - 12, w: 1.2, alpha: 0.6 },
            { r: outerR - 24, w: 1.6, alpha: 0.9 },
          ];

  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
      <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, pulseStyle]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {rings.map((r, i) => (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={r.r}
              stroke={`rgba(255,255,255,${r.alpha})`}
              strokeWidth={r.w}
              fill="transparent"
            />
          ))}
        </Svg>
        <View style={styles.inner}>
          <Text style={[styles.playGlyph, { fontSize: Math.round(size * 0.14) }]}>▶</Text>
          <Text style={styles.label}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  playGlyph: { color: colors.text, marginLeft: 4, marginBottom: 4, opacity: 0.95 },
  label: { ...type.overline, color: colors.text, fontSize: 11, letterSpacing: 2.5, textAlign: 'center' },
  sublabel: { ...type.caption, color: colors.textMuted, fontSize: 10, textAlign: 'center' },
});
