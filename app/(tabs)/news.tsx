import { useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { SeeMoreLink } from '../../src/components/SeeMoreLink';
import { newsArticles } from '../../src/content/news';
import { fetchUpdates, useRemoteList, RemoteNewsArticle } from '../../src/content/remote';
import { useNotifications } from '../../src/player/notificationStore';
import { colors, radius, spacing, type } from '../../src/theme';

const openExternal = (url: string) => {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
  else Linking.openURL(url).catch(() => {});
};

export default function NewsScreen() {
  const router = useRouter();
  const markRead = useNotifications(s => s.markNewsRead);
  useEffect(() => { markRead(); }, []);

  // Live list from allhere.org/wp-json/wp/v2/posts, with a fallback to the
  // bundled static articles so the tab is never empty (offline / fetch error).
  const { items, loading } = useRemoteList<RemoteNewsArticle>(
    'updates',
    fetchUpdates,
    newsArticles as unknown as RemoteNewsArticle[],
  );

  return (
    <Background color={colors.bgTab}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={require('../../assets/images/hero/news.jpg')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>LATEST UPDATES</Text>
            <Text style={styles.title}>News</Text>
          </View>
        </View>
        {loading && items.length === 0 ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : null}
        {items.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              if (a.remote && a.link) openExternal(a.link);
              else router.push(`/news/${a.id}`);
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Image source={a.image as any} style={styles.image} resizeMode="cover" />
            <View style={styles.cardBody}>
              <View style={styles.cardMeta}>
                <Text style={styles.cardEyebrow}>{a.eyebrow}</Text>
                <Text style={styles.date}>{a.date}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{a.title}</Text>
              <Text style={styles.cardExcerpt} numberOfLines={3}>{a.excerpt}</Text>
            </View>
          </Pressable>
        ))}
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
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pressed: { opacity: 0.8 },
  image: { width: '100%', height: 180 },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { ...type.overline, color: colors.accent, fontSize: 10 },
  date: { ...type.overline, color: colors.textDim, fontSize: 10 },
  cardTitle: { ...type.h2, color: colors.text, fontSize: 18, lineHeight: 24 },
  cardExcerpt: { ...type.body, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  loading: { ...type.caption, color: colors.textDim, textAlign: 'center', paddingVertical: spacing.lg },
});
