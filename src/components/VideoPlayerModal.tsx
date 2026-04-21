import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useVideoStore } from '../player/videoStore';
import { colors, radius, spacing, type } from '../theme';

export function VideoPlayerModal() {
  const { video, isOpen } = useVideoStore();
  if (!video || !isOpen) return null;
  return (
    <Animated.View
      entering={SlideInDown.duration(280)}
      exiting={SlideOutDown.duration(220)}
      style={styles.overlay}
    >
      <VideoInner />
    </Animated.View>
  );
}

function VideoInner() {
  const { video, close } = useVideoStore();
  const player = useVideoPlayer(video?.source ?? null, (p) => {
    p.play();
  });

  useEffect(() => {
    return () => { try { player.pause(); } catch {} };
  }, []);

  if (!video) return null;
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={12}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
        <Text style={styles.eyebrow}>Now watching</Text>
        <View style={{ width: 50 }} />
      </View>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />
      <View style={styles.body}>
        <Text style={styles.title}>{video.title}</Text>
        {video.subtitle ? <Text style={styles.subtitle}>{video.subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, zIndex: 80 },
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  close: { ...type.caption, color: colors.text },
  eyebrow: { ...type.overline, color: colors.textMuted },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: radius.md },
  body: { padding: spacing.lg },
  title: { ...type.h1, color: colors.text, marginBottom: spacing.sm, fontSize: 22 },
  subtitle: { ...type.caption, color: colors.textMuted },
});
