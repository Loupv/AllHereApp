import { ScrollView, Text, View, Image, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { newsArticles } from '../../src/content/news';
import { useRemoteStore } from '../../src/content/remoteStore';
import { colors, radius, spacing, type } from '../../src/theme';

const openExternal = (url: string) => {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
  else Linking.openURL(url).catch(() => {});
};

export default function NewsArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const remoteList = useRemoteStore(s => s.news);
  const article =
    newsArticles.find(a => a.id === id) ??
    remoteList.find(a => a.id === id);

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
        <Image source={article.image} style={styles.hero} resizeMode="cover" />
        <View style={styles.body}>
          <View style={styles.meta}>
            <Text style={styles.eyebrow}>{article.eyebrow}</Text>
            <Text style={styles.date}>{article.date}</Text>
          </View>
          <Text style={styles.title}>{article.title}</Text>
          {article.body.length > 0
            ? article.body.map((p, i) => (
                <Text key={i} style={styles.paragraph}>{p}</Text>
              ))
            : (
              <Text style={styles.paragraph}>{article.excerpt}</Text>
            )}
          {article.link ? (
            <Pressable onPress={() => openExternal(article.link!)} hitSlop={8} style={styles.readMoreBtn}>
              <Text style={styles.readMore}>Read the full article on allhere.org →</Text>
            </Pressable>
          ) : null}
        </View>
        <AboutFooter />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.md },
  hero: { width: '100%', height: 240 },
  body: { padding: spacing.lg, alignItems: 'center' },
  meta: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  eyebrow: { ...type.overline, color: colors.accent },
  date: { ...type.overline, color: colors.textDim },
  title: {
    ...type.display, color: colors.text, fontSize: 26,
    textAlign: 'center', marginBottom: spacing.lg, lineHeight: 32,
  },
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
