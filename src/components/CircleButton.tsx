import { useEffect } from 'react';
import { AppState, Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, withDelay, Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, type } from '../theme';

type Mode = 'pre' | 'playing' | 'paused' | 'break';

type Props = {
  mode: Mode;
  onPress?: () => void;
  breakProgress?: number;
  breakLabel?: string;
  size?: number;
  /** Tint — defaults to the main magenta accent. Pass colors.accentAlt for QM */
  accent?: string;
  /**
   * Optional voice level 0..1 — typically the precomputed waveform peak
   * sampled at the current playback time. Drives a gentle scale + glow
   * boost on top of the muted breath when `mode === 'playing'`, so the
   * button visibly responds to the audio. Updates are damped via
   * `withTiming` so caller-side smoothing is not required.
   */
  voice?: number;
  /**
   * Optional content rendered inside the ring instead of the
   * mode-driven glyph (▶ / pause bars / break timer). Used by the
   * Start screen to fit eyebrow + title + duration text inside the
   * same ring shell, so the button visually morphs into the Player's
   * play/pause button at the same screen position.
   */
  customContent?: React.ReactNode;
};

/**
 * Player play / pause button.
 *
 * Visual language mirrors the Start screen's `BigPlayButton`:
 *   – thin outlined inner ring (no flat-colour disc anymore)
 *   – soft inward radial-gradient glow tinted with the program accent
 *     (magenta for SM, teal for QM)
 *   – breath + glow-pulse + sway animations layered on slightly
 *     different periods so the button reads as living, not metronomic
 *
 * Mode behaviour:
 *   – `pre`     full breath / glow / sway intensity (waiting for tap)
 *   – `playing` muted breath, no sway (the audio itself is the motion)
 *   – `paused`  static, ring at full opacity
 *   – `break`   dashed progress arc replaces the inner ring, glow off
 */
