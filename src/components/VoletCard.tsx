import { useEffect } from 'react';
import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { Volet } from '../content/catalog';
import { useProgress } from '../player/progressStore';
import { colors, radius, spacing, type } from '../theme';

type Props = {
  volet: Volet;
  /** e.g. '/silent-mind' or '/qm' — the card navigates to `${basePath}/${volet.id}` */
  basePath: '/silent-mind' | '/qm';
  /** Accent tint — magenta for Silent Mind, teal for QM. Kept inline so the
   *  component doesn't have to know about theme toggles. */
  accent?: string;
  accentRgb?: string; // e.g. '158,54,148' — used for the pulsing border alpha
  secondary?: boolean;
};

/**
 * Full-bleed card for a program volet. Tapping routes to the detail page.
 * When the card contains the "next" unlistened track, it breathes with a
 * soft accent outline to invite the user in.
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
  // Card count + "next" detection is scoped to volet.tracks (the list the
  // detail page actually renders). qmTracks are shown in the parallel QM tab.
  const tracks = volet.tracks;
  const containsNext = !!nextTrackId && tracks.some(t => t.id === nextTrackId);

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (containsNext && !locked) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
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

  const playable = tracks.filter(t => !t.comingSoon);
  const countLabel = playable.length > 0
    ? `${playable.length} audio${playable.length > 1 ? 's' : ''}`
    : 'Coming soon';

  return (
    <Animated.View style={[styles.card, secondary && styles.cardSecondary, locked && styles.cardLocked, pulseStyle]}>
      <Pressable
        onPress={() => { if (!locked) router.push(`${basePath}/${volet.id}` as any); }}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {volet.image ? (
          <Image source={volet.image} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.bgSoft }]} />
        )}
        <View style={styles.imageOverlay} />
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: accent }]}>{volet.title}</Text>
          {volet.subtitle ? <Text style={styles.title}>{volet.subtitle}</Text> : null}
          {volet.tagline ? <Text style={styles.tagline}>{volet.tagline}</Text> : null}
          <Text style={styles.meta}>{countLabel}{locked ? '' : '  →'}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  cardSecondary: { opacity: 0.85 },
  cardLocked: { opacity: 0.45 },
  pressable: { overflow: 'hidden', borderRadius: radius.lg - 1 },
  pressed: { opacity: 0.85 },
  image: { width: '100%', height: 140 },
  imageOverlay: { ...StyleSheet.absoluteFillObject, height: 140, backgroundColor: 'rgba(0,16,46,0.45)' },
  body: { padding: spacing.md, gap: 4 },
  eyebrow: { ...type.overline, fontSize: 11 },
  title: { ...type.h2, color: colors.text, fontSize: 17, marginTop: 2 },
  tagline: { ...type.caption, color: colors.textMuted, fontStyle: 'italic' },
  meta: { ...type.overline, color: colors.textDim, fontSize: 10, marginTop: 6 },
});
