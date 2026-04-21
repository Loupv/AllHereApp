import { useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { colors, type } from '../theme';

const LOGO = require('../../assets/images/logo-header.png');

export function IntroSplash({ onDone }: { onDone: () => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const subOpacity = useSharedValue(0);
  const rootOpacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    subOpacity.value = withDelay(500, withTiming(1, { duration: 700 }));
    rootOpacity.value = withDelay(
      2400,
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
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <Animated.Text style={[styles.sub, subStyle]}>
        WHERE MEDITATION MEETS{'\n'}SCIENCE & TECHNOLOGY
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  logoWrap: { zIndex: 2 },
  logo: { width: 240, height: 100 },
  sub: {
    ...type.overline,
    color: colors.textMuted,
    marginTop: 100,
    textAlign: 'center',
  },
});
