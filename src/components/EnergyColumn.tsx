import { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle as SvgCircle, Defs, Filter, FeGaussianBlur, G } from 'react-native-svg';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing,
  cancelAnimation, type SharedValue,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

/**
 * One wavy vertical line in the column. Continuous from top to bottom
 * of the viewBox; its x-coordinate is a sum of two non-divisible sines
 * of `y` so the line never crystallises into a recognisable pattern.
 * `phase0` shifts the wave; over time the master clock `t` drifts the
 * phase so the whole pattern travels.
 */
type LineCfg = {
  /**
   * Horizontal offset from screen centre, in **screen pixels**. Negative
   * = left of centre, positive = right. Stays constant when the window
   * widens, so the column keeps its absolute physical size on tablet
   * / desktop instead of stretching with the viewport.
   */
  offsetXPx: number;
  /** Per-line horizontal swing amplitude in screen pixels. */
  ampPx: number;
  /** Vertical wavelength in screen pixels (smaller = tighter wiggle). */
  wlPx: number;
  /** Seconds for one full phase cycle. */
  speed: number;
  /** Initial phase offset in radians so lines aren't synchronised. */
  phase0: number;
  /** Per-line stroke opacity. Aggregated with the wrapper opacity. */
  opacity: number;
  /** Stroke width in screen pixels (no SVG transform = no scaling). */
  strokeWidth: number;
};

// 14 lines spread across a central column. baseX clusters around 50%
// (the column's centre) — inner lines have small amplitudes for a
// dense bright core, outer lines have larger amplitudes that fan out
// into a soft halo. `speed` is in *seconds per phase cycle*: longer
// values mean the wave pattern travels slowly up the column, which
// reads as a calm meditative drift rather than a flowing river.
// Speeds / wavelengths / phases are all non-divisible so the combined
// silhouette never repeats exactly.
// Diffuse-band set, calibrated in **screen pixels** so the column
// keeps the same physical size whether the viewport is a 375 px phone
// or a 1280 px desktop. The values below were originally tuned in a
// 100×200 viewBox that mapped to a 375×812 phone (×3.75 horizontal,
// ×4.06 vertical scale) — since the visual was right there, those
// numbers became the absolute-pixel baseline.
//
// Stroke widths bumped a notch and per-line opacities raised a notch
// too: with the heavier blur (see glowFilter) the column was
// fading too far, this puts the "Milky Way haze" intensity back.
const LINES: LineCfg[] = [
  { offsetXPx:   0, ampPx:  7, wlPx: 114, speed: 26, phase0: 0.00, opacity: 0.07, strokeWidth: 4.0 },
  { offsetXPx:  -4, ampPx:  8, wlPx: 122, speed: 33, phase0: 1.10, opacity: 0.07, strokeWidth: 4.0 },
  { offsetXPx:   4, ampPx:  9, wlPx: 130, speed: 30, phase0: 2.40, opacity: 0.07, strokeWidth: 4.0 },
  { offsetXPx: -11, ampPx: 11, wlPx: 138, speed: 28, phase0: 0.50, opacity: 0.07, strokeWidth: 4.0 },
  { offsetXPx:  11, ampPx: 11, wlPx: 146, speed: 32, phase0: 3.10, opacity: 0.07, strokeWidth: 4.0 },
  { offsetXPx: -19, ampPx: 14, wlPx: 162, speed: 36, phase0: 1.90, opacity: 0.06, strokeWidth: 4.5 },
  { offsetXPx:  19, ampPx: 14, wlPx: 154, speed: 34, phase0: 2.70, opacity: 0.06, strokeWidth: 4.5 },
  { offsetXPx: -26, ampPx: 17, wlPx: 179, speed: 40, phase0: 0.40, opacity: 0.06, strokeWidth: 4.5 },
  { offsetXPx:  26, ampPx: 16, wlPx: 171, speed: 42, phase0: 1.60, opacity: 0.06, strokeWidth: 4.5 },
  { offsetXPx: -34, ampPx: 20, wlPx: 195, speed: 48, phase0: 2.10, opacity: 0.06, strokeWidth: 5.0 },
  { offsetXPx:  34, ampPx: 19, wlPx: 187, speed: 50, phase0: 0.30, opacity: 0.06, strokeWidth: 5.0 },
  { offsetXPx: -41, ampPx: 22, wlPx: 211, speed: 56, phase0: 4.20, opacity: 0.05, strokeWidth: 5.0 },
  { offsetXPx:  41, ampPx: 21, wlPx: 203, speed: 58, phase0: 3.50, opacity: 0.05, strokeWidth: 5.0 },
  { offsetXPx: -49, ampPx: 25, wlPx: 227, speed: 64, phase0: 5.80, opacity: 0.05, strokeWidth: 5.5 },
  { offsetXPx:  49, ampPx: 23, wlPx: 219, speed: 62, phase0: 4.90, opacity: 0.05, strokeWidth: 5.5 },
  { offsetXPx:   0, ampPx:  5, wlPx:  89, speed: 23, phase0: 5.10, opacity: 0.07, strokeWidth: 4.0 },
  { offsetXPx:  -8, ampPx: 10, wlPx: 130, speed: 35, phase0: 0.20, opacity: 0.07, strokeWidth: 4.0 },
  { offsetXPx:   8, ampPx: 10, wlPx: 130, speed: 37, phase0: 6.10, opacity: 0.07, strokeWidth: 4.0 },
];

