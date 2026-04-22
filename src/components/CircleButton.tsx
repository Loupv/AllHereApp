import { useEffect } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
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
};

export function CircleButton({ mode, onPress, breakProgress = 0, breakLabel, size = 112, accent = colors.accent }: Props) {
  const scale = useSharedValue(1);
  const haloScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0);

  useEffect(() => {
    if (mode === 'pre') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        ), -1, false,
      );
      haloScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        ), -1, false,
      );
      haloOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        ), -1, false,
      );
    } else {
      scale.value = withTiming(1, { duration: 300 });
      haloScale.value = withTiming(1, { duration: 300 });
      haloOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [mode]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  const stroke = 3;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, breakProgress)));

  const iconForMode = () => {
    if (mode === 'break') return <Text style={styles.timer}>{breakLabel ?? ''}</Text>;
    if (mode === 'playing') return <View style={styles.pauseBars}><View style={styles.pauseBar} /><View style={styles.pauseBar} /></View>;
    return <Text style={styles.play}>▶</Text>;
  };

  const content = (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, pulseStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: accent,
            // soft blur-like glow via shadow (RN-web translates this to box-shadow)
            shadowColor: accent,
            shadowOpacity: 1,
            shadowRadius: size * 0.35,
            shadowOffset: { width: 0, height: 0 },
            // web-only: explicit filter for a softer falloff
            ...(typeof document !== 'undefined' ? { filter: `blur(${Math.round(size * 0.12)}px)` as any } : null),
          },
          haloStyle,
        ]}
      />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={mode === 'break' ? 'rgba(255,255,255,0.12)' : 'transparent'}
          strokeWidth={stroke}
          fill="transparent"
        />
        {mode === 'break' ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={`${circumference},${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[styles.inner, { width: size - 18, height: size - 18, borderRadius: (size - 18) / 2, top: 9, left: 9, backgroundColor: mode === 'break' ? 'transparent' : colors.accent }]}>
        {iconForMode()}
      </View>
    </Animated.View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: { color: colors.text, fontSize: 34, marginLeft: 6 },
  pauseBars: { flexDirection: 'row', gap: 8 },
  pauseBar: { width: 7, height: 32, backgroundColor: colors.text, borderRadius: 2 },
  timer: { ...type.display, color: colors.text, fontSize: 28 },
});
