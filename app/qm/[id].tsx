import { Text, View, Image, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { ContentCard } from '../../src/components/ContentCard';
import { qmVolets, silentMindVolets, trackDuration } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { colors, radius, spacing, type } from '../../src/theme';

export default function QMVoletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const volet = qmVolets.find(v => v.id === id);
  const smTwin = silentMindVolets.find(v => v.id === id);

  if (!volet) {
    return (
      <Background color={colors.bgTabAlt}>
        <Text style={[styles.title, { padding: spacing.lg }]}>Not found</Text>
      </Background>
    );
  }

  const playable = volet.tracks.filter(t => !t.comingSoon);
  const soon = volet.tracks.filter(t => t.comingSoon);

  return (
    <Background color={colors.bgTabAlt}>
      <Stack.Screen options={{ title: `QM · ${volet.title}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {volet.image ? (
            <Image source={volet.image} style={styles.circle} resizeMode="cover" />
          ) : null}
          <Text style={styles.eyebrow}>QM · {volet.title.toUpperCase()}</Text>
          <Text style={styles.title}>{volet.subtitle}</Text>
          {volet.tagline ? <Text style={styles.tagline}>{volet.tagline}</Text> : null}
          {volet.description ? <Text style={styles.description}>{volet.description}</Text> : null}
        </View>

        {playable.map((t) => (
          <ContentCard
            key={t.id}
            title={t.title}
            meta={t.rounds ? `${t.rounds.max} × ${t.rounds.roundLengthMinutes} min` : undefined}
            duration={trackDuration(t)}
            kind="audio"
            accent={colors.accentAlt}
            onPress={() => openPlayer(t, playable)}
          />
        ))}

        {soon.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Coming soon</Text>
            {soon.map((t) => (
              <View key={t.id} style={styles.soonCard}>
                <Text style={styles.soonTitle}>{t.title}</Text>
                <Text style={styles.soonBadge}>SOON</Text>
              </View>
            ))}
          </>
        ) : null}

        {smTwin ? (
          <Pressable
            // replace, not push — siblings shouldn't accumulate on the
            // nav stack; back should pop up to the tab above.
            onPress={() => router.replace(`/silent-mind/${smTwin.id}` as any)}
            style={({ pressed }) => [styles.backCta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.backCtaEyebrow}>SILENT MIND PROGRAM</Text>
            <Text style={styles.backCtaText}>← Back to Silent Mind · {smTwin.title}</Text>
            <Text style={styles.backCtaHint}>The guided, untimed version of these practices.</Text>
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
    borderColor: colors.accentAlt,
    borderWidth: 2,
  },
  eyebrow: { ...type.overline, color: colors.accentAlt, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text, fontSize: 26, textAlign: 'center', marginBottom: spacing.sm },
  tagline: { ...type.caption, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginBottom: spacing.md },
  description: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  sectionLabel: { ...type.overline, color: colors.textMuted, marginBottom: spacing.md },
  soonCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, marginBottom: spacing.sm,
    borderRadius: radius.md, borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed',
    opacity: 0.5,
  },
  soonTitle: { ...type.h2, color: colors.text, fontSize: 15 },
  soonBadge: { ...type.overline, color: colors.textDim, fontSize: 9 },
  backCta: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderColor: colors.accent,
    borderWidth: 1,
    backgroundColor: 'rgba(158,54,148,0.08)',
    alignItems: 'center',
    gap: 4,
  },
  backCtaEyebrow: { ...type.overline, color: colors.accent, fontSize: 10 },
  backCtaText: { ...type.h2, color: colors.text, fontSize: 16 },
  backCtaHint: { ...type.caption, color: colors.textMuted, textAlign: 'center', fontSize: 12 },
});