// Tiny scattered stars / dust — a small dot at a fixed position in
// the column, with its own slow opacity twinkle on a per-star phase
// + period. Sits on top of every other layer (no blur) so the
// pinpoints stay sharp.
type StarCfg = {
  /** Signed offset from screen centre, in px. Stays inside the column. */
  offsetXPx: number;
  /** Vertical position as a fraction of screen height (0..1). */
  yFrac: number;
  /** Radius in px (0.5..1.5 typically). */
  r: number;
  /** Mean opacity around which the twinkle oscillates. */
  baseOpacity: number;
  /** Twinkle amplitude — final opacity = baseOpacity ± variation. */
  variation: number;
  /** Seconds per twinkle cycle. */
  period: number;
  /** Initial phase offset so stars aren't synchronised. */
  phase: number;
};

// Twice the position count (28 vs 14) with the visibility-dance trick:
// `baseOpacity == variation` so opacity oscillates symmetrically about
// 0 — the Star worklet clamps with `max(0, …)`, which means each star
// is INVISIBLE for half its twinkle cycle. With 28 stars on staggered
// phases, ~14 are above zero at any moment, so the on-screen count
// stays the same as before — only the *positional variety* doubles.
// Peak brightness (base + variation = 2 × variation) stays in roughly
// the same range as the previous baseOpacity numbers (0.3 → 0.6).
const STARS: StarCfg[] = [
  // Original 14 — same x/y positions, opacity dance applied so they
  // also fade to 0 between twinkles instead of staying always-visible.
  { offsetXPx: -38, yFrac: 0.12, r: 0.8, baseOpacity: 0.30, variation: 0.30, period:  6, phase: 0.0 },
  { offsetXPx:  22, yFrac: 0.18, r: 1.2, baseOpacity: 0.35, variation: 0.35, period:  9, phase: 1.4 },
  { offsetXPx: -14, yFrac: 0.24, r: 0.6, baseOpacity: 0.30, variation: 0.30, period:  7, phase: 2.7 },
  { offsetXPx:  46, yFrac: 0.30, r: 0.7, baseOpacity: 0.25, variation: 0.25, period: 11, phase: 0.6 },
  { offsetXPx:  -6, yFrac: 0.36, r: 1.4, baseOpacity: 0.30, variation: 0.30, period: 13, phase: 3.1 },
  { offsetXPx:  30, yFrac: 0.42, r: 0.5, baseOpacity: 0.20, variation: 0.20, period:  5, phase: 1.9 },
  { offsetXPx: -28, yFrac: 0.48, r: 0.9, baseOpacity: 0.30, variation: 0.30, period:  8, phase: 4.2 },
  { offsetXPx:  10, yFrac: 0.55, r: 1.1, baseOpacity: 0.35, variation: 0.35, period: 10, phase: 0.3 },
  { offsetXPx: -42, yFrac: 0.62, r: 0.6, baseOpacity: 0.25, variation: 0.25, period:  9, phase: 5.0 },
  { offsetXPx:  38, yFrac: 0.68, r: 1.0, baseOpacity: 0.30, variation: 0.30, period:  7, phase: 2.2 },
  { offsetXPx: -18, yFrac: 0.74, r: 1.3, baseOpacity: 0.30, variation: 0.30, period: 12, phase: 1.0 },
  { offsetXPx:  14, yFrac: 0.80, r: 0.7, baseOpacity: 0.25, variation: 0.25, period:  6, phase: 3.7 },
  { offsetXPx: -34, yFrac: 0.86, r: 0.9, baseOpacity: 0.30, variation: 0.30, period:  8, phase: 0.9 },
  { offsetXPx:  26, yFrac: 0.92, r: 0.6, baseOpacity: 0.20, variation: 0.20, period:  4, phase: 4.5 },
  // Added 14 — interleaved positions (different x offsets, different
  // y bands, half-cycle phase shifts) so when one of the originals
  // fades out a fresh one fades in nearby. Periods + phases chosen so
  // no two neighbours synchronise.
  { offsetXPx:  44, yFrac: 0.08, r: 0.7, baseOpacity: 0.25, variation: 0.25, period:  8, phase: 2.3 },
  { offsetXPx: -22, yFrac: 0.16, r: 0.5, baseOpacity: 0.20, variation: 0.20, period: 12, phase: 5.6 },
  { offsetXPx:  18, yFrac: 0.22, r: 1.0, baseOpacity: 0.30, variation: 0.30, period:  5, phase: 0.8 },
  { offsetXPx: -46, yFrac: 0.28, r: 0.8, baseOpacity: 0.30, variation: 0.30, period: 10, phase: 4.1 },
  { offsetXPx:   2, yFrac: 0.34, r: 0.6, baseOpacity: 0.25, variation: 0.25, period:  7, phase: 1.7 },
  { offsetXPx: -32, yFrac: 0.40, r: 1.2, baseOpacity: 0.35, variation: 0.35, period:  9, phase: 3.5 },
  { offsetXPx:  34, yFrac: 0.46, r: 0.7, baseOpacity: 0.25, variation: 0.25, period: 14, phase: 0.4 },
  { offsetXPx:  -8, yFrac: 0.52, r: 0.5, baseOpacity: 0.20, variation: 0.20, period:  6, phase: 5.3 },
  { offsetXPx:  20, yFrac: 0.58, r: 0.9, baseOpacity: 0.30, variation: 0.30, period: 11, phase: 2.8 },
  { offsetXPx: -10, yFrac: 0.66, r: 1.1, baseOpacity: 0.35, variation: 0.35, period:  8, phase: 4.6 },
  { offsetXPx:  42, yFrac: 0.72, r: 0.5, baseOpacity: 0.20, variation: 0.20, period:  7, phase: 1.2 },
  { offsetXPx: -24, yFrac: 0.78, r: 0.8, baseOpacity: 0.25, variation: 0.25, period: 10, phase: 3.9 },
  { offsetXPx:  -2, yFrac: 0.84, r: 1.3, baseOpacity: 0.35, variation: 0.35, period: 13, phase: 0.7 },
  { offsetXPx:  32, yFrac: 0.90, r: 0.6, baseOpacity: 0.25, variation: 0.25, period:  9, phase: 2.6 },
];

