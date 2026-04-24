import { Text, View, Image, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { ContentCard } from '../../src/components/ContentCard';
import { silentMindVolets, qmVolets, silentMindProgram, trackDuration } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing, type } from '../../src/theme';

export default function VoletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const { columnMax } = useLayout();
  const volet = silentMindVolets.find(v => v.id === id);
  // Mirror volet in the QM tab — same id suffix ('part1' / 'part2' / 'part3').
  const qmTwin = qmVolets.find(v => v.id === id);

  if (!volet) {
    return (
      <Background color={colors.bgTab}>
        <Text style={[styles.title, { padding: spacing.lg }]}>Not found</Text>
      </Background>
    );
  }

  // Banner image: prefer the volet's own image, fall back to the program banner
  // so every Part page has the same hero surface as the Silent Mind tab.
  const banner = volet.image ?? silentMindProgram.banner;

  return (
    <Background color={colors.bgTab}>
      <Stack.Screen options={{ title: volet.title }} />
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={[styles.column, { maxWidth: columnMax }]}>
          {/* Mirrors the Silent Mind tab hero — banner image, light overlay,
              eyebrow + title stacked at the bottom. Makes the Part pages
              feel like sub-sections of the same surface rather than a
              different visual language. */}
          <View style={styles.hero}>
            <Image source={banner} style={styles.banner} resizeMode="cover" />
            <View style={styles.bannerOverlay} />
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>
                {silentMindProgram.eyebrow} · {volet.title.toUpperCase()}
              </Text>
              <Text style={styles.title}>{volet.subtitle}</Text>
            </View>
          </View>

          {volet.tagline ? <Text style={styles.intro}>{volet.tagline}</Text> : null}
          {volet.description ? <Text style={styles.intro}>{volet.description}</Text> : null}

          <View style={styles.listPad}>
          {(() => {
            const playable = volet.tracks.filter(t => !t.comingSoon);
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
          </View>

          {qmTwin && qmTwin.tracks.length > 0 ? (
            // Borderless sibling CTA — matches the list's hairline motif
            // (see ContentCard). Just a labelled row with a trailing arrow.
            <Pressable
              onPress={() => router.replace(`/qm/${qmTwin.id}` as any)}
              style={({ pressed }) => [styles.siblingCta, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.siblingEyebrow}>Quantified meditation</Text>
                <Text style={styles.siblingText}>Go to QM Format · {volet.title}</Text>
                <Text style={styles.siblingHint}>Short, timed rounds with pauses, for the same practices.</Text>
              </View>
              <Text style={[styles.siblingArrow, { color: colors.accentAlt }]}>→</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  column: { width: '100%', alignSelf: 'center' },
  // Hero mirrors app/(tabs)/silent-mind.tsx — same 130 px band, same
  // overlay tint, same eyebrow/title stack.
  hero: { height: 130, justifyContent: 'flex-end', overflow: 'hidden' },
  banner: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.35)' },
  heroText: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.xs, textAlign: 'center', fontSize: 10 },
  title: { ...type.display, color: colors.text, fontSize: 24, textAlign: 'center', lineHeight: 30 },
  intro: {
    ...type.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
  listPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  // Kept the "Our sections" divider (intro volet only) in the same
  // visual language as the Start 'or' divider.
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.16)' },
  dividerLabel: { ...type.sectionLabel, color: colors.textMuted, fontSize: 11 },

  siblingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderTopColor: 'rgba(255,255,255,0.09)',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  siblingEyebrow: { ...type.sectionLabel, color: colors.accentAlt, marginBottom: 2, fontSize: 11 },
  siblingText: { ...type.h3, color: colors.text, fontSize: 15 },
  siblingHint: { ...type.caption, color: colors.textMuted, marginTop: 2, fontSize: 12 },
  siblingArrow: { ...type.display, fontSize: 20, marginLeft: 4 },
});
