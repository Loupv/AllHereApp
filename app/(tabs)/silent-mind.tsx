import { Text, View, Image, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { VoletCard } from '../../src/components/VoletCard';
import { AboutFooter } from '../../src/components/AboutFooter';
import { silentMindVolets, silentMindProgram } from '../../src/content/catalog';
import { useTabBarPadding } from '../../src/hooks/useTabBarPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing, type } from '../../src/theme';

export default function SilentMindScreen() {
  const tabPad = useTabBarPadding();
  const { columnMax } = useLayout();
  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="silent-mind">
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabPad }]}>
        <View style={[styles.column, { maxWidth: columnMax }]}>
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
        </View>
      </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  // Default bottom padding comes from useTabBarPadding(); the inline
  // override on the ScrollView overrides this at runtime with the
  // safe-area-aware value.
  // Scroll container centres the capped 'column' block so on tablet /
  // wider web previews the content stays at a readable width instead
  // of stretching edge-to-edge.
  content: { alignItems: 'center' },
  column: { width: '100%', alignSelf: 'center' },
  hero: { height: 130, justifyContent: 'flex-end', overflow: 'hidden' },
  banner: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.55)' },
  heroText: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
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
