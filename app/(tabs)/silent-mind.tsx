import { ScrollView, Text, View, Image, StyleSheet } from 'react-native';
import { Background } from '../../src/components/Background';
import { VoletAccordion } from '../../src/components/VoletAccordion';
import { AboutFooter } from '../../src/components/AboutFooter';
import { silentMindVolets, silentMindProgram } from '../../src/content/catalog';
import { colors, spacing, type } from '../../src/theme';

export default function SilentMindScreen() {
  return (
    <Background>
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

        {silentMindVolets.map((v) => (
          <VoletAccordion key={v.id} volet={v} defaultOpen={false} secondary={v.id === 'intro'} />
        ))}
        <AboutFooter />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  hero: { height: 220, justifyContent: 'flex-end', overflow: 'hidden' },
  banner: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.55)' },
  heroText: { padding: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm, textAlign: 'center' },
  title: { ...type.display, color: colors.text, fontSize: 30, textAlign: 'center', lineHeight: 36 },
  intro: {
    ...type.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    textAlign: 'center',
  },
});
