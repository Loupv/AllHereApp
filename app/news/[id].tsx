import { useEffect } from 'react';
import { ScrollView, Text, View, Image, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../../src/components/Background';
import { BackButton } from '../../src/components/BackButton';
import { AboutFooter } from '../../src/components/AboutFooter';
import { HtmlViewer } from '../../src/components/HtmlViewer';
import { EmbedPlayer } from '../../src/components/EmbedPlayer';
import { newsArticles } from '../../src/content/news';
import { useRemoteStore } from '../../src/content/remoteStore';
import { useNotifications } from '../../src/player/notificationStore';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, radius, spacing, type } from '../../src/theme';
import { noOrphan } from '../../src/utils/noOrphan';

const openExternal = (url: string) => {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
  else Linking.openURL(url).catch(() => {});
};

export default function NewsArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const remoteList = useRemoteStore(s => s.news);
  const markSeen = useNotifications(s => s.markSeen);
  const { columnMax } = useLayout();
  const insets = useSafeAreaInsets();
  const article =
    newsArticles.find(a => a.id === id) ??
    remoteList.find(a => a.id === id);
  useEffect(() => {
    if (article) markSeen('news', article.id);
  }, [article?.id]);

  if (!article) {
    return (
      <Background>
        <Text style={[styles.title, { padding: spacing.lg }]}>Not found</Text>
      </Background>
    );
  }

  return (
    <Background>
      <Stack.Screen options={{ title: '' }} />
      <BackButton />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        // iOS default delaysContentTouches=true holds the touch for
        // 150 ms before passing it to inner Pressables. During a
        // momentum scroll that delay reads as the scroll "freezing"
        // when you re-touch — the new drag should pick up the
        // motion seamlessly instead.
        delaysContentTouches={false}
      >
        <View style={[styles.column, { maxWidth: columnMax }]}>
          {/* Title + meta render BEFORE the embed so the BackButton
              chevron lands over the dark header band, not the video
              frame where it was hard to see. */}
          <View style={styles.header}>
            <View style={styles.meta}>
              <Text style={styles.eyebrow}>{article.eyebrow}</Text>
              <Text style={styles.date}>{article.date}</Text>
            </View>
            <Text style={styles.title}>{noOrphan(article.title)}</Text>
          </View>
          {article.embedUrl
            ? <EmbedPlayer src={article.embedUrl} />
            : <Image source={article.image} style={styles.hero} resizeMode="cover" />}
          <View style={styles.body}>
            {article.contentHtml ? (
              <View style={styles.html}>
                <HtmlViewer html={article.contentHtml} link={article.link} />
              </View>
            ) : (
              article.body.map((p, i) => (
                <Text key={i} style={styles.paragraph}>{noOrphan(p)}</Text>
              ))
            )}
            {article.link ? (
              <Pressable onPress={() => openExternal(article.link!)} hitSlop={8} style={styles.readMoreBtn}>
                <Text style={styles.readMore}>{noOrphan('Read the full article on allhere.org →')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <AboutFooter />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.md, alignItems: 'center' },
  column: { width: '100%', alignSelf: 'center' },
  hero: { width: '100%', height: 240 },
  // Header band above the embed — leaves room for the absolute
  // BackButton (top-left chevron) so it sits over the dark header
  // surface instead of the video frame.
  header: { padding: spacing.lg, paddingTop: spacing.xl, alignItems: 'center' },
  body: { padding: spacing.lg, alignItems: 'center' },
  meta: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  eyebrow: { ...type.overline, color: colors.accent },
  date: { ...type.overline, color: colors.textDim },
  title: {
    ...type.display, color: colors.text, fontSize: 26,
    textAlign: 'center', marginBottom: spacing.lg, lineHeight: 32,
  },
  html: { alignSelf: 'stretch' },
  paragraph: {
    ...type.body, color: colors.textMuted,
    marginBottom: spacing.md, lineHeight: 24, maxWidth: 620,
  },
  readMoreBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: 1,
  },
  readMore: { ...type.caption, color: colors.accent },
});
