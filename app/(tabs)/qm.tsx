import { View, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { VoletCard } from '../../src/components/VoletCard';
import { AboutFooter } from '../../src/components/AboutFooter';
import { ProgramHeader } from '../../src/components/ProgramHeader';
import { qmVolets, qmProgram } from '../../src/content/catalog';
import { useTabBarPadding } from '../../src/hooks/useTabBarPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing } from '../../src/theme';

export default function QMScreen() {
  const tabPad = useTabBarPadding();
  const { columnMax } = useLayout();
  return (
    <Background color={colors.bgTabAlt}>
      <SwipeTabs current="qm">
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabPad }]}>
        <View style={[styles.column, { maxWidth: columnMax }]}>
        <ProgramHeader
          eyebrow={qmProgram.eyebrow}
          title={qmProgram.title}
          description={qmProgram.intro}
          accent={colors.accentAlt}
        />

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
