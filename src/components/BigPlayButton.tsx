import { useEffect } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withDelay, Easing, interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, type } from '../theme';

export type BigPlayMode = 'one' | 'three' | 'qm3';

type Props = {
  mode: BigPlayMode;
  /** Optional label rendered inside the inner ring next to the play glyph */
  label?: string;
  size: number;
  onPress: () => void;
};

/**
 * Oversized minimalist play button for the Start screen.
 *
 * Visuals per mode:
 *
 *   'one' (60 s)
 *     – single inner ring
 *     – clearly visible breathing scale (±5 %)
 *
 *   'three' (3 min)
 *     – inner ring (static)
 *     – two ripples emanating out of it on staggered phases, growing to
 *       the outer radius while fading
 *
 *   'qm3' (3 × 3 min)
 *     – inner ring breathing (mode 1)
 *     – ripples emanating (mode 2)
 *     – dashed outer ring slowly orbiting (pre-existing behaviour)
 *
 * The inner ring is wider than before so the label text actually fits
 * inside it regardless of mode.
 */
export function BigPlayButton({ mode, label, size, onPress }: Props) {
  // ---- breath (inner ring scale) — used in modes 'one' and 'qm3' ----
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

  // ---- two ripples emanating from the inner ring — used in 'three' and 'qm3' ----
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  useEffect(() => {
    ripple1.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.out(Easing.cubic) }),
      -1, false,
    );
    // Second ripple is offset by half a period so the output feels continuous
    ripple2.value = withDelay(
      1600,
      withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.out(Easing.cubic) }),
        -1, false,
      ),
    );
  }, []);

  // ---- outer ring orbit (only 'qm3') ----
  const orbit = useSharedValue(0);
  useEffect(() => {
    orbit.value = withRepeat(withTiming(1, { duration: 48000, easing: Easing.linear }), -1, false);
  }, []);

  // ---- sweep highlight on the inner ring ('qm3') ----
  // A bright short arc travels around the inner ring, like a meditation
  // 'tracker' rotating over time. Slower than the outer orbit so the two
  // motions don't feel synchronised.
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
  }, []);

  // ---- per-mode masks to turn animations on/off smoothly ----
  //
  // New mapping (per user request): ripples are the loudest visual and
  // belong to the entry-level mode so the 60 s button already feels
  // alive. Breath moves to mode 'three' (slightly calmer, matches the
  // meditative 3-minute intent). 'qm3' still combines everything and
  // gains a sweep highlight as its own signature:
  //   'one'   → ripples
  //   'three' → breath
  //   'qm3'   → ripples + breath + dashed orbit + sweep
  const breathActive = useSharedValue(mode === 'three' || mode === 'qm3' ? 1 : 0);
  const rippleActive = useSharedValue(mode === 'one'   || mode === 'qm3' ? 1 : 0);
  const orbitActive  = useSharedValue(mode === 'qm3' ? 1 : 0);
  const sweepActive  = useSharedValue(mode === 'qm3' ? 1 : 0);
  useEffect(() => {
    breathActive.value = withTiming(mode === 'three' || mode === 'qm3' ? 1 : 0, { duration: 500 });
    rippleActive.value = withTiming(mode === 'one'   || mode === 'qm3' ? 1 : 0, { duration: 500 });
    orbitActive.value  = withTiming(mode === 'qm3' ? 1 : 0, { duration: 500 });
    sweepActive.value  = withTiming(mode === 'qm3' ? 1 : 0, { duration: 500 });
  }, [mode]);

  // ---- geometry ----
  // Wider inner ring so labels actually fit inside regardless of case /
  // line count. Ripples start at innerR and grow to outerR.
  const innerR = size * 0.40;
  const outerR = size * 0.49;
  const rippleScaleMax = outerR / innerR;
  const stroke = 1.4;

  // ---- animated styles ----
  const innerStyle = useAnimatedStyle(() => {
    // When the breath is active, the inner ring not only scales a touch
    // but also fades in and out — opacity 0.45 at the bottom of the
    // exhale, back to 1 at the top of the inhale. The opacity sweep makes
    // the breathing read far more clearly than the scale alone.
    const breathOpacity = 0.45 + breath.value * 0.55;
    const opacity = 1 - (1 - breathOpacity) * breathActive.value;
    return {
      opacity,
      transform: [{ scale: 1 + breath.value * 0.07 * breathActive.value }],
    };
  });
  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.04 * breathActive.value }],
  }));
  const makeRippleStyle = (r: SharedValue<number>) => useAnimatedStyle(() => ({
    opacity: interpolate(r.value, [0, 1], [0.55, 0]) * rippleActive.value,
    transform: [{ scale: interpolate(r.value, [0, 1], [1, rippleScaleMax]) }],
  }));
  const ripple1Style = makeRippleStyle(ripple1);
  const ripple2Style = makeRippleStyle(ripple2);
  const orbitStyle = useAnimatedStyle(() => ({
    opacity: orbitActive.value * 0.85,
    transform: [{ rotate: `${orbit.value * 360 * orbitActive.value}deg` }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweepActive.value,
    transform: [{ rotate: `${sweep.value * 360 * sweepActive.value}deg` }],
  }));
  // Short arc ≈ 8 % of the inner ring's circumference lit up; the rest is
  // transparent. Combined with a 360° rotation it looks like a meditation
  // tracker sweeping around the ring.
  const innerCircumference = 2 * Math.PI * innerR;
  const sweepArc = innerCircumference * 0.08;

  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer dashed ring (orbit) — mode 'qm3' */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, orbitStyle]} pointerEvents="none">
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

        {/* Ripple 2 (offset phase) */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, ripple2Style]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={innerR}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={stroke}
              fill="transparent"
            />
          </Svg>
        </Animated.View>

        {/* Ripple 1 */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, ripple1Style]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={innerR}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={stroke}
              fill="transparent"
            />
          </Svg>
        </Animated.View>

        {/* Inner ring — always drawn; breathes in modes 'three' / 'qm3' */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, innerStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={innerR}
              stroke="rgba(255,255,255,0.95)"
              strokeWidth={stroke * 1.5}
              fill="transparent"
            />
          </Svg>
        </Animated.View>

        {/* Sweep highlight — a bright short arc rotating around the inner
            ring; only in 'qm3'. Sits above the static ring and fades in
            via the sweep mask. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, sweepStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={innerR}
              stroke={colors.accent}
              strokeWidth={stroke * 2}
              strokeLinecap="round"
              strokeDasharray={`${sweepArc} ${innerCircumference}`}
              fill="transparent"
              // Start the dash at the top (‑90°) so rotation reads
              // clockwise from 12 o'clock.
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
        </Animated.View>

        {/* Play glyph (+ optional label) — breathes with the inner ring */}
        <Animated.View style={[styles.inner, { maxWidth: innerR * 1.75 }, textStyle]}>
          <Text style={[styles.playGlyph, { fontSize: Math.round(size * 0.18) }]}>▶</Text>
          {label ? <Text style={styles.label} numberOfLines={3}>{label}</Text> : null}
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
    paddingHorizontal: 6,
  },
  playGlyph: { color: colors.text, marginLeft: 3, marginBottom: 2, opacity: 0.95 },
  // textTransform:'none' so mixed-case labels ('QM Format / 3 × 3 min')
  // render as authored rather than being force-uppercased.
  label: { ...type.overline, color: colors.text, fontSize: 14, letterSpacing: 1.4, textAlign: 'center', lineHeight: 18, textTransform: 'none' },
});
