import { useState, useMemo } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { Collapse } from '../../src/components/Collapse';
import { startJourneySteps } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useProgress } from '../../src/player/progressStore';
import { colors, radius, spacing, type } from '../../src/theme';

export default function StartScreen() {
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const listened = useProgress(s => s.listened);
  const [manualIdx, setManualIdx] = useState<number | null>(null);

  const activeIdx = useMemo(() => {
    for (let i = 0; i < startJourneySteps.length; i++) {
      const s = startJourneySteps[i];
      if (!s.track) return i;
      if (!listened[s.track.id]) return i;
    }
    return startJourneySteps.length - 1;
  }, [listened]);

  const openIdx = manualIdx ?? activeIdx;

  const toggle = (i: number) => {
    setManualIdx(prev => {
      const current = prev ?? activeIdx;
      return current === i ? -1 : i;
    });
  };

  return (
    <Background>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={require('../../assets/images/hero/home.jpg')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroInner}>
            <Text style={styles.eyebrow}>START YOUR JOURNEY</Text>
            <Text style={styles.heroTitle}>To the{'\n'}Silent Mind</Text>
            <Text style={styles.heroSub}>Guided by science, enhanced by technology.</Text>
          </View>
        </View>

        <View style={styles.steps}>
          {startJourneySteps.map((step, i) => {
            const isOpen = i === openIdx;
            const isDone = !!(step.track && listened[step.track.id]);
            const isFirst = i === 0;
            const isActive = i === activeIdx && !isDone;
            const isHighlighted = isActive;
            return (
              <Pressable
                key={step.id}
                onPress={() => toggle(i)}
                style={({ pressed }) => [
                  styles.step,
                  isHighlighted && styles.stepFirst,
                  isDone && styles.stepDone,
                  pressed && styles.stepPressed,
                ]}
              >
                <View style={styles.stepHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.stepNumber}>{String(i + 1).padStart(2, '0')}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stepLabel}>
                          {isFirst && isHighlighted ? 'Begin your practice' : step.label}
                        </Text>
                        {!isOpen ? (
                          <Text style={styles.stepHeaderDesc} numberOfLines={1}>
                            {isFirst && isHighlighted ? '60 seconds is all it takes.' : step.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  {isDone
                    ? <Text style={styles.doneBadge}>✓</Text>
                    : <Text style={styles.chevron}>{isOpen ? '−' : '›'}</Text>}
                </View>

                <Collapse open={isOpen}>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepDesc}>
                      {isFirst && isHighlighted ? 'One breath to arrive. One minute to settle.' : step.description}
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.cta,
                        pressed && styles.ctaPressed,
                      ]}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        if (step.track) {
                          const pl = startJourneySteps.map(s => s.track).filter(Boolean) as any;
                          openPlayer(step.track, pl);
                        }
                      }}
                    >
                      <Text style={styles.ctaText}>
                        {isDone ? 'Listen again' : 'Begin'}
                      </Text>
                    </Pressable>
                  </View>
                </Collapse>
              </Pressable>
            );
          })}
        </View>

        {startJourneySteps.every(s => s.track && listened[s.track.id]) ? (
          <Pressable
            onPress={() => router.push('/silent-mind')}
            style={({ pressed }) => [styles.exploreCta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.exploreEyebrow}>READY FOR MORE ?</Text>
            <Text style={styles.exploreTitle}>Explore the Silent Mind Program</Text>
            <Text style={styles.exploreHint}>A three-part journey, guided audio by audio, from noise to silent mind.</Text>
          </Pressable>
        ) : null}

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

  steps: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm + 2 },
  step: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  stepFirst: {
    paddingVertical: spacing.md + 2,
    borderColor: colors.accent,
    backgroundColor: 'rgba(158,54,148,0.08)',
  },
  stepPressed: { opacity: 0.92 },
  stepDone: { opacity: 0.6 },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: { ...type.overline, color: colors.accent, fontSize: 12 },
  stepLabel: { ...type.h2, color: colors.text, fontSize: 17 },
  stepHeaderDesc: { ...type.caption, color: colors.textMuted, fontSize: 12, marginTop: 2 },
  doneBadge: { ...type.h2, color: colors.accent, fontSize: 18 },
  chevron: { ...type.h2, color: colors.accent, fontSize: 22, fontWeight: '300' as const, opacity: 0.7 },

  stepBody: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xs, gap: spacing.md },
  stepDesc: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 300, fontSize: 14 },
  cta: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  ctaPressed: { opacity: 0.8 },
  ctaText: { ...type.button, color: colors.text, fontSize: 12 },
  exploreCta: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderColor: colors.accent,
    borderWidth: 1,
    backgroundColor: 'rgba(158,54,148,0.10)',
    alignItems: 'center',
    gap: 4,
  },
  exploreEyebrow: { ...type.overline, color: colors.accent, fontSize: 10 },
  exploreTitle: { ...type.h2, color: colors.text, fontSize: 16, textAlign: 'center' },
  exploreHint: { ...type.caption, color: colors.textMuted, textAlign: 'center', fontSize: 12 },
});
