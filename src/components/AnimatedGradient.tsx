import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

export type GradientStop = {
  /** 0..100 — SVG gradient offset */
  offset: number;
  color: string;
  opacity: number;
};

export type GradientPalette = {
  /** Roughly matches the hotspot halo colour */
  stops: GradientStop[];
};

// ---- Presets --------------------------------------------------------

/** Steel blue → midnight blue. Default (Start page).
 *  Shifted away from the earlier violet/magenta hue so the Start page
 *  reads calm + neutral; the violet is now reserved for the Silent
 *  Mind palette where it carries brand meaning. Centre stop kept low-
 *  opacity and the mid stop pushed out so the halo is atmospheric. */
export const GRADIENT_START: GradientPalette = {
  stops: [
    { offset: 0,   color: '#4A7FD1', opacity: 0.22 },
    { offset: 65,  color: '#132548', opacity: 0.55 },
    { offset: 90,  color: '#040D26', opacity: 1    },
    { offset: 100, color: '#000823', opacity: 1    },
  ],
};

/** Magenta halo for the Silent Mind player.
 *  Matches the softened curve used on Start — centre stop pulled down
 *  and the fade extended so the halo is atmospheric, not painted. */
export const GRADIENT_SM: GradientPalette = {
  stops: [
    { offset: 0,   color: '#C04DB6', opacity: 0.30 },
    { offset: 65,  color: '#3E1D4F', opacity: 0.60 },
    { offset: 90,  color: '#06112A', opacity: 1    },
    { offset: 100, color: '#00091F', opacity: 1    },
  ],
};

/** Teal halo for the QM Format player. */
export const GRADIENT_QM: GradientPalette = {
  stops: [
    { offset: 0,   color: '#3EC0BE', opacity: 0.28 },
    { offset: 65,  color: '#1B3D48', opacity: 0.60 },
    { offset: 90,  color: '#04141F', opacity: 1    },
    { offset: 100, color: '#001018', opacity: 1    },
  ],
};

// Animated primitives — re-use across the file so we don't recreate per
// render and lose the animation's tied sharedValues.
const AnimatedRect = Animated.createAnimatedComponent(Rect);
// react-native-svg exposes animatable RadialGradient via Animated.createAnimatedComponent.
// Cast to `any` so the created component's prop types don't drop the
// `children` slot that RadialGradient normally accepts (Stop nodes).
const AnimatedRadialGradient: any = Animated.createAnimatedComponent(RadialGradient as any);

type Props = {
  /** 0..1 horizontal position of the radial centre — default 0.5 */
  centerX?: number;
  /** 0..1 vertical position of the radial centre — default 0.5 */
  centerY?: number;
  /**
   * When true, changes to `centerY` chase the new value smoothly over
   * ~900ms instead of snapping. Leaves scrub-induced jumps looking
   * alive rather than jittery. Default: true.
   */
  animateCenter?: boolean;
  /**
   * Color stops. Defaults to the violet Start-page palette; Player
   * screens pass GRADIENT_SM / GRADIENT_QM.
   */
  palette?: GradientPalette;
  children?: React.ReactNode;
};

/**
 * Full-bleed radial background.
 *
 * A coloured glow fades out to a near-black edge. The centre position
 * is configurable (callers typically pass the vertical position of a
 * focal element: big play button on Start, or the progress ratio of
 * the playing track). The whole gradient slowly scales 1 ↔ 1.06 on a
 * ~10 s sine so the glow appears to breathe.
 */
export function AnimatedGradient({
  centerX = 0.5,
  centerY = 0.5,
  animateCenter = true,
  palette = GRADIENT_START,
  children,
}: Props) {
  // Breath — slow 10s sine on the scale of the whole SVG layer.
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, []);

  // Breath amplitude dialed back from 6% to 3% — still alive, but no
  // longer a visible pulse that competes with content.
  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.03 }],
  }));

  // Smoothly-animated vertical centre. New target values are chased
  // over a short timing animation, so rapid scrubs / phase transitions
  // look like motion instead of snaps.
  const cyShared = useSharedValue(centerY);
  useEffect(() => {
    if (!animateCenter) {
      cyShared.value = centerY;
      return;
    }
    cyShared.value = withTiming(centerY, {
      duration: 800,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [centerY, animateCenter]);

  // Animated props set `cy` as a percentage string — react-native-svg
  // reliably handles `"NN%"` for RadialGradient coordinates across
  // web and native, whereas raw numeric values are inconsistent.
  const animatedCy = useAnimatedProps(() => ({
    cy: `${cyShared.value * 100}%`,
  }));

  const cxPct = `${Math.max(0, Math.min(1, centerX)) * 100}%`;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, breathStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <AnimatedRadialGradient
              id="ah-start-radial"
              cx={cxPct}
              r="90%"
              gradientUnits="objectBoundingBox"
              animatedProps={animatedCy}
            >
              {palette.stops.map((s, i) => (
                <Stop
                  key={i}
                  offset={`${s.offset}%`}
                  stopColor={s.color}
                  stopOpacity={s.opacity}
                />
              ))}
            </AnimatedRadialGradient>
          </Defs>
          <AnimatedRect width="100%" height="100%" fill="url(#ah-start-radial)" />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#000823' },
});
