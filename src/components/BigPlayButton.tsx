import { useEffect } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withDelay, Easing, interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
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
 *   'one' (60 s) — the **organic / living** mode used on Start
 *     – inner ring breathes (scale + opacity)
 *     – inner glow pulses on its own slower phase, so the button
 *       feels alive rather than mechanically synced
 *     – play glyph drifts with a tiny rotation sway
 *     – two ripples emanate outward on staggered phases
 *
 *   'three' (3 min)
 *     – inner ring breathes
 *     – outer ring of dots slowly orbiting (pre-existing behaviour)
 *
 *   'qm3' (3 × 3 min)
 *     – inner ring breathes
 *     – ripples emanate
 *     – dashed outer ring slowly orbiting
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

  // ---- glow pulse — slow asymmetric pulse on the inward gradient.
  //      Period (5.4 s) is intentionally not a divisor of the breath
  //      period (7.2 s) so the two beats drift in and out of phase, which
  //      reads as alive rather than metronomic. ----
  const glowPulse = useSharedValue(0);
  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);

  // ---- sway — a very small rotation oscillation (±1.6°) on the play
  //      glyph, with a long period (~9 s) so the motion is felt without
  //      ever being noticed. Adds the last bit of organic life. ----
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(
      withSequence(
        withTiming(1,  { duration: 4500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 4500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);

  // ---- per-mode masks to turn animations on/off smoothly ----
  //
  //   'one'   → breath + ripples + glow pulse + sway   (organic)
  //   'three' → breath + outer ring with orbiting dots
  //   'qm3'   → breath + ripples + outer ring with orbiting dashes
  //
  // Breath is now on for every mode — it's the spine of the button's
  // life. Mode-specific layers (ripples, glow pulse, sway, orbit
  // textures) stack on top.
  const breathActive = useSharedValue(1);
  const rippleActive = useSharedValue(mode === 'one' || mode === 'qm3' ? 1 : 0);
  const glowActive   = useSharedValue(mode === 'one' ? 1 : 0);
  const swayActive   = useSharedValue(mode === 'one' ? 1 : 0);
  const dotsActive   = useSharedValue(mode === 'three' ? 1 : 0);
  const dashesActive = useSharedValue(mode === 'qm3' ? 1 : 0);
  useEffect(() => {
    breathActive.value = withTiming(1, { duration: 500 });
    rippleActive.value = withTiming(mode === 'one' || mode === 'qm3' ? 1 : 0, { duration: 500 });
    glowActive.value   = withTiming(mode === 'one' ? 1 : 0, { duration: 500 });
    swayActive.value   = withTiming(mode === 'one' ? 1 : 0, { duration: 500 });
    dotsActive.value   = withTiming(mode === 'three' ? 1 : 0, { duration: 500 });
    dashesActive.value = withTiming(mode === 'qm3' ? 1 : 0, { duration: 500 });
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
    // Play glyph rides the breath (slight scale) and adds a sub-degree
    // rotational sway in mode 'one' so the button never sits perfectly
    // still — the kind of motion you feel before you see it.
    transform: [
      { scale: 1 + breath.value * 0.04 * breathActive.value },
      { rotate: `${sway.value * 1.6 * swayActive.value}deg` },
    ],
  }));
  // Glow pulse — wraps just the gradient layer so the inner ring
  // stroke keeps its own breathing rhythm. Opacity drifts between
  // ~0.55 and 1 of the static glow, scaled in only when the glow is
  // active (mode 'one').
  const glowStyle = useAnimatedStyle(() => {
    const pulse = 0.55 + glowPulse.value * 0.45;
    return {
      opacity: 1 - (1 - pulse) * glowActive.value,
      // A breath of scale on the glow itself — 1.5% — adds depth that
      // reads more as a living halo than a fixed gradient.
      transform: [{ scale: 1 + glowPulse.value * 0.015 * glowActive.value }],
    };
  });
  const makeRippleStyle = (r: SharedValue<number>) => useAnimatedStyle(() => ({
    opacity: interpolate(r.value, [0, 1], [0.55, 0]) * rippleActive.value,
    transform: [{ scale: interpolate(r.value, [0, 1], [1, rippleScaleMax]) }],
  }));
  const ripple1Style = makeRippleStyle(ripple1);
  const ripple2Style = makeRippleStyle(ripple2);
  // Shared rotation applied to whichever outer-ring texture is visible.
  // The opacity mask picks which of the two layers shows up.
  const dotsStyle = useAnimatedStyle(() => ({
    opacity: dotsActive.value * 0.85,
    transform: [{ rotate: `${orbit.value * 360 * dotsActive.value}deg` }],
  }));
  const dashesStyle = useAnimatedStyle(() => ({
    opacity: dashesActive.value * 0.85,
    transform: [{ rotate: `${orbit.value * 360 * dashesActive.value}deg` }],
  }));

  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer ring — dots — mode 'three'. pathLength normalises the
            circle perimeter so the dots distribute evenly regardless of
            size. Without it the circumference rarely divides cleanly by
            the dash period, leaving two dots "glued" together at the
            seam where the circle closes. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, dotsStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={outerR}
              stroke="rgba(232,234,240,0.62)"
              strokeWidth={stroke * 1.6}
              pathLength={60}
              strokeDasharray="0.01 1.99"
              strokeLinecap="round"
              fill="transparent"
            />
          </Svg>
        </Animated.View>

        {/* Outer ring — dashes — mode 'qm3'. Same pathLength trick to
            keep the dashes evenly distributed around the full ring. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, dashesStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={outerR}
              stroke="rgba(232,234,240,0.55)"
              strokeWidth={stroke}
              pathLength={60}
              strokeDasharray="1.5 1.5"
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
              stroke="rgba(232,234,240,0.68)"
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
              stroke="rgba(232,234,240,0.68)"
              strokeWidth={stroke}
              fill="transparent"
            />
          </Svg>
        </Animated.View>

        {/* Soft inward glow — the radial gradient sits in its own
            animated layer so it can pulse on a different phase than
            the inner ring. Opacity fades from the rim toward the
            centre, giving depth without competing with the glyph. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, glowStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient
                id="bigPlayGlow"
                cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%"
              >
                <Stop offset="0%"  stopColor="#E8EAF0" stopOpacity={0} />
                <Stop offset="55%" stopColor="#E8EAF0" stopOpacity={0.04} />
                <Stop offset="92%" stopColor="#E8EAF0" stopOpacity={0.18} />
                <Stop offset="100%" stopColor="#E8EAF0" stopOpacity={0.28} />
              </RadialGradient>
            </Defs>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={innerR - stroke * 0.75}
              fill="url(#bigPlayGlow)"
            />
          </Svg>
        </Animated.View>

        {/* Inner ring stroke — always drawn, breathes with the breath
            shared value. Sits above the glow so the ring outlines the
            halo cleanly. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, innerStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={innerR}
              stroke="rgba(232,234,240,0.78)"
              strokeWidth={stroke * 1.5}
              fill="transparent"
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
  // textTransform:'none' so mixed-case labels ('QM Training / 3 × 3 min')
  // render as authored rather than being force-uppercased.
  label: { ...type.overline, color: colors.text, fontSize: 14, letterSpacing: 1.4, textAlign: 'center', lineHeight: 18, textTransform: 'none' },
});
