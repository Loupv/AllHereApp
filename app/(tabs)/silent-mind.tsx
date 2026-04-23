import { Text, View, Image, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { VoletCard } from '../../src/components/VoletCard';
import { AboutFooter } from '../../src/components/AboutFooter';
import { silentMindVolets, silentMindProgram } from '../../src/content/catalog';
import { colors, spacing, type } from '../../src/theme';

export default function SilentMindScreen() {
  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="silent-mind">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={silentMindProgram.banner} style={styles.banner} resizeMode="cover" />
          <View style={styles.bannerOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>{silentMindProgram.eyebrow}</Text>
            <Text style={styles.title}>{silentMindProgram.title}</Text>
          </View>
        </View>

        <Text style={styles.intro}>{silentMindProgram.intro}</Text>

        {silentMindVolets
          // The Intro volet now lives on the Start tab; hide it here to
          // avoid duplicating it in two places.
          .filter(v => v.id !== 'intro')
          .map((v) => (
            <VoletCard
              key={v.id}
              volet={v}
              basePath="/silent-mind"
              accent={colors.accent}
              accentRgb="158,54,148"
            />
          ))}
        <AboutFooter />
      </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  // Generous bottom padding so the AboutFooter ('WHERE MEDITATION MEETS
  // SCIENCE & TECHNOLOGY' block) clears the 80 px tab bar when the
  // user scrolls to the very end.
  content: { paddingBottom: 120 },
  hero: { height: 150, justifyContent: 'flex-end', overflow: 'hidden' },
  banner: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.55)' },
  heroText: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.xs, textAlign: 'center', fontSize: 10 },
  title: { ...type.display, color: colors.text, fontSize: 24, textAlign: 'center', lineHeight: 30 },
  intro: {
    ...type.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
});
