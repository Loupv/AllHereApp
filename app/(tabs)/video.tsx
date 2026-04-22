import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { SeeMoreLink } from '../../src/components/SeeMoreLink';
import { videoItems, MediaKind } from '../../src/content/catalog';
import { useVideoFeed } from '../../src/content/remote';
import { useVideoStore } from '../../src/player/videoStore';
import { useNotifications } from '../../src/player/notificationStore';
import { colors, radius, spacing, type } from '../../src/theme';

const KIND_ICON: Record<MediaKind, string> = {
  video: '▶',
  audio: '♪',
  article: '¶',
};

const KIND_LABEL: Record<MediaKind, string> = {
  video: 'WATCH',
  audio: 'LISTEN',
  article: 'READ',
};

export default function VideoScreen() {
  const router = useRouter();
  const openVideo = useVideoStore(s => s.open);
  const seen = useNotifications(s => s.seenMedia);
  const markSeen = useNotifications(s => s.markSeen);
  const markAllSeen = useNotifications(s => s.markAllSeen);

  const { items, loading, refreshing, refresh } = useVideoFeed(videoItems);
  const unreadCount = items.filter(v => !seen[v.id]).length;

  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="video">
      <ScrollView
        contentContainerStyle={styles.content}
        onRefresh={refresh}
        refreshing={refreshing}
      >
        <View style={styles.hero}>
          <Image source={require('../../assets/images/hero/thepractice.jpg')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>MEDIA HUB</Text>
            <Text style={styles.title}>Watch, listen & read</Text>
          </View>
        </View>
        {unreadCount > 0 ? (
          <View style={styles.toolbar}>
            <Text style={styles.toolbarHint}>{unreadCount} unread</Text>
            <Pressable
              onPress={() => {
                const every = Array.from(new Set([
                  ...videoItems.map(v => v.id),
                  ...items.map(v => v.id),
                ]));
                markAllSeen('media', every);
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.markAll, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>
          </View>
        ) : null}
        {loading && items.length === 0 ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : null}
        {items.map(v => {
          const kind: MediaKind = v.kind ?? (v.source ? 'video' : 'article');
          const isUnread = !seen[v.id];
          return (
            <Pressable
              key={v.id}
              onPress={() => {
                markSeen('media', v.id);
                if (v.remote) router.push(`/video/${v.id}`);
                else if (v.source) openVideo(v);
              }}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {isUnread ? <View style={styles.unreadStrip} /> : null}
              <View style={styles.posterWrap}>
                <Image source={v.poster} style={styles.poster} resizeMode="cover" />
                <View style={styles.posterOverlay} />
                {kind === 'video' ? (
                  <View style={styles.playBadge}>
                    <Text style={styles.playIcon}>▶</Text>
                  </View>
                ) : null}
                <View style={styles.kindBadge}>
                  <Text style={styles.kindIcon}>{KIND_ICON[kind]}</Text>
                  <Text style={styles.kindText}>{KIND_LABEL[kind]}</Text>
                </View>
                {v.duration ? (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{v.duration}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{v.title}</Text>
                {v.subtitle ? <Text style={styles.cardSubtitle} numberOfLines={2}>{v.subtitle}</Text> : null}
              </View>
            </Pressable>
          );
        })}
        <SeeMoreLink label="Media" url="https://allhere.org/media-hub/" />
        <AboutFooter />
      </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  hero: { height: 180, justifyContent: 'flex-end', overflow: 'hidden', marginBottom: spacing.md },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.55)' },
  heroText: { padding: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text, fontSize: 32, textAlign: 'center' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },
  toolbarHint: { ...type.overline, color: colors.accent, fontSize: 10 },
  markAll: {
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderColor: colors.border, borderWidth: 1,
    backgroundColor: colors.surface,
  },
  markAllText: { ...type.overline, color: colors.text, fontSize: 9, letterSpacing: 1 },
  markAllDisabled: { opacity: 0.4 },
  unreadStrip: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
    backgroundColor: colors.accent, zIndex: 2,
  },
  card: {
    position: 'relative',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pressed: { opacity: 0.8 },
  posterWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', position: 'relative' },
  poster: { width: '100%', height: '100%' },
  posterOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.3)' },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    marginTop: -32,
    marginLeft: -32,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: colors.text, fontSize: 22, marginLeft: 4 },
  kindBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kindIcon: { color: colors.accent, fontSize: 11 },
  kindText: { ...type.overline, color: colors.text, fontSize: 9, letterSpacing: 1.5 },
  durationBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  durationText: { ...type.overline, color: colors.text, fontSize: 10 },
  cardBody: { padding: spacing.md },
  cardTitle: { ...type.h2, color: colors.text, fontSize: 17, marginBottom: 4 },
  cardSubtitle: { ...type.caption, color: colors.textDim },
  loading: { ...type.caption, color: colors.textDim, textAlign: 'center', paddingVertical: spacing.lg },
});
