import { useState } from 'react';
import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import type { AudioTrack, Volet } from '../content/catalog';
import { usePlayerStore } from '../player/store';
import { useProgress } from '../player/progressStore';
import { colors, radius, spacing, type } from '../theme';
import { Collapse } from './Collapse';

export function VoletAccordion({ volet, defaultOpen = false, secondary = false }: { volet: Volet; defaultOpen?: boolean; secondary?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const openPlayer = usePlayerStore(s => s.open);
  const locked = volet.locked;
  const qmTracks = volet.qmTracks ?? [];
  const hasQm = qmTracks.length > 0;

  return (
    <View style={[styles.card, secondary && styles.cardSecondary, locked && styles.cardLocked]}>
      <Pressable
        onPress={() => !locked && setOpen(o => !o)}
        style={({ pressed }) => [styles.header, pressed && !locked && styles.pressed]}
      >
        <View style={[styles.circleWrap, locked && styles.circleLocked]}>
          {volet.image ? (
            <Image source={volet.image} style={styles.circle} resizeMode="cover" />
          ) : (
            <View style={[styles.circle, styles.circleFallback]}>
              <Text style={styles.circleLetter}>{volet.title[0]}</Text>
            </View>
          )}
          {locked ? <View style={styles.lockOverlay}><Text style={styles.lockIcon}>🔒</Text></View> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.partLabel}>{volet.title.toUpperCase()}</Text>
          <Text style={styles.partTitle}>{volet.subtitle}</Text>
          {volet.tagline ? <Text style={styles.partTagline}>{volet.tagline}</Text> : null}
          {locked ? (
            <Text style={styles.lockedBadge}>Coming soon</Text>
          ) : (
            <Text style={styles.meta}>
              {volet.tracks.length + qmTracks.length} audio{volet.tracks.length + qmTracks.length > 1 ? 's' : ''}
              {hasQm ? ` · includes ${qmTracks.length} QM` : ''}
            </Text>
          )}
        </View>
        {!locked ? <Text style={styles.chevron}>{open ? '−' : '+'}</Text> : null}
      </Pressable>

      {!locked ? (
        <Collapse open={open}>
        <View style={styles.body}>
          {volet.description ? <Text style={styles.description}>{volet.description}</Text> : null}
          {volet.tracks.length > 0 ? (
            <>
              {volet.tracks.map((t, i) => (
                <TrackRow key={t.id} track={t} index={i} onPress={() => openPlayer(t)} />
              ))}
            </>
          ) : null}
          {hasQm ? (
            <>
              <View style={styles.qmDivider}>
                <View style={styles.qmLine} />
                <Text style={styles.qmLabel}>Quantified Meditation</Text>
                <View style={styles.qmLine} />
              </View>
              <Text style={styles.qmHint}>Short-round formats for tracked sessions.</Text>
              {qmTracks.map((track, i) => (
                <TrackRow key={track.id} track={track} index={i} qm onPress={() => openPlayer(track)} />
              ))}
            </>
          ) : null}
        </View>
        </Collapse>
      ) : null}

      {locked ? (
        <View style={styles.lockedBody}>
          <Text style={styles.lockedText}>{volet.lockedMessage ?? 'Coming soon.'}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TrackRow({ track, index, onPress, qm }: { track: AudioTrack; index: number; onPress: () => void; qm?: boolean }) {
  const isListened = useProgress(s => !!s.listened[track.id]);
  const isNext = useProgress(s => s.nextTrackId() === track.id);
  const soon = !!track.comingSoon;

  const body = (
    <>
      <View style={styles.leadIcon}>
        {soon ? (
          <Text style={styles.soonIcon}>•••</Text>
        ) : isListened ? (
          <Text style={styles.checkIcon}>✓</Text>
        ) : (
          <Text style={[styles.trackNumber, qm && styles.trackNumberQm]}>
            {qm ? 'QM' : String(index + 1).padStart(2, '0')}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.trackTitleRow}>
          <Text style={[styles.trackTitle, isListened && styles.trackTitleDone, soon && styles.trackTitleSoon]}>
            {track.title}
          </Text>
          {soon ? <Text style={styles.soonBadge}>SOON</Text> : null}
          {!soon && isNext ? <Text style={styles.nextBadge}>NEXT</Text> : null}
        </View>
        {!soon && track.rounds ? (
          <Text style={styles.trackFormat}>
            {track.rounds.max} rounds · {track.rounds.roundLengthMinutes} min each
          </Text>
        ) : null}
      </View>
      {!soon ? (
        <Text style={[styles.play, qm && styles.playQm, isListened && styles.playDone]}>▷</Text>
      ) : null}
    </>
  );

  if (soon) {
    return <View style={[styles.track, styles.trackSoon]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.track,
        qm && styles.trackQm,
        isNext && styles.trackNext,
        isListened && styles.trackListened,
        pressed && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardSecondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.07)',
    borderStyle: 'dashed',
  },
  cardLocked: { opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  pressed: { opacity: 0.75, backgroundColor: colors.surfaceElevated },
  circleWrap: {
    width: 72, height: 72, borderRadius: 36,
    overflow: 'hidden', borderColor: colors.accent, borderWidth: 2, position: 'relative',
  },
  circleLocked: { borderColor: colors.textDim },
  circle: { width: '100%', height: '100%' },
  circleFallback: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  circleLetter: { ...type.display, color: colors.text, fontSize: 28 },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  lockIcon: { fontSize: 24 },
  partLabel: { ...type.overline, color: colors.accent, marginBottom: 2 },
  partTitle: { ...type.h3, color: colors.text, marginBottom: 2 },
  partTagline: { ...type.caption, color: colors.textMuted, fontStyle: 'italic', marginBottom: 4 },
  meta: { ...type.overline, color: colors.textDim, fontSize: 10 },
  lockedBadge: { ...type.overline, color: colors.textDim, fontSize: 10, marginTop: 2 },
  chevron: { ...type.display, color: colors.accent, fontSize: 28 },
  body: { borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.md, gap: spacing.sm },
  description: { ...type.body, color: colors.textMuted, marginBottom: spacing.sm },
  track: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.sm + 4, borderRadius: radius.md,
    backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1,
  },
  trackQm: { borderColor: 'rgba(158,54,148,0.45)', backgroundColor: 'rgba(158,54,148,0.08)' },
  trackNext: { borderColor: colors.accent, borderWidth: 2, backgroundColor: 'rgba(158,54,148,0.14)' },
  trackListened: { opacity: 0.55 },
  trackSoon: { opacity: 0.45, borderStyle: 'dashed' },
  soonIcon: { color: colors.textDim, fontSize: 14, letterSpacing: 1 },
  soonBadge: {
    ...type.overline, color: colors.textDim, fontSize: 9,
    borderColor: colors.border, borderWidth: 1,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm,
  },
  trackTitleSoon: { color: colors.textMuted, fontStyle: 'italic' },
  leadIcon: { width: 32, alignItems: 'center' },
  checkIcon: { color: colors.accent, fontSize: 16, fontFamily: 'Montserrat_800ExtraBold' },
  trackNumber: { ...type.overline, color: colors.accent, width: 32, textAlign: 'center' },
  trackNumberQm: { color: colors.accent, fontFamily: 'Montserrat_800ExtraBold', fontSize: 10 },
  trackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  trackTitle: { ...type.h3, color: colors.text, fontSize: 14 },
  trackTitleDone: { color: colors.textMuted },
  nextBadge: {
    ...type.overline, color: colors.text, fontSize: 9,
    backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.sm, overflow: 'hidden',
  },
  trackMeta: { ...type.overline, color: colors.textDim, fontSize: 9, marginTop: 2 },
  trackFormat: { ...type.caption, color: colors.textMuted, fontSize: 11, marginTop: 3 },
  play: { ...type.h2, color: colors.accent },
  playQm: { color: colors.accent },
  playDone: { color: colors.textDim },
  qmDivider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  qmLine: { flex: 1, height: 1, backgroundColor: 'rgba(158,54,148,0.3)' },
  qmLabel: { ...type.overline, color: colors.accent, fontSize: 10 },
  qmHint: { ...type.caption, color: colors.textDim, fontStyle: 'italic', marginBottom: spacing.sm },
  lockedBody: {
    borderTopColor: colors.border, borderTopWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  lockedText: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
});
