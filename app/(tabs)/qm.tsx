import { Text, View, Image, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { VoletCard } from '../../src/components/VoletCard';
import { AboutFooter } from '../../src/components/AboutFooter';
import { qmVolets, qmProgram } from '../../src/content/catalog';
import { colors, spacing, type } from '../../src/theme';

export default function QMScreen() {
  return (
    <Background color={colors.bgTabAlt}>
      <SwipeTabs current="qm">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={qmProgram.banner} style={styles.banner} resizeMode="cover" />
          <View style={styles.bannerOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>{qmProgram.eyebrow}</Text>
            <Text style={styles.title}>{qmProgram.title}</Text>
          </View>
        </View>

        <Text style={styles.intro}>{qmProgram.intro}</Text>

        {qmVolets.map((v) => (
          <VoletCard
            key={v.id}
            volet={v}
            basePath="/qm"
            accent={colors.accentAlt}
            accentRgb="54,160,158"
          />
        ))}

        <AboutFooter />
      </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 80 },
  hero: { height: 130, justifyContent: 'flex-end', overflow: 'hidden' },
  banner: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,26,38,0.55)' },
  heroText: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accentAlt, marginBottom: spacing.xs, textAlign: 'center', fontSize: 10 },
  title: { ...type.display, color: colors.text, fontSize: 22, textAlign: 'center', lineHeight: 28 },
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
