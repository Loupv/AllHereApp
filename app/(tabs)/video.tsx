import { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { SeeMoreLink } from '../../src/components/SeeMoreLink';
import { videoItems, type VideoItem, type MediaKind } from '../../src/content/catalog';
import { useVideoFeed, useNewsFeed } from '../../src/content/remote';
import { newsArticles, type NewsArticle } from '../../src/content/news';
import { useVideoStore } from '../../src/player/videoStore';
import { useNotifications } from '../../src/player/notificationStore';
import { KindIcon } from '../../src/components/KindIcon';
import { useTabBarPadding } from '../../src/hooks/useTabBarPadding';
import { useLayout, CONTENT_MAX_WIDTH as CONTENT_MAX_WIDTH_CONST } from '../../src/hooks/useLayout';
import { colors, radius, spacing, type } from '../../src/theme';

const KIND_ICON: Record<MediaKind, string> = {
  video: '▶',
  audio: '♪',
  article: '¶',
};

const KIND_LABEL: Record<MediaKind, string> = {
  video: 'WATCH',
  audio: 'LISTEN',
  // 'READ' was being misread as 'already read' — use ARTICLE which
  // maps cleanly to the content type instead of the activity.
  article: 'ARTICLE',
};

// Media-kind toggles — each can be turned on/off independently. Defaults
// to all three on, so the Media tab surfaces everything. The user can
// peel back types they're not interested in right now.
const TOGGLE_KINDS: MediaKind[] = ['video', 'audio', 'article'];

// Normalised shape used by the unified list — covers video items AND
// news articles so the tab can render both with the same card component.
type MediaRow = {
  id: string;
  title: string;
  subtitle?: string;
  duration?: string;
  poster: any;
  kind: MediaKind;
  date?: string;          // ISO-ish yyyy-mm-dd, used to sort newest-first
  // source: either a playable video (video), or a route on the News
  // detail page (article), or the remote link (remote items).
  href:
    | { type: 'video-inline'; video: VideoItem }
    | { type: 'video-detail'; id: string }
    | { type: 'news-detail'; id: string };
};

const toVideoRow = (v: VideoItem): MediaRow => ({
  id: v.id,
  title: v.title,
  subtitle: v.subtitle,
  duration: v.duration,
  poster: v.poster,
  kind: v.kind ?? (v.source ? 'video' : 'article'),
  date: v.duration, // for remote items duration holds the ISO date
  href: v.remote
    ? { type: 'video-detail', id: v.id }
    : { type: 'video-inline', video: v },
});

const toNewsRow = (a: NewsArticle): MediaRow => ({
  id: a.id,
  title: a.title,
  subtitle: a.excerpt,
  duration: a.date,
  poster: a.image,
  kind: 'article',
  date: a.date,
  href: { type: 'news-detail', id: a.id },
});

export default function VideoScreen() {
  const router = useRouter();
  const tabPad = useTabBarPadding();
  const { gridColumns } = useLayout();
  const openVideo = useVideoStore(s => s.open);
  const seen = useNotifications(s => s.seenMedia);
  const markSeen = useNotifications(s => s.markSeen);
  const markAllSeen = useNotifications(s => s.markAllSeen);

  // Merged feed: WP news + WP media + bundled fallbacks. Both hooks keep
  // their own cache / refresh controls; we fire refresh on both at once.
  const video = useVideoFeed(videoItems);
  const news = useNewsFeed(newsArticles);

  const rows: MediaRow[] = [
    ...video.items.map(toVideoRow),
    ...news.items.map(toNewsRow),
  ];
  // Sort newest-first when a date is available, otherwise keep insertion
  // order so bundled placeholders stay grouped.
  rows.sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    return 0;
  });
  const loading = video.loading || news.loading;
  const refreshing = video.refreshing || news.refreshing;
  const refresh = () => { video.refresh(); news.refresh(); };

  const [enabled, setEnabled] = useState<Record<MediaKind, boolean>>({
    video: true, audio: true, article: true,
  });
  const toggle = (k: MediaKind) => setEnabled(s => ({ ...s, [k]: !s[k] }));
  const visible = rows.filter(r => enabled[r.kind]);
  const counts: Record<MediaKind, number> = {
    video: rows.filter(r => r.kind === 'video').length,
    audio: rows.filter(r => r.kind === 'audio').length,
    article: rows.filter(r => r.kind === 'article').length,
  };

  const unreadCount = visible.filter(r => !seen[r.id]).length;

  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="video">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabPad }]}
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
        <View style={styles.filterRow}>
          {TOGGLE_KINDS.map(k => {
            const on = enabled[k];
            const n = counts[k];
            return (
              <Pressable
                key={k}
                onPress={() => toggle(k)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.toggle,
                  on && styles.toggleOn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <KindIcon kind={k} color={on ? colors.text : colors.textDim} size={18} />
                <Text style={[styles.toggleCount, on && styles.toggleCountOn]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        {unreadCount > 0 ? (
          <View style={styles.toolbar}>
            <Text style={styles.toolbarHint}>{unreadCount} unread</Text>
            <Pressable
              onPress={() => markAllSeen('media', visible.map(r => r.id))}
              hitSlop={8}
              style={({ pressed }) => [styles.markAll, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>
          </View>
        ) : null}
        {loading && visible.length === 0 ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : null}
        <View style={gridColumns === 2 ? styles.grid : undefined}>
        {visible.map(r => {
          const isUnread = !seen[r.id];
          return (
            <Pressable
              key={r.id}
              onPress={() => {
                markSeen('media', r.id);
                const h = r.href;
                if (h.type === 'video-inline') openVideo(h.video);
                else if (h.type === 'video-detail') router.push(`/video/${h.id}` as any);
                else if (h.type === 'news-detail') router.push(`/news/${h.id}` as any);
              }}
              style={({ pressed }) => [
                styles.card,
                gridColumns === 2 && styles.cardInGrid,
                pressed && styles.pressed,
              ]}
            >
              {isUnread ? <View style={styles.unreadStrip} /> : null}
              <View style={styles.posterWrap}>
                <Image source={r.poster} style={styles.poster} resizeMode="cover" />
                <View style={styles.posterOverlay} />
                {r.kind === 'video' ? (
                  <View style={styles.playBadge}>
                    <Text style={styles.playIcon}>▶</Text>
                  </View>
                ) : null}
                <View style={styles.kindBadge}>
                  <Text style={styles.kindIcon}>{KIND_ICON[r.kind]}</Text>
                  <Text style={styles.kindText}>{KIND_LABEL[r.kind]}</Text>
                </View>
                {r.duration ? (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{r.duration}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{r.title}</Text>
                {r.subtitle ? <Text style={styles.cardSubtitle} numberOfLines={2}>{r.subtitle}</Text> : null}
              </View>
            </Pressable>
          );
        })}
        </View>
        <SeeMoreLink label="Media" url="https://allhere.org/media-hub/" />
        <AboutFooter />
      </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: {},
  hero: { height: 180, justifyContent: 'flex-end', overflow: 'hidden', marginBottom: spacing.md },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.55)' },
  heroText: { padding: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text, fontSize: 32, textAlign: 'center' },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  toggleOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(158,54,148,0.15)',
    opacity: 1,
  },
  toggleCount: { ...type.overline, color: colors.textDim, fontSize: 10 },
  toggleCountOn: { color: colors.text },
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH_CONST + spacing.lg * 2,
    alignSelf: 'center',
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
  cardInGrid: {
    width: '48%',
    marginHorizontal: 0,
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