export function CircleButton({ mode, onPress, breakProgress = 0, breakLabel, size = 112, accent = colors.accent, voice = 0, customContent }: Props) {
  // ---- shared animation values ---------------------------------------
  const breath = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const sway = useSharedValue(0);
  // Expanding ripple ring (0..1 ramp). Same shape as SM tree
  // CircleNode.ripple so the rhythm matches across the app.
  const ripple = useSharedValue(0);

  // Mode masks — fade animations in/out smoothly when the mode changes
  // rather than snapping. `pre` runs full intensity, `playing` runs
  // muted, anything else stops the motion entirely.
  const breathActive = useSharedValue(0);
  const glowActive   = useSharedValue(0);
  const swayActive   = useSharedValue(0);
  // Ripple visibility — runs only in `pre` (waiting-for-tap) mode.
  // Other modes fade it out smoothly via the rippleActive mask.
  const rippleActive = useSharedValue(0);

  // Voice envelope — caller passes a raw peak (0..1), we damp toward it
  // here so the button doesn't twitch on every status tick. Only applies
  // while playing; clamped to 0 in other modes through `voiceActive`.
  const voiceSV     = useSharedValue(0);
  const voiceActive = useSharedValue(0);

  useEffect(() => {
    // The withRepeat(-1) loops below run on the UI / reanimated worklet
    // thread, which counts toward iOS's background CPU watchdog (48 s
    // of CPU per 60 s). Four simultaneous looped sin tweens were a
    // measurable share of the ~89 % background CPU that jetsam'd us
    // around the 45-s mark while QM audio was streaming. We start them
    // only while the app is foreground, cancel them on background, and
    // restart on resume.
    const start = () => {
      // Use the reverse=true mode of withRepeat so each cycle is one
      // continuous tween (0 → 1 → 0 → 1…) instead of two separate
      // withTiming legs glued by withSequence. The withSequence form
      // had a subtly visible discontinuity at the loop boundary —
      // every other cycle's first leg started from a different value
      // than the prior cycle ended at, producing a tiny "snap". The
      // reverse-loop variant always carries the same animation factory
      // forward, with reanimated handling the bounce between cycles
      // on the worklet thread.
      breath.value = withRepeat(
        withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
      glowPulse.value = withRepeat(
        withTiming(1, { duration: 2700, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
      // Sway oscillates around 0; -1 → +1 is twice the swing of breath.
      // Start at -1 so the bounce stays symmetric (otherwise the first
      // cycle's range was 0 → +1 → -1 → +1 — visibly faster than later
      // cycles).
      sway.value = -1;
      sway.value = withRepeat(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
      // Expanding ripple ring — same rhythm as the SM tree CircleNode's
      // ripple so the Start play button reads as part of the same
      // family of "available, tap me" cues. Cycle: invisible reset (1 ms)
      // → expand 0→1 over 2800 ms (ring grows + fades) → 2 s hold so
      // emanations feel like deliberate exhales rather than a continuous
      // chain.
      ripple.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1 }),
          withTiming(1, { duration: 2800, easing: Easing.out(Easing.quad) }),
          withDelay(2000, withTiming(1, { duration: 1 })),
        ),
        -1, false,
      );
    };
    const stop = () => {
      cancelAnimation(breath);
      cancelAnimation(glowPulse);
      cancelAnimation(sway);
      cancelAnimation(ripple);
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') start();
      else stop();
    });
    return () => { stop(); sub.remove(); };
  }, []);

  useEffect(() => {
    // 'pre' = full life, 'playing' = subtle, others = still.
    const intensity =
      mode === 'pre'     ? 1
      : mode === 'playing' ? 0.45
      : 0;
    breathActive.value = withTiming(intensity, { duration: 500 });
    glowActive.value   = withTiming(mode === 'break' ? 0 : intensity > 0 ? 1 : 0.6, { duration: 500 });
    swayActive.value   = withTiming(mode === 'pre' ? 1 : 0, { duration: 500 });
    voiceActive.value  = withTiming(mode === 'playing' ? 1 : 0, { duration: 500 });
    rippleActive.value = withTiming(mode === 'pre' ? 1 : 0, { duration: 500 });
  }, [mode]);

  // Damp incoming voice samples — peaks are ~50 ms-resolved (see
  // scripts/gen-waveforms.mjs at PEAKS_PER_SECOND = 20), but the
  // status tick that drives `voice` updates lands every ~100 ms.
  // 180 ms gives enough headroom that consecutive samples blend
  // through a single in-flight withTiming instead of strobing — the
  // previous 90 ms window often saw a fresh tween cancel its
  // predecessor mid-flight, which read as micro-jitter on the ring.
  useEffect(() => {
    voiceSV.value = withTiming(Math.max(0, Math.min(1, voice)), { duration: 180 });
  }, [voice]);

  // ---- geometry ------------------------------------------------------
  const innerR = size * 0.46;
  const stroke = Math.max(1.5, size * 0.018);
  // Break-mode progress arc geometry — matches the inner ring's radius
  // so the dashed arc draws on top of it.
  const arcR = innerR;
  const circumference = 2 * Math.PI * arcR;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, breakProgress)));

  // ---- animated styles ----------------------------------------------
  const ringStyle = useAnimatedStyle(() => {
    // Ring scales (±5%) and fades (1 → 0.55) with the breath, gated by
    // the active mask so playback / pause states sit nearly still. While
    // playing, the voice envelope adds up to +6% scale on top so the
    // ring visibly swells with louder passages.
    const breathOpacity = 0.55 + breath.value * 0.45;
    const opacity = 1 - (1 - breathOpacity) * breathActive.value;
    const voiceBoost = voiceSV.value * voiceActive.value;
    return {
      opacity,
      transform: [{
        scale: 1
          + breath.value * 0.05 * breathActive.value
          + voiceBoost * 0.06,
      }],
    };
  });
  const glowStyle = useAnimatedStyle(() => {
    const pulse = 0.55 + glowPulse.value * 0.45;
    const voiceBoost = voiceSV.value * voiceActive.value;
    return {
      // Voice lifts the glow opacity and widens the halo, so loud
      // moments noticeably brighten the button.
      opacity: (1 - (1 - pulse) * breathActive.value) * glowActive.value
        + voiceBoost * 0.35 * voiceActive.value,
      transform: [{
        scale: 1
          + glowPulse.value * 0.02 * breathActive.value
          + voiceBoost * 0.10,
      }],
    };
  });
  // Expanding ripple ring style — scale 1 → 1.4, opacity 0.40 → 0,
  // following the `ripple` 0..1 ramp. Dialled back from the SM tree's
  // intensity because the Start ring is much larger (a strong ripple
  // on a 100+ px circle dominates the screen). Gated by `rippleActive`
  // so it only shows in `pre` mode.
  const rippleStyle = useAnimatedStyle(() => {
    const r = ripple.value;
    return {
      opacity: Math.max(0, 0.40 * (1 - r)) * rippleActive.value,
      transform: [{ scale: 1 + 0.4 * r }],
    };
  });

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: 1
          + breath.value * 0.03 * breathActive.value
          + voiceSV.value * voiceActive.value * 0.04,
      },
      { rotate: `${sway.value * 1.4 * swayActive.value}deg` },
    ],
  }));
  const iconForMode = () => {
    if (customContent) return customContent;
    if (mode === 'break') return <Text style={[styles.timer, { color: colors.text }]}>{breakLabel ?? ''}</Text>;
    if (mode === 'playing') return <View style={styles.pauseBars}><View style={styles.pauseBar} /><View style={styles.pauseBar} /></View>;
    return <Text style={styles.play}>▶</Text>;
  };

  // Unique gradient id per render scope so multiple instances on screen
  // don't share defs (the Svg `<Defs>` ids must be unique within an
  // SVG document; React Native renders each Svg as its own document so
  // a stable id is fine).
  const gradId = `cb-glow-${accent.replace('#', '')}`;

  const content = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Inward radial-gradient glow — accent-tinted, fades to fully
          transparent at centre. Sits underneath the ring so the ring
          outlines the halo crisply. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, glowStyle]} pointerEvents="none">
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={gradId} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
              <Stop offset="0%"   stopColor={accent} stopOpacity={0} />
              <Stop offset="55%"  stopColor={accent} stopOpacity={0.06} />
              <Stop offset="92%"  stopColor={accent} stopOpacity={0.30} />
              <Stop offset="100%" stopColor={accent} stopOpacity={0.45} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={innerR - stroke * 0.75}
            fill={`url(#${gradId})`}
          />
        </Svg>
      </Animated.View>

      {/* Expanding ripple ring — same emanation rhythm as the SM
          tree's CircleNode. Sits BEHIND the inner ring so the
          ring crisply outlines the button while a ghost copy of
          itself drifts outward and fades. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, rippleStyle]} pointerEvents="none">
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={innerR}
            stroke={accent}
            strokeWidth={stroke * 1.2}
            fill="transparent"
          />
        </Svg>
      </Animated.View>

      {/* Inner ring — accent-tinted stroke. Hidden in break mode, where
          it's replaced by the progress arc layer below. */}
      {mode !== 'break' ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, ringStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={innerR}
              stroke={accent}
              strokeWidth={stroke * 1.4}
              fill="transparent"
              opacity={0.85}
            />
          </Svg>
        </Animated.View>
      ) : null}

      {/* Break-mode progress arc — neutral track + accent fill that
          sweeps clockwise from the top as `breakProgress` climbs to 1. */}
      {mode === 'break' ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={arcR}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={stroke * 1.4}
              fill="transparent"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={arcR}
              stroke={accent}
              strokeWidth={stroke * 1.4}
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={`${circumference},${circumference}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
        </View>
      ) : null}

      {/* Play / pause / timer glyph — rides the breath + sway like the
          Start button's inner glyph. */}
      <Animated.View style={[styles.glyphWrap, glyphStyle]}>
        {iconForMode()}
      </Animated.View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  glyphWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Slight left-margin compensates the optical asymmetry of the play
  // triangle so it reads as centred inside the ring.
  play: { color: colors.text, fontSize: 32, marginLeft: 5, marginBottom: 1, opacity: 0.95 },
  pauseBars: { flexDirection: 'row', gap: 8 },
  pauseBar: { width: 6, height: 28, backgroundColor: colors.text, borderRadius: 2, opacity: 0.9 },
  timer: { ...type.display, color: colors.text, fontSize: 26, letterSpacing: 1 },
});
