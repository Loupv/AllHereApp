import { useState } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Animated, { Keyframe } from 'react-native-reanimated';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { ContentCard } from '../../src/components/ContentCard';
import { ProgramHeader } from '../../src/components/ProgramHeader';
import { qmVolets, qmProgram, silentMindVolets, trackDuration } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useProgress, isTrackUnlocked } from '../../src/player/progressStore';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing, type } from '../../src/theme';
import { noOrphan } from '../../src/utils/noOrphan';

const detailEnter = new Keyframe({
  0:   { opacity: 0, transform: [{ translateX: 40 }] },
  60:  { opacity: 0.6, transform: [{ translateX: 16 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }] },
}).duration(320);

const detailExit = new Keyframe({
  0:   { opacity: 1, transform: [{ translateX: 0 }] },
  40:  { opacity: 0.6, transform: [{ translateX: 16 }] },
  100: { opacity: 0, transform: [{ translateX: 40 }] },
}).duration(260);

export default function QMVoletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const listened = useProgress(s => s.listened);
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
  // Single-open accordion — see SM detail page for rationale.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Background color={colors.bgTabAlt}>
      <Stack.Screen options={{ title: `QM · ${volet.title}` }} />
      {/* Crossfade-while-sliding via custom Keyframe — see SM detail
          page for details. */}
      <Animated.View style={{ flex: 1 }} entering={detailEnter} exiting={detailExit}>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={[styles.column, { maxWidth: columnMax }]}>
          <ProgramHeader
            eyebrow={
              volet.title
                ? `${qmProgram.eyebrow} · ${volet.title}`
                : qmProgram.eyebrow
            }
            title={volet.subtitle}
            description={volet.description}
            accent={colors.accentAlt}
          />

          <View style={styles.listPad}>
            {(() => {
              // Sequential unlock — a QM track unlocks alongside its
              // matching SM track in the same Part. See `isTrackUnlocked`
              // in progressStore for the full walk.
              return playable.map((t) => {
                const locked = !isTrackUnlocked(t.id, listened);
                if (locked) {
                  return (
                    <ContentCard
                      key={t.id}
                      title={t.title}
                      subtitle="Listen to the previous audio first"
                      duration="LOCKED"
                      kind="audio"
                      accent={colors.accentAlt}
                      disabled
                    />
                  );
                }
                return (
                  <ContentCard
                    key={t.id}
                    title={t.title}
                    meta={t.rounds ? `${t.rounds.max} × ${t.rounds.roundLengthMinutes} min` : undefined}
                    duration={trackDuration(t)}
                    kind="audio"
                    accent={colors.accentAlt}
                    description={t.description}
                    expanded={expandedId === t.id}
                    onToggle={() => setExpandedId(prev => prev === t.id ? null : t.id)}
                    onPlay={() => openPlayer(t, playable, { autoStart: true })}
                  />
                );
              });
            })()}

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
                <Text style={styles.siblingText}>{noOrphan(`Back to Silent Mind · ${smTwin.title}`)}</Text>
                <Text style={styles.siblingHint}>{noOrphan('The guided, untimed version of these practices.')}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      </Animated.View>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  column: { width: '100%', alignSelf: 'center' },
  // Header rendered by <ProgramHeader>. We keep `title` for the
  // "Not found" error path only.
  title: { ...type.display, color: colors.text, fontSize: 22, textAlign: 'center', lineHeight: 28 },
  // Same audio-list panel as the SM detail page — semi-transparent
  // surface that groups the QM tracks into one block, distinct from
  // the "Back to Silent Mind" sibling CTA below. Generous outer
  // margins so the section header, the audio rows, and the sibling
  // CTA each have their own breath.
  listPad: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
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