// Sharp filaments — a separate small set of thin lines rendered
// **without** the blur filter, so they read as crisp threads
// floating inside the diffuse fog. Combined with the wide blurred
// bands above, the result is a Milky-Way-like layered structure
// (sharp dust lanes on a luminous nebula) rather than a uniformly
// blurry haze. They share the same `t` clock as the fog so the
// motion is in sync.
const SHARP_LINES: LineCfg[] = [
  { offsetXPx:   0, ampPx:  6, wlPx: 100, speed: 26, phase0: 0.20, opacity: 0.10, strokeWidth: 0.9 },
  { offsetXPx:  -8, ampPx:  9, wlPx: 132, speed: 31, phase0: 1.40, opacity: 0.08, strokeWidth: 0.8 },
  { offsetXPx:   8, ampPx:  9, wlPx: 128, speed: 29, phase0: 2.60, opacity: 0.08, strokeWidth: 0.8 },
  { offsetXPx: -18, ampPx: 13, wlPx: 158, speed: 38, phase0: 0.60, opacity: 0.06, strokeWidth: 0.8 },
  { offsetXPx:  18, ampPx: 13, wlPx: 162, speed: 36, phase0: 3.30, opacity: 0.06, strokeWidth: 0.8 },
  { offsetXPx:   0, ampPx:  3, wlPx:  74, speed: 21, phase0: 5.40, opacity: 0.10, strokeWidth: 0.9 },
];

