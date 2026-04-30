import { useEffect } from 'react';
import { ScrollView, Text, View, Image, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Background } from '../../src/components/Background';
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.column, { maxWidth: columnMax }]}>
          {article.embedUrl
            ? <EmbedPlayer src={article.embedUrl} />
            : <Image source={article.image} style={styles.hero} resizeMode="cover" />}
          <View style={styles.body}>
            <View style={styles.meta}>
              <Text style={styles.eyebrow}>{article.eyebrow}</Text>
              <Text style={styles.date}>{article.date}</Text>
            </View>
            <Text style={styles.title}>{noOrphan(article.title)}</Text>
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
