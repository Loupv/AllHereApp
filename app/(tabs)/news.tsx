import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { SeeMoreLink } from '../../src/components/SeeMoreLink';
import { newsArticles } from '../../src/content/news';
import { useNewsFeed } from '../../src/content/remote';
import { useNotifications } from '../../src/player/notificationStore';
import { colors, radius, spacing, type } from '../../src/theme';

export default function NewsScreen() {
  const router = useRouter();
  const seen = useNotifications(s => s.seenNews);
  const markSeen = useNotifications(s => s.markSeen);
  const markAllSeen = useNotifications(s => s.markAllSeen);

  const { items, loading, refreshing, refresh } = useNewsFeed(newsArticles);
  const unreadCount = items.filter(a => !seen[a.id]).length;

  return (
    <Background color={colors.bgTab}>
      <ScrollView
        contentContainerStyle={styles.content}
        onRefresh={refresh}
        refreshing={refreshing}
      >
        <View style={styles.hero}>
          <Image source={require('../../assets/images/hero/news.jpg')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>LATEST UPDATES</Text>
            <Text style={styles.title}>News</Text>
          </View>
        </View>
        {unreadCount > 0 ? (
          <View style={styles.toolbar}>
            <Text style={styles.toolbarHint}>{unreadCount} unread</Text>
            <Pressable
              onPress={() => markAllSeen('news', items.map(a => a.id))}
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
        {items.map((a) => {
          const isUnread = !seen[a.id];
          return (
            <Pressable
              key={a.id}
              onPress={() => {
                markSeen('news', a.id);
                router.push(`/news/${a.id}`);
              }}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {isUnread ? <View style={styles.unreadStrip} /> : null}
              <Image source={a.image} style={styles.image} resizeMode="cover" />
              <View style={styles.cardBody}>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardEyebrow}>{a.eyebrow}</Text>
                  <Text style={styles.date}>{a.date}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{a.title}</Text>
                <Text style={styles.cardExcerpt} numberOfLines={3}>{a.excerpt}</Text>
              </View>
            </Pressable>
          );
        })}
        <SeeMoreLink label="Updates" url="https://allhere.org/updates/" />
        <AboutFooter />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.md },
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
  unreadStrip: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
    backgroundColor: colors.accent, zIndex: 2,
  },
  image: { width: '100%', height: 180 },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { ...type.overline, color: colors.accent, fontSize: 10 },
  date: { ...type.overline, color: colors.textDim, fontSize: 10 },
  cardTitle: { ...type.h2, color: colors.text, fontSize: 18, lineHeight: 24 },
  cardExcerpt: { ...type.body, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  loading: { ...type.caption, color: colors.textDim, textAlign: 'center', paddingVertical: spacing.lg },
});
