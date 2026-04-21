import { ScrollView, Text, View, Image, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Background } from '../src/components/Background';
import { colors, radius, spacing, type } from '../src/theme';

const pillars = [
  {
    icon: require('../assets/images/icon-science.png'),
    title: 'Science',
    body:
      'We make meditation measurable with our advanced brain tracking system, validated by fundamental research and rigorous R&D.',
  },
  {
    icon: require('../assets/images/icon-technology.png'),
    title: 'Technology',
    body:
      'We support meditation development by integrating research-grade EEG with real-time visualization and multisensory immersive technology.',
  },
  {
    icon: require('../assets/images/icon-practice.png'),
    title: 'Meditation Practice',
    body:
      'We teach methods that reduce mind-wandering and enhance focal attention in order to achieve a profound state of presence — the Silent Mind.',
  },
];

export default function AboutScreen() {
  return (
    <Background>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={require('../assets/images/lounge-1.jpg')} style={styles.hero} resizeMode="cover" />
        <View style={styles.body}>
          <Text style={styles.eyebrow}>About All Here</Text>
          <Text style={styles.title}>Where meditation meets{'\n'}science & technology</Text>
          <Text style={styles.lead}>
            Founded in Geneva, All Here is inspiring the world to meditate through immersive,
            quantifiable services.
          </Text>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>Decades</Text>
              <Text style={styles.statLabel}>of advanced meditation practice</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>3 years</Text>
              <Text style={styles.statLabel}>of neuroscience research</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>+300</Text>
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
        </View>
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  hero: { width: '100%', height: 240 },
  body: { padding: spacing.lg },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text, fontSize: 28, marginBottom: spacing.md },
  lead: { ...type.body, color: colors.text, fontSize: 17, lineHeight: 26, marginBottom: spacing.xl },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  statValue: { ...type.h2, color: colors.accent, marginBottom: 4, fontSize: 16 },
  statLabel: { ...type.caption, color: colors.textMuted, fontSize: 11 },
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
});
