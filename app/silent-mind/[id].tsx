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
          return volet.tracks.map((t) =>
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
        })()}

        {qmTwin && qmTwin.tracks.length > 0 ? (
          <Pressable
            onPress={() => router.push(`/qm/${qmTwin.id}` as any)}
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
