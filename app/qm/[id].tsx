import { Text, View, Image, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { ContentCard } from '../../src/components/ContentCard';
import { qmVolets, qmProgram, silentMindVolets, trackDuration } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing, type } from '../../src/theme';

export default function QMVoletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const { columnMax } = useLayout();
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
  const banner = volet.image ?? qmProgram.banner;

  return (
    <Background color={colors.bgTabAlt}>
      <Stack.Screen options={{ title: `QM · ${volet.title}` }} />
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={[styles.column, { maxWidth: columnMax }]}>
          {/* Same hero band as app/(tabs)/qm.tsx — banner image, tinted
              overlay, teal eyebrow + title. Part pages now visually
              belong to the QM tab. */}
          <View style={styles.hero}>
            <Image source={banner} style={styles.banner} resizeMode="cover" />
            <View style={styles.bannerOverlay} />
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>
                {qmProgram.eyebrow} · {volet.title.toUpperCase()}
              </Text>
              <Text style={styles.title}>{volet.subtitle}</Text>
            </View>
          </View>

          {volet.tagline ? <Text style={styles.intro}>{volet.tagline}</Text> : null}
          {volet.description ? <Text style={styles.intro}>{volet.description}</Text> : null}

          <View style={styles.listPad}>
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
                  <ContentCard
                    key={t.id}
                    title={t.title}
                    duration="SOON"
                    kind="audio"
                    disabled
                  />
                ))}
              </>
            ) : null}
          </View>

          {smTwin ? (
            <Pressable
              onPress={() => router.replace(`/silent-mind/${smTwin.id}` as any)}
              style={({ pressed }) => [styles.siblingCta, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.siblingArrow, { color: colors.accent }]}>←</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.siblingEyebrow}>Silent Mind program</Text>
                <Text style={styles.siblingText}>Back to Silent Mind · {smTwin.title}</Text>
                <Text style={styles.siblingHint}>The guided, untimed version of these practices.</Text>
              </View>
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
  hero: { height: 130, justifyContent: 'flex-end', overflow: 'hidden' },
  banner: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,26,38,0.35)' },
  heroText: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accentAlt, marginBottom: spacing.xs, textAlign: 'center', fontSize: 10 },
  title: { ...type.display, color: colors.text, fontSize: 22, textAlign: 'center', lineHeight: 28 },
  intro: {
    ...type.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  listPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  sectionLabel: { ...type.sectionLabel, color: colors.textMuted, marginBottom: spacing.sm },
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
  siblingEyebrow: { ...type.sectionLabel, color: colors.accent, marginBottom: 2, fontSize: 11 },
  siblingText: { ...type.h3, color: colors.text, fontSize: 15 },
  siblingHint: { ...type.caption, color: colors.textMuted, marginTop: 2, fontSize: 12 },
  siblingArrow: { ...type.display, fontSize: 20, marginRight: 4 },
});
