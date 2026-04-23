import { Text, View, Image, Pressable, Linking, Platform, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { colors, radius, spacing, type } from '../../src/theme';

const openExternal = (url: string) => {
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
  else Linking.openURL(url).catch(() => {});
};

const pillars = [
  {
    icon: require('../../assets/images/icon-science.png'),
    title: 'Science',
    body:
      'We make meditation measurable with our advanced brain tracking system, validated by fundamental research and rigorous R&D.',
  },
  {
    icon: require('../../assets/images/icon-technology.png'),
    title: 'Technology',
    body:
      'We support meditation development by integrating research-grade EEG with real-time visualization and multisensory immersive technology.',
  },
  {
    icon: require('../../assets/images/icon-practice.png'),
    title: 'Meditation Practice',
    body:
      'We teach methods that reduce mind-wandering and enhance focal attention in order to achieve a profound state of presence — the Silent Mind.',
  },
];

export default function AboutTabScreen() {
  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="about">
        <ScrollView contentContainerStyle={styles.content}>
          <Image source={require('../../assets/images/lounge-1.jpg')} style={styles.hero} resizeMode="cover" />
          <View style={styles.body}>
            <Text style={styles.eyebrow}>About All Here</Text>
            <Text style={styles.title}>Where meditation meets{'\n'}science & technology</Text>
            <Text style={styles.lead}>
              Founded in Geneva, All Here is inspiring the world to meditate through immersive,
              quantifiable services.
            </Text>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>Decades</Text>
                <Text style={styles.statLabel}>of advanced meditation practice</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>3 years</Text>
                <Text style={styles.statLabel}>of neuroscience research</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>+300</Text>
                <Text style={styles.statLabel}>expert meditators analyzed</Text>
              </View>
            </View>

            {pillars.map(p => (
              <View key={p.title} style={styles.pillar}>
                <Image source={p.icon} style={styles.pillarIcon} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pillarTitle}>{p.title}</Text>
                  <Text style={styles.pillarBody}>{p.body}</Text>
                </View>
              </View>
            ))}

            <Text style={styles.outro}>
              By combining ancient traditions with neuroscience and technology we advance
              appreciation of meditation and reveal pathways to heightened consciousness.
            </Text>

            <Pressable
              onPress={() => openExternal('https://allhere.org')}
              hitSlop={8}
              style={({ pressed }) => [styles.siteLink, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.siteLinkLabel}>LEARN MORE AT</Text>
              <Text style={styles.siteLinkUrl}>allhere.org →</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  hero: { width: '100%', height: 200 },
  body: { padding: spacing.lg },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text, fontSize: 26, marginBottom: spacing.md },
  lead: { ...type.body, color: colors.text, fontSize: 16, lineHeight: 24, marginBottom: spacing.xl },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  stat: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  statValue: { ...type.h2, color: colors.accent, marginBottom: 4, fontSize: 15, letterSpacing: 0 },
  statLabel: { ...type.caption, color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  pillar: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pillarIcon: { width: 48, height: 48 },
  pillarTitle: { ...type.h2, color: colors.text, marginBottom: spacing.xs, fontSize: 18 },
  pillarBody: { ...type.body, color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  outro: {
    ...type.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  siteLink: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderColor: colors.accent,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  siteLinkLabel: { ...type.overline, color: colors.accent, fontSize: 10 },
  siteLinkUrl: { ...type.h2, color: colors.text, fontSize: 16 },
});
