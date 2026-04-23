import { Text, View, Image, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { ContentCard } from '../../src/components/ContentCard';
import { silentMindVolets, qmVolets, trackDuration } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { colors, radius, spacing, type } from '../../src/theme';

export default function VoletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const volet = silentMindVolets.find(v => v.id === id);
  // Mirror volet in the QM tab — same id suffix ('part1' / 'part2' / 'part3').
  const qmTwin = qmVolets.find(v => v.id === id);

  if (!volet) {
    return (
      <Background>
        <Text style={[styles.title, { padding: spacing.lg }]}>Not found</Text>
      </Background>
    );
  }

  return (
    <Background>
      <Stack.Screen options={{ title: volet.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {volet.image ? (
            <Image source={volet.image} style={styles.circle} resizeMode="cover" />
          ) : null}
          <Text style={styles.eyebrow}>{volet.title.toUpperCase()}</Text>
          <Text style={styles.title}>{volet.subtitle}</Text>
          {volet.tagline ? <Text style={styles.tagline}>{volet.tagline}</Text> : null}
          {volet.description ? <Text style={styles.description}>{volet.description}</Text> : null}
        </View>

        {(() => {
          const playable = volet.tracks.filter(t => !t.comingSoon);
          // On the Intro volet only, slip an 'Our sections' divider between
          // the onboarding pair (Welcome + Prepare the space) and the two
          // section presentations that follow (Silent Mind + QM Format).
          const showDividerAfter = volet.id === 'intro' ? 'intro-3' : null;
          const cards: React.ReactNode[] = [];
          volet.tracks.forEach((t) => {
            cards.push(
              t.comingSoon ? (
                <ContentCard
                  key={t.id}
                  title={t.title}
                  duration="SOON"
                  kind="audio"
                  disabled
                />
              ) : (
                <ContentCard
                  key={t.id}
                  title={t.title}
                  duration={trackDuration(t)}
                  kind="audio"
                  onPress={() => openPlayer(t, playable)}
                />
              ),
            );
            if (showDividerAfter && t.id === showDividerAfter) {
              cards.push(
                <View key="our-sections-divider" style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>Our sections</Text>
                  <View style={styles.dividerLine} />
                </View>,
              );
            }
          });
          return cards;
        })()}

        {qmTwin && qmTwin.tracks.length > 0 ? (
          <Pressable
            // replace rather than push: the two program detail pages are
            // siblings, so tapping 'Go to QM Format' shouldn't deepen the
            // navigation stack — the back button should always pop up to
            // the tab, not ping-pong between the two details.
            onPress={() => router.replace(`/qm/${qmTwin.id}` as any)}
            style={({ pressed }) => [styles.qmCta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.qmCtaEyebrow}>QUANTIFIED MEDITATION</Text>
            <Text style={styles.qmCtaText}>Go to QM Format · {volet.title} →</Text>
            <Text style={styles.qmCtaHint}>Short, timed rounds with pauses, for the same practices.</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.md,
    // Dark blue-tinted grey ring instead of the magenta accent, so the
    // big circular image doesn't compete with the rest of the header.
    borderColor: '#2A3A5C',
    borderWidth: 2,
  },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text, fontSize: 26, textAlign: 'center', marginBottom: spacing.sm },
  tagline: { ...type.caption, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginBottom: spacing.md },
  description: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  // Same visual language as the 'or' divider on Start.
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.16)' },
  dividerLabel: { ...type.overline, color: colors.textMuted, fontSize: 10, letterSpacing: 2 },
  qmCta: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderColor: colors.accentAlt,
    borderWidth: 1,
    backgroundColor: 'rgba(54,160,158,0.08)',
    alignItems: 'center',
    gap: 4,
  },
  qmCtaEyebrow: { ...type.overline, color: colors.accentAlt, fontSize: 10 },
  qmCtaText: { ...type.h2, color: colors.text, fontSize: 16 },
  qmCtaHint: { ...type.caption, color: colors.textMuted, textAlign: 'center', fontSize: 12 },
});
