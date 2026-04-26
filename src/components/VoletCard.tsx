import { useEffect } from 'react';
import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing, cancelAnimation,
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
  /**
   * More opaque surface — useful when the card sits on top of a busy or
   * low-contrast backdrop (e.g. the radial gradient on the Start page).
   */
  elevated?: boolean;
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
  elevated = false,
}: Props) {
  const router = useRouter();
  const nextTrackId = useProgress(s => s.nextTrackId());
  const locked = volet.locked;
  const tracks = volet.tracks;
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

  // No preparatory animation on press — the Stack's slide-from-right owns
  // the transition. Fading the card out first would leave nothing to slide.
  const onPress = () => {
    if (locked) return;
    router.push(`${basePath}/${volet.id}` as any);
  };

  // Always reflect the section's total audio count, including tracks
  // that aren't released yet — so a "3 audios" promise stays stable as
  // coming-soon items get unlocked over time.
  const countLabel = tracks.length > 0
    ? `${tracks.length} audio${tracks.length > 1 ? 's' : ''}`
    : 'Coming soon';

  return (
    <Animated.View
      style={[
        styles.card,
        elevated && styles.cardElevated,
        secondary && styles.cardSecondary,
        locked && styles.cardLocked,
        pulseStyle,
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
          {volet.title ? (
            <Text style={[styles.eyebrow, { color: accent }]}>{volet.title}</Text>
          ) : null}
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
  // Borderless + background-less by default — matches the Start page
  // intro list so the whole app reads the same way: a hairline between
  // rows gives just enough structure without stacking opaque cards on
  // top of a soft gradient. Border is kept at width 1 with transparent
  // color so the `pulseStyle` (which paints borderColor) still works
  // when this card owns the next unlistened track.
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderColor: 'transparent',
    borderWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.09)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  // Intro volet reads as secondary to the three numbered parts — dimmer
  // thumbnail + title. With the borderless default list, no extra
  // styling is needed beyond the intrinsic hairline.
  cardSecondary: {},
  // Elevated variant kept as an escape hatch for callers that place the
  // card on a truly busy backdrop. No-op in the hairline-list context.
  cardElevated: {
    backgroundColor: 'rgba(0, 8, 35, 0.45)',
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  cardLocked: { opacity: 0.45 },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
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