// Global "twist" envelope — a single low-frequency sine applied as a
// function of `y` (not time-only translation), so every line picks
// up the same y-dependent offset and the cluster bends together like
// a flexible rope. Phase drifts slowly so the bend shape (C-curve, S-
// curve, double-S) morphs over time. Because the offset is a sine of
// y centred on 0, the column stays globally centred — it doesn't
// slide left/right wholesale, it twists in place.
//
// All values in **screen pixels** so the bend keeps a constant
// physical scale across viewports.
const GLOBAL_TWIST_AMP_PX = 53;
const GLOBAL_TWIST_WL_PX  = 731;
const GLOBAL_TWIST_PERIOD = 38;
// Secondary twist on a non-divisible wavelength + period so the
// global bend never resolves into a single clean sine.
const GLOBAL_TWIST_AMP_2_PX = 23;
const GLOBAL_TWIST_WL_2_PX  = 447;
const GLOBAL_TWIST_PERIOD_2 = 71;

/**
 * Small twinkling star/dust speck. Position is **fixed** — only the
 * opacity oscillates, on a per-star period, so the layer shimmers in
 * place. Stars don't follow the global twist on purpose: stars feel
 * like distant background, drifting them with the foreground cluster
 * made the parallax wrong.
 */
function Star({
  cfg, t, accent, screenWidth, screenHeight,
}: {
  cfg: StarCfg;
  t: SharedValue<number>;
  accent: string;
  screenWidth: number;
  screenHeight: number;
}) {
  const cx = screenWidth / 2 + cfg.offsetXPx;
  const cy = cfg.yFrac * screenHeight;
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const twinkle = Math.sin((t.value / cfg.period) * 2 * Math.PI + cfg.phase);
    return { opacity: Math.max(0, cfg.baseOpacity + cfg.variation * twinkle) };
  });
  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx={cx}
      cy={cy}
      r={cfg.r}
      fill={accent}
    />
  );
}

