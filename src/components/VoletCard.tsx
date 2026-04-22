import { useEffect } from 'react';
import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing, cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { Volet } from '../content/catalog';
import { useProgress } from '../player/progressStore';
import { colors, radius, spacing, type } from '../theme';

type Props = {
  volet: Volet;
  /** '/silent-mind' or '/qm' — card routes to `${basePath}/${volet.id}` */
  basePath: '/silent-mind' | '/qm';
  /** Accent tint — magenta for Silent Mind, teal for QM */
  accent?: string;
  accentRgb?: string;
  secondary?: boolean;
};

/**
 * Compact horizontal volet card (circle + title + chevron). On tap the card
 * plays a short "opening" stretch (scaleY 1 → 1.18, then back to 1) while it
 * routes to the full-page detail, so the transition feels physical.
 */
export function VoletCard({
  volet,
  basePath,
  accent = colors.accent,
  accentRgb = '158,54,148',
  secondary = false,
}: Props) {
  const router = useRouter();
  const nextTrackId = useProgress(s => s.nextTrackId());
  const locked = volet.locked;
  const tracks = volet.tracks;
  const playable = tracks.filter(t => !t.comingSoon);
  const containsNext = !!nextTrackId && tracks.some(t => t.id === nextTrackId);

  // Slow breathing outline when this volet owns the next unlistened track
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (containsNext && !locked) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [containsNext, locked]);

  const pulseStyle = useAnimatedStyle(() => {
    if (!containsNext) return {};
    const alpha = 0.25 + pulse.value * 0.55;
    return {
      borderColor: `rgba(${accentRgb},${alpha})`,
      shadowColor: accent,
      shadowOpacity: 0.15 + pulse.value * 0.35,
      shadowRadius: 6 + pulse.value * 8,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  // Opening animation: vertical stretch then collapse, navigating mid-way.
  const openY = useSharedValue(1);
  const openOpacity = useSharedValue(1);
  const navigate = () => router.push(`${basePath}/${volet.id}` as any);

  const onPress = () => {
    if (locked) return;
    openY.value = withSequence(
      withTiming(1.28, { duration: 360, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(navigate)();
      }),
      withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) }),
    );
    openOpacity.value = withSequence(
      withTiming(0.75, { duration: 360 }),
      withTiming(1, { duration: 420 }),
    );
  };

  const openStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: openY.value }],
    opacity: openOpacity.value,
  }));

  const countLabel = playable.length > 0
    ? `${playable.length} audio${playable.length > 1 ? 's' : ''}`
    : 'Coming soon';

  return (
    <Animated.View
      style={[
        styles.card,
        secondary && styles.cardSecondary,
        locked && styles.cardLocked,
        pulseStyle,
        openStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {volet.image ? (
          <Image source={volet.image} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.bgSoft }]} />
        )}
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: accent }]}>{volet.title}</Text>
          {volet.subtitle ? (
            <Text style={styles.title} numberOfLines={1}>{volet.subtitle}</Text>
          ) : null}
          <Text style={styles.meta}>{countLabel}</Text>
        </View>
        <Text style={[styles.chevron, { color: accent }]}>{locked ? '' : '→'}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm + 2,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardSecondary: { opacity: 0.85 },
  cardLocked: { opacity: 0.45 },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  pressed: { opacity: 0.85 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  body: { flex: 1, gap: 2 },
  eyebrow: { ...type.overline, fontSize: 10 },
  title: { ...type.h2, color: colors.text, fontSize: 15 },
  meta: { ...type.overline, color: colors.textDim, fontSize: 9, marginTop: 2 },
  chevron: { ...type.display, fontSize: 16, marginLeft: 4 },
});
