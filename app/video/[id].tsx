import { useEffect } from 'react';
import { createElement } from 'react';
import { ScrollView, Text, View, Image, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { HtmlViewer } from '../../src/components/HtmlViewer';
import { videoItems } from '../../src/content/catalog';
import { useRemoteStore } from '../../src/content/remoteStore';
import { useNotifications } from '../../src/player/notificationStore';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, radius, spacing, type } from '../../src/theme';

const openExternal = (url: string) => {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
  else Linking.openURL(url).catch(() => {});
};

export default function VideoArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const remoteList = useRemoteStore(s => s.videos);
  const markSeen = useNotifications(s => s.markSeen);
  const { columnMax } = useLayout();
  const video =
    videoItems.find(v => v.id === id) ??
    remoteList.find(v => v.id === id);
  useEffect(() => {
    if (video) markSeen('media', video.id);
  }, [video?.id]);

  if (!video) {
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
          {video.embedUrl && Platform.OS === 'web'
            ? createElement('iframe', {
                src: video.embedUrl,
                style: { width: '100%', aspectRatio: '16 / 9', height: 'auto', border: 0, display: 'block' },
                allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                allowFullScreen: true,
              })
            : <Image source={video.poster} style={styles.hero} resizeMode="cover" />}
          <View style={styles.body}>
            {video.duration ? <Text style={styles.date}>{video.duration}</Text> : null}
            <Text style={styles.title}>{video.title}</Text>
            {video.subtitle ? <Text style={styles.subtitle}>{video.subtitle}</Text> : null}
            {video.contentHtml ? (
              <View style={styles.html}>
                <HtmlViewer html={video.contentHtml} link={video.link} />
              </View>
            ) : null}
            {video.link ? (
              <Pressable onPress={() => openExternal(video.link!)} hitSlop={8} style={styles.readMoreBtn}>
                <Text style={styles.readMore}>Open on allhere.org →</Text>
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
  hero: { width: '100%', height: 220 },
  body: { padding: spacing.lg, alignItems: 'center' },
  date: { ...type.overline, color: colors.textDim, marginBottom: spacing.sm },
  title: {
    ...type.display, color: colors.text, fontSize: 22,
    textAlign: 'center', marginBottom: spacing.md, lineHeight: 28, maxWidth: 620,
  },
  subtitle: {
    ...type.caption, color: colors.textMuted,
    textAlign: 'center', marginBottom: spacing.lg, maxWidth: 620, lineHeight: 20,
  },
  html: { alignSelf: 'stretch', marginTop: spacing.md },
  readMoreBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: 1,
  },
  readMore: { ...type.caption, color: colors.accent },
});
