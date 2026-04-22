import { useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Linking, Platform, RefreshControl } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { SeeMoreLink } from '../../src/components/SeeMoreLink';
import { videoItems } from '../../src/content/catalog';
import { useVideoFeed } from '../../src/content/remote';
import { useVideoStore } from '../../src/player/videoStore';
import { useNotifications } from '../../src/player/notificationStore';
import { colors, radius, spacing, type } from '../../src/theme';

const openExternal = (url: string) => {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
  else Linking.openURL(url).catch(() => {});
};

export default function VideoScreen() {
  const openVideo = useVideoStore(s => s.open);
  const markRead = useNotifications(s => s.markVideoRead);
  useEffect(() => { markRead(); }, []);

  const { items, loading, refreshing, refresh } = useVideoFeed(videoItems);

  return (
    <Background color={colors.bgTab}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <View style={styles.hero}>
          <Image source={require('../../assets/images/hero/thepractice.jpg')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>VIDEO</Text>
            <Text style={styles.title}>Watch & learn</Text>
          </View>
        </View>
        {loading && items.length === 0 ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : null}
        {items.map(v => (
          <Pressable
            key={v.id}
            onPress={() => {
              // Remote items link out to allhere.org (site hosts the embed);
              // bundled items keep playing inline via the VideoStore.
              if (v.remote && v.link) openExternal(v.link);
              else if (v.source) openVideo(v);
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.posterWrap}>
              <Image source={v.poster} style={styles.poster} resizeMode="cover" />
              <View style={styles.posterOverlay} />
              <View style={styles.playBadge}>
                <Text style={styles.playIcon}>▶</Text>
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
        ))}
        <SeeMoreLink label="Media" url="https://allhere.org/media-hub/" />
        <AboutFooter />
      </ScrollView>
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
