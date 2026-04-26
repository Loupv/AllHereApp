import { View, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { VoletCard } from '../../src/components/VoletCard';
import { AboutFooter } from '../../src/components/AboutFooter';
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
            prologue to Part 1. Previously surfaced on the Start page,
            now discoverable here where new users land after tapping
            "New here? Start with the intro →". */}
        {silentMindVolets.map((v) => (
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
  content: { alignItems: 'center' },
  column: { width: '100%', alignSelf: 'center' },
});
