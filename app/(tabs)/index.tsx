import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { startJourneySteps } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { colors, radius, spacing, type } from '../../src/theme';

export default function StartScreen() {
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);

  return (
    <Background>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={require('../../assets/images/lounge-1.jpg')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroInner}>
            <Text style={styles.eyebrow}>START YOUR JOURNEY</Text>
            <Text style={styles.heroTitle}>To the{'\n'}Silent Mind</Text>
            <Text style={styles.heroSub}>Guided by science, enhanced by technology.</Text>
          </View>
        </View>

        <View style={styles.steps}>
          {startJourneySteps.map((step, i) => {
            const isFirst = i === 0;
            return (
              <View key={step.id} style={[styles.step, isFirst && styles.stepFirst]}>
                {isFirst ? (
                  <>
                    <Text style={styles.firstEyebrow}>BEGIN YOUR PRACTICE</Text>
                    <Text style={styles.firstTitle}>60 seconds is{'\n'}all it takes.</Text>
                    <Text style={styles.firstDesc}>
                      One breath to arrive. One minute to settle.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.stepNumber}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={styles.stepLabel}>{step.label}</Text>
                    <Text style={styles.stepDesc}>{step.description}</Text>
                  </>
                )}
                <Pressable
                  style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
                  onPress={() => {
                    if (step.track) openPlayer(step.track);
                    else if (step.ctaRoute) router.push(step.ctaRoute);
                  }}
                >
                  <Text style={styles.ctaText}>
                    {step.track ? 'Begin' : 'Explore the program'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <AboutFooter />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.md },
  hero: { height: 240, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.65)' },
  heroInner: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.text, opacity: 0.75, marginBottom: spacing.sm, fontSize: 13, letterSpacing: 2 },
  heroTitle: { ...type.display, color: colors.text, fontSize: 28, textAlign: 'center', lineHeight: 34, marginBottom: spacing.sm },
  heroSub: { ...type.body, color: colors.textMuted, fontSize: 13, textAlign: 'center' },

  intro: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.lg, alignItems: 'center' },
  introEyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm, fontSize: 11 },
  introTitle: { ...type.h1, color: colors.text, fontSize: 22, textAlign: 'center', marginBottom: spacing.md, lineHeight: 28 },
  introBody: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 360 },

  steps: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  step: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  stepFirst: {
    paddingVertical: spacing.lg,
    borderColor: colors.accent,
    backgroundColor: 'rgba(158,54,148,0.08)',
  },
  firstEyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm, fontSize: 11 },
  firstTitle: { ...type.display, color: colors.text, fontSize: 24, textAlign: 'center', lineHeight: 30, marginBottom: spacing.sm },
  firstDesc: { ...type.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md, maxWidth: 320, fontSize: 14 },
  stepNumber: { ...type.overline, color: colors.accent, marginBottom: spacing.sm },
  stepLabel: { ...type.h2, color: colors.text, fontSize: 20, textAlign: 'center', marginBottom: spacing.sm },
  stepDesc: { ...type.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md, maxWidth: 300 },
  cta: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  ctaPressed: { opacity: 0.8 },
  ctaText: { ...type.button, color: colors.text, fontSize: 12 },
});
