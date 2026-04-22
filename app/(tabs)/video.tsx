import { useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { videoItems } from '../../src/content/catalog';
import { useVideoStore } from '../../src/player/videoStore';
import { useNotifications } from '../../src/player/notificationStore';
import { colors, radius, spacing, type } from '../../src/theme';

export default function VideoScreen() {
  const open = useVideoStore(s => s.open);
  const markRead = useNotifications(s => s.markVideoRead);
  useEffect(() => { markRead(); }, []);
  return (
    <Background color={colors.bgTab}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={require('../../assets/images/hero/thepractice.jpg')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>VIDEO</Text>
            <Text style={styles.title}>Watch & learn</Text>
          </View>
        </View>
        {videoItems.map(v => (
          <Pressable
            key={v.id}
            onPress={() => open(v)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.posterWrap}>
              <Image source={v.poster} style={styles.poster} resizeMode="cover" />
              <View style={styles.posterOverlay} />
              <View style={styles.playBadge}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{v.duration}</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{v.title}</Text>
              {v.subtitle ? <Text style={styles.cardSubtitle}>{v.subtitle}</Text> : null}
            </View>
          </Pressable>
        ))}
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
});