function WaveLine({
  cfg, t, accent, screenWidth, screenHeight,
}: {
  cfg: LineCfg;
  t: SharedValue<number>;
  accent: string;
  screenWidth: number;
  screenHeight: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    // Segment count is the hot loop here — every line rebuilds a path
    // string from `POINTS + 1` samples on every UI-thread frame. Web
    // GPUs eat that easily, but on a phone CPU a couple dozen lines at
    // 80 segments × 60 Hz starts to hurt and shows up as lag during
    // screen transitions. 40 segments still reads as a smooth wavy
    // line at viewport heights up to ~1100 px (samples sit ~25 px
    // apart) and roughly halves the per-frame string + sin work.
    const POINTS = Platform.OS === 'web' ? 80 : 28;
    const cx = screenWidth / 2;
    // Phase of the global twist envelope — same value applied to every
    // line, so the column bends as a single rope rather than each
    // line drifting independently. Two non-divisible periods summed
    // so the bend shape morphs without ever locking into a pure sine.
    const twistPhase  = (t.value / GLOBAL_TWIST_PERIOD ) * 2 * Math.PI;
    const twistPhase2 = (t.value / GLOBAL_TWIST_PERIOD_2) * 2 * Math.PI + 1.4;
    let d = '';
    for (let i = 0; i <= POINTS; i++) {
      const y = (i / POINTS) * screenHeight;
      // y-dependent global offset: every line picks up the same
      // value at the same y, so they bend together. Centred on 0
      // (a sine), so the column stays globally on the screen centre.
      const globalTwist =
        GLOBAL_TWIST_AMP_PX   * Math.sin((y / GLOBAL_TWIST_WL_PX ) * 2 * Math.PI + twistPhase) +
        GLOBAL_TWIST_AMP_2_PX * Math.sin((y / GLOBAL_TWIST_WL_2_PX) * 2 * Math.PI + twistPhase2);
      const phase = (t.value / cfg.speed) * 2 * Math.PI + cfg.phase0;
      // Two non-divisible sines summed for the per-line micro wobble
      // — primary at full amplitude, secondary at 0.4× / 0.61× so the
      // line never reads as a perfect sine on its own.
      const x = cx + cfg.offsetXPx
        + globalTwist
        + cfg.ampPx * Math.sin((y / cfg.wlPx) * 2 * Math.PI + phase)
        + cfg.ampPx * 0.4 * Math.sin((y / (cfg.wlPx * 0.61)) * 2 * Math.PI + phase * 1.27);
      d += i === 0
        ? `M${x.toFixed(2)} ${y.toFixed(2)}`
        : ` L${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return { d };
  });
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      stroke={accent}
      strokeWidth={cfg.strokeWidth}
      strokeOpacity={cfg.opacity}
      strokeLinecap="round"
      fill="none"
    />
  );
}

type Props = {
  /**
   * Colour of the **diffuse fog** layer. Saturated tints survive the
   * heavy blur, so this is the colour the user actually perceives —
   * default a deeper lavender so the cosmic feel reads even after
   * the 5px blur dilutes it.
   */
  accent?: string;
  /**
   * Colour for the sharp filaments + stars (the un-blurred layers).
   * Stays white so pinpoint stars and fine threads read as crisp
   * stellar light against the lavender fog.
   */
  crispAccent?: string;
  /** Wrapper opacity multiplier. Default 0.6. */
  opacity?: number;
  /**
   * When false, the wave-phase animation freezes — the column stays
   * visible at its last frame, no motion. Used by the global layer to
   * pin animation to "audio is playing".
   */
  active?: boolean;
  /**
   * When true, no time-driven animation runs at all — the wave shape
   * is rendered once at t=0 and stays. Same visual structure (fog,
   * sharp filaments, stars), just frozen. Used on native by default
   * to eliminate the per-frame UI-thread cost that was making screen
   * transitions feel sticky.
   */
  staticMode?: boolean;
};

/**
 * Vertical energy column — a continuous bottom-to-top luminous channel
 * built from a multitude of wavy vertical lines. Each line travels
 * the full height of the viewport with its x-coordinate undulating
 * via summed sines, so the column reads as a soft cluster of
 * ondulating waves rather than discrete blobs. Inner lines are
 * tighter and brighter (the spinal "core"); outer lines have larger
 * amplitudes and lower opacity, fanning out into a diffuse halo.
 *
 * Pure stroked Paths — no fills, no per-line gradients — so the layer
 * stays cheap to render even with 14 lines × 80-sample curves.
 *
 * Mounted full-screen + `pointerEvents="none"` from the root layout
 * (see `app/_layout.tsx`).
 */
export function EnergyColumn({
  accent = '#9D8AE8',
  crispAccent = '#FFFFFF',
  opacity = 0.85,
  active = true,
  staticMode = false,
}: Props) {
  const { width, height } = useWindowDimensions();
  // Master clock in seconds. Bounded loop (600 → 0) keeps phase math
  // safe; one second of wall time advances the value by 1. In
  // `staticMode` we leave it pinned at 0 so every WaveLine renders a
  // single fixed path with no per-frame UI-thread work.
  const t = useSharedValue(0);
  useEffect(() => {
    if (staticMode) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    // The column ALWAYS animates so the Start screen is never visually
    // frozen — it drifts at a moderately slower rate when no audio is
    // playing (×0.5 of the active speed). When audio plays we shift
    // to the full speed. Idle motion still has to be **visible** —
    // the previous ×0.18 was so slow you couldn't see it during a
    // first glance; ×0.5 keeps the meditative tone while obviously
    // moving.
    cancelAnimation(t);
    const fastDurationMs  = 600_000;       // 1 sec wall-clock = 1 unit in t
    const slowDurationMs  = 1_200_000;     // ×2 slower than active
    t.value = withRepeat(
      withTiming(600, {
        duration: active ? fastDurationMs : slowDurationMs,
        easing: Easing.linear,
      }),
      -1, false,
    );
    return () => cancelAnimation(t);
  }, [active, staticMode]);

  // Fog layer — heavy blur turns the wide low-opacity strokes into a
  // luminous haze. On web we apply CSS `filter: blur()`; on native we
  // wrap the strokes in an SVG `<G filter="url(#ec-blur)">` referencing
  // an `<FeGaussianBlur>` filter so iOS / Android render the same haze.
  // Native budget: skip the outermost wide-amplitude halo lines + half
  // of the sharp filaments. Each WaveLine is a `useAnimatedProps` that
  // rebuilds its path string on every UI-thread frame, so cutting the
  // count is a near-linear win on phones. On web we keep the full set
  // because the GPU draws SVG paths nearly for free.
  const fogLines = Platform.OS === 'web' ? LINES : LINES.slice(0, 7);
  const sharpLines = Platform.OS === 'web' ? SHARP_LINES : SHARP_LINES.slice(0, 2);
  const fogSvg = (
    <Svg width={width} height={height}>
      {Platform.OS !== 'web' && (
        <Defs>
          <Filter id="ec-blur" x="-10%" y="-10%" width="120%" height="120%">
            <FeGaussianBlur stdDeviation="5" />
          </Filter>
        </Defs>
      )}
      {Platform.OS !== 'web' ? (
        <G filter="url(#ec-blur)">
          {fogLines.map((cfg, i) => (
            <WaveLine
              key={`fog-${i}`}
              cfg={cfg}
              t={t}
              accent={accent}
              screenWidth={width}
              screenHeight={height}
            />
          ))}
        </G>
      ) : (
        fogLines.map((cfg, i) => (
          <WaveLine
            key={`fog-${i}`}
            cfg={cfg}
            t={t}
            accent={accent}
            screenWidth={width}
            screenHeight={height}
          />
        ))
      )}
    </Svg>
  );
  const sharpSvg = (
    <Svg width={width} height={height}>
      {sharpLines.map((cfg, i) => (
        <WaveLine
          key={`sharp-${i}`}
          cfg={cfg}
          t={t}
          accent={crispAccent}
          screenWidth={width}
          screenHeight={height}
        />
      ))}
    </Svg>
  );
  const starsSvg = (
    <Svg width={width} height={height}>
      {STARS.map((cfg, i) => (
        <Star
          key={`star-${i}`}
          cfg={cfg}
          t={t}
          accent={crispAccent}
          screenWidth={width}
          screenHeight={height}
        />
      ))}
    </Svg>
  );

  return (
    <>
      {/* Diffuse fog layer — see fogSvg comment above. */}
      <View style={[StyleSheet.absoluteFill, { opacity }, fadeMask, glowFilter]} pointerEvents="none">
        {withFadeMaskNative(fogSvg)}
      </View>
      {/* Sharp filament layer — same animated clock, no blur, thin
          strokes in the crisp accent (white). */}
      <View style={[StyleSheet.absoluteFill, { opacity: opacity * 0.55 }, fadeMask]} pointerEvents="none">
        {withFadeMaskNative(sharpSvg)}
      </View>
      {/* Stars / dust layer — small bright pinpoints at fixed
          positions, each twinkling on its own period. */}
      <View style={[StyleSheet.absoluteFill, { opacity: opacity * 0.85 }, fadeMask]} pointerEvents="none">
        {withFadeMaskNative(starsSvg)}
      </View>
    </>
  );
}

/**
 * On native, wrap a layer in a `<MaskedView>` with a vertical
 * `<LinearGradient>` so the column dissolves under the header and
 * above the tab bar — same fade as the web `maskImage` CSS. On web
 * this is a no-op (the wrapping `<View>` already carries `fadeMask`).
 */
function withFadeMaskNative(child: React.ReactNode) {
  if (Platform.OS === 'web') return child;
  return (
    <MaskedView
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      maskElement={
        <LinearGradient
          colors={['transparent', 'black', 'black', 'transparent']}
          locations={[0, 0.12, 0.84, 1]}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      {child}
    </MaskedView>
  );
}

// Heavier CSS blur — turns the strokes into a soft luminous fog
// that reads as a "Milky Way" haze rather than discrete bands.
// Web uses CSS `filter: blur()`; native applies an SVG
// `<FeGaussianBlur>` filter inside the fog `<Svg>` instead so the
// haze renders identically on iOS / Android.
const glowFilter =
  Platform.OS === 'web'
    ? ({ filter: 'blur(5px)' } as any)
    : {};

// Mask that fades the wave column out near the top (under the header)
// and the bottom (behind the tab bar / safe area). Web uses CSS
// `maskImage`; native uses `<MaskedView>` + `<LinearGradient>` (see
// `withFadeMask` below) so iOS / Android get the same effect.
const fadeMask =
  Platform.OS === 'web'
    ? ({
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 12%, black 84%, transparent 100%)',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 12%, black 84%, transparent 100%)',
      } as any)
    : {};
