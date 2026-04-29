import { useState } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Animated, { Keyframe } from 'react-native-reanimated';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { ContentCard } from '../../src/components/ContentCard';
import { ProgramHeader } from '../../src/components/ProgramHeader';
import { silentMindVolets, qmVolets, silentMindProgram, trackDuration } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useProgress, isTrackUnlocked } from '../../src/player/progressStore';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing, type } from '../../src/theme';
import { noOrphan } from '../../src/utils/noOrphan';

// Entering: incoming page slides 40 px from the right while fading
// from 0 → 1 — reads as a crossfade DURING the slide rather than a
// hard slide-on-top.
const detailEnter = new Keyframe({
  0:   { opacity: 0, transform: [{ translateX: 40 }] },
  60:  { opacity: 0.6, transform: [{ translateX: 16 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }] },
}).duration(320);

// Exiting: same trajectory in reverse — when the user dismisses the
// detail page (header back, swipe-back gesture, OS back button) the
// page slides back to the right and fades out, mirroring the entry.
const detailExit = new Keyframe({
  0:   { opacity: 1, transform: [{ translateX: 0 }] },
  40:  { opacity: 0.6, transform: [{ translateX: 16 }] },
  100: { opacity: 0, transform: [{ translateX: 40 }] },
}).duration(260);

export default function VoletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const listened = useProgress(s => s.listened);
  const { columnMax } = useLayout();
  const volet = silentMindVolets.find(v => v.id === id);
  // Mirror volet in the QM tab — same id suffix ('part1' / 'part2' / 'part3').
  const qmTwin = qmVolets.find(v => v.id === id);
  // Single-open accordion — `expandedId` holds the currently-open card,
  // so tapping a different card auto-closes the previous one.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!volet) {
    return (
      <Background color={colors.bgTab}>
        <Text style={[styles.title, { padding: spacing.lg }]}>Not found</Text>
      </Background>
    );
  }

  return (
    <Background color={colors.bgTab}>
      <Stack.Screen options={{ title: volet.title }} />
      {/* Crossfade-while-sliding: a custom Keyframe combines a short
          horizontal slide (40 px from the right) with an opacity
          ramp 0 → 1, so the incoming page emerges through the
          outgoing one rather than covering it with a hard edge. The
          shared root gradient + EnergyColumn behind both pages keeps
          the backdrop continuous, reinforcing the "same screen
          morphing" feel. */}
      <Animated.View style={{ flex: 1 }} entering={detailEnter} exiting={detailExit}>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={[styles.column, { maxWidth: columnMax }]}>
          <ProgramHeader
            eyebrow={
              volet.title
                ? `${silentMindProgram.eyebrow} · ${volet.title}`
                : silentMindProgram.eyebrow
            }
            title={volet.subtitle}
            description={volet.description}
            accent={colors.accent}
          />

          <View style={styles.listPad}>
          {(() => {
            const playable = volet.tracks.filter(t => !t.comingSoon);
            // Sequential unlock: see `isTrackUnlocked` in progressStore
            // for the full walk. Intro is fully open; Part 1/2/3 SM
            // chains gate per-track, and matching QM tracks unlock on
            // the same beat as their SM counterpart (by title match).
            // Previously inserted "Our sections" divider after intro-3
            // ("Prepare the space"). That track is now pulled, and the
            // remaining 3 intros all live in the same flat list — no
            // mid-list divider needed anymore.
            const showDividerAfter: string | null = null;
            const cards: React.ReactNode[] = [];
            volet.tracks.forEach((t) => {
              const locked = !t.comingSoon && !isTrackUnlocked(t.id, listened);
              cards.push(
                t.comingSoon ? (
                  <ContentCard
                    key={t.id}
                    title={t.title}
                    duration="SOON"
                    kind="audio"
                    disabled
                  />
                ) : locked ? (
                  // Locked = same dimmed treatment as coming-soon, but
                  // labelled "LOCKED" + a tooltip-y subtitle so the
                  // user understands why and what to do about it.
                  <ContentCard
                    key={t.id}
                    title={t.title}
                    subtitle="Listen to the previous audio first"
                    duration="LOCKED"
                    kind="audio"
                    disabled
                  />
                ) : (
                  <ContentCard
                    key={t.id}
                    title={t.title}
                    duration={trackDuration(t)}
                    kind="audio"
                    description={t.description}
                    expanded={expandedId === t.id}
                    onToggle={() => setExpandedId(prev => prev === t.id ? null : t.id)}
                    onPlay={() => openPlayer(t, playable, { autoStart: true })}
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
                <Text style={styles.siblingText}>{noOrphan(`Go to QM Training · ${volet.title}`)}</Text>
                <Text style={styles.siblingHint}>{noOrphan('Short, timed rounds with pauses, for the same practices.')}</Text>
              </View>
              <Text style={[styles.siblingArrow, { color: colors.accentAlt }]}>→</Text>
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
  // Header rendered by <ProgramHeader> — no inline header styles.
  // We still keep `title` for the rare error case ("Not found").
  title: { ...type.display, color: colors.text, fontSize: 22, textAlign: 'center', lineHeight: 28 },
  // Audio-list panel — soft semi-transparent surface that visually
  // groups the per-Part audios into a single block, distinct from the
  // "Go to QM Training" / "Back to Silent Mind" sibling CTA below. The
  // panel sits on top of the shared atmospheric gradient + EnergyColumn,
  // so we deliberately keep both the fill and the border very low-
  // opacity — the goal is "card-shaped breathing space", not a heavy
  // surface that crowds out the backdrop. Generous top + bottom margins
  // around the block (and inside the panel) so the section header,
  // the audio rows, and the sibling CTA each get their own beat.
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
