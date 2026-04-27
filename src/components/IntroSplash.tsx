import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import pkg from '../../package.json';
import { colors, type } from '../theme';

// Minor (1.1 ← 1.1.1); drop the patch digit. Reads straight from the
// bundled package.json — previously we went through expo-constants
// (`Constants.expoConfig?.version`) but on the web build that path
// either returns undefined or a stale default, which surfaced as a
// rogue "V0.1" on the splash even after we'd shipped real releases.
// package.json is the source of truth and stays in sync with app.json
// (we bump both together at release time).
const RAW_VERSION = (pkg as { version?: string }).version ?? '0.0.0';
const VERSION = `V${RAW_VERSION.split('.').slice(0, 2).join('.')}`;

const LOGO = require('../../assets/images/allhere-logo.png');

export function IntroSplash({ onDone }: { onDone: () => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.94);
  const subOpacity = useSharedValue(0);
  const rootOpacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    subOpacity.value = withDelay(500, withTiming(1, { duration: 700 }));
    rootOpacity.value = withDelay(
      2200,
      withSequence(
        withTiming(1, { duration: 1 }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(onDone)();
        }),
      ),
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <View style={styles.brand}>
        <Animated.View style={logoStyle}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.Text style={[styles.sub, subStyle]}>
          WHERE MEDITATION MEETS{'\n'}SCIENCE & TECHNOLOGY
        </Animated.Text>
      </View>
      <Animated.Text style={[styles.version, subStyle]}>{VERSION}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 100,
  },
  // Mirror the brand block in LoginScreen so logos don't jump between screens
  brand: {
    position: 'absolute',
    top: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logo: { width: 200, height: 66 },
  sub: {
    ...type.overline,
    color: colors.textMuted,
    marginTop: 24,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 18,
  },
  version: {
    ...type.overline,
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 9,
    letterSpacing: 2,
  },
});
