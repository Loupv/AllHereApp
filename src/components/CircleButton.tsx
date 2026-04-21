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
};

export function CircleButton({ mode, onPress, breakProgress = 0, breakLabel, size = 112 }: Props) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (mode === 'pre') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        ), -1, false,
      );
    } else {
      scale.value = withTiming(1, { duration: 300 });
    }
  }, [mode]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
    <Animated.View style={[{ width: size, height: size }, pulseStyle]}>
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
            stroke={colors.accent}
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
