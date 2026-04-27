import { View, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { VoletCard } from '../../src/components/VoletCard';
import { ProgramHeader } from '../../src/components/ProgramHeader';
import { silentMindVolets, silentMindProgram } from '../../src/content/catalog';
import { useTabBarPadding } from '../../src/hooks/useTabBarPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing } from '../../src/theme';

export default function SilentMindScreen() {
  const tabPad = useTabBarPadding();
  const { columnMax } = useLayout();
  return (
    <Background color={colors.bgTab}>
      <SwipeTabs current="silent-mind">
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabPad }]}>
        <View style={[styles.column, { maxWidth: columnMax }]}>
        <ProgramHeader
          eyebrow={silentMindProgram.eyebrow}
          title={silentMindProgram.title}
          description={silentMindProgram.intro}
          accent={colors.accent}
        />

        {/* Intro volet is back in the program stream: it's a natural
            prologue to Part 1. We render the intro first, then a
            visible spacer + hairline divider, then the three numbered
            parts — so the prologue doesn't blur into the program proper
            and the eye registers the journey as "warm-up → three parts". */}
        {silentMindVolets.map((v, i) => {
          const isFirstPart = v.id !== 'intro' && silentMindVolets[i - 1]?.id === 'intro';
          return (
            <View key={v.id}>
              {isFirstPart ? <View style={styles.introDivider} /> : null}
              <VoletCard
                volet={v}
                basePath="/silent-mind"
                accent={colors.accent}
                accentRgb="158,54,148"
              />
            </View>
          );
        })}

        </View>
      </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  column: { width: '100%', alignSelf: 'center' },
  // Soft breathing room between the intro volet and Part 1, plus a
  // faint hairline so the prologue reads as its own beat before the
  // three-part journey starts.
  introDivider: {
    height: 1,
    marginVertical: spacing.lg,
    marginHorizontal: spacing.lg * 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
});
