import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { AudioTrack } from '../content/catalog';
import { trackDuration } from '../content/catalog';
import { useTrackDownload } from '../hooks/useTrackDownload';
import { colors, radius, spacing, type as typo } from '../theme';

/**
 * Track-detail bottom sheet shown when the user taps a track title in
 * the silent-mind-tree. Replaces the in-line accordion: keeps the tree
 * visually clean (no overflowing description blocks on the side), and
 * gives the description full screen width to breathe.
 *
 * Tap on a SM/QM dot still opens the Player directly; tap on the title
 * label opens THIS sheet. The sheet exposes its own Play CTA so the
 * two affordances feel distinct.
 */
type Props = {
  visible: boolean;
  track: AudioTrack | null;
  accent: string;
  locked?: boolean;
  /** Whatever blurb to show below the title — already normalised from
   *  the catalog's `string | DescriptionLine[]` into a single string
   *  by the caller. */
  description?: string;
  onClose: () => void;
  /** Called when the user taps the Play CTA. The caller closes the
   *  sheet AND opens the Player. */
  onPlay: () => void;
};

export function TrackInfoSheet({
  visible,
  track,
  accent,
  locked = false,
  description,
  onClose,
  onPlay,
}: Props) {
  const insets = useSafeAreaInsets();
  const duration = track ? trackDuration(track) : null;
  // Offline-download chip — same hook the ContentCard rows used to
  // wire. Hidden when there's nothing remote to download (e.g. tracks
  // bundled directly into the app) and when the track is locked
  // (locked tracks can't be played, no point caching the audio yet).
  const download = useTrackDownload(track ?? undefined);
  const showDownload = !!track && !locked;
  const downloadLabel =
    download.state === 'cached'
      ? '✓ Saved offline'
      : download.state === 'downloading'
        ? `Downloading… ${Math.round(download.progress)}%`
        : download.state === 'error'
          ? 'Retry download'
          : '⬇ Save offline';

  // Vertical-swipe-down dismiss — same UX as AccountSheet. Activates
  // only on a clearly downward drag so the inner ScrollView can scroll
  // upward normally.
  const dismissPan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetY(-8)
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 80 || e.velocityY > 600) {
        runOnJS(onClose)();
      }
    });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={StyleSheet.absoluteFill}
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(180)}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <GestureDetector gesture={dismissPan}>
          <Animated.View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(220)}
          >
            <View style={styles.handle} />
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {track ? (
                <>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={3}>
                      {track.title}
                    </Text>
                    {duration ? (
                      <Text style={styles.duration}>{duration}</Text>
                    ) : null}
                  </View>
                  {description ? (
                    <Text style={styles.description}>{description}</Text>
                  ) : null}
                  {locked ? (
                    <Text style={[styles.locked, { color: colors.textDim }]}>
                      LOCKED — finish the previous track to unlock
                    </Text>
                  ) : (
                    <>
                      <Pressable
                        onPress={onPlay}
                        style={({ pressed }) => [
                          styles.playBtn,
                          { borderColor: accent, backgroundColor: pressed ? `${accent}25` : `${accent}15` },
                        ]}
                      >
                        <Text style={[styles.playBtnText, { color: accent }]}>
                          ▶  Play
                        </Text>
                      </Pressable>
                      {showDownload ? (
                        <Pressable
                          onPress={
                            download.state === 'downloading'
                              ? undefined
                              : () => { download.download(); }
                          }
                          disabled={download.state === 'downloading'}
                          style={({ pressed }) => [
                            styles.downloadBtn,
                            pressed && { opacity: 0.7 },
                            download.state === 'cached' && styles.downloadBtnCached,
                          ]}
                        >
                          <Text style={styles.downloadBtnText}>
                            {downloadLabel}
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </>
              ) : null}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: '#091226',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: spacing.md,
  },
  scrollArea: { },
  scrollContent: { paddingBottom: spacing.lg },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    ...typo.h2,
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
  },
  duration: {
    ...typo.caption,
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  description: {
    ...typo.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  locked: {
    ...typo.overline,
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  playBtn: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  playBtnText: {
    ...typo.overline,
    fontSize: 13,
    letterSpacing: 1.8,
  },
  // Secondary CTA below the Play pill — keeps the offline-download
  // affordance one level down visually so Play stays primary. Cached
  // state gets a softer, "already done" treatment.
  downloadBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  downloadBtnCached: {
    borderColor: 'rgba(255,255,255,0.10)',
    opacity: 0.7,
  },
  downloadBtnText: {
    ...typo.overline,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.4,
  },
});
