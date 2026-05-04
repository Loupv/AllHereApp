import { View, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { Background } from '../../src/components/Background';
import { VoletCard } from '../../src/components/VoletCard';
import { ProgramHeader } from '../../src/components/ProgramHeader';
import { qmVolets, qmProgram, type Volet } from '../../src/content/catalog';
import { useTabBarPadding } from '../../src/hooks/useTabBarPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing } from '../../src/theme';

// Synthetic Volet used to render the QM self-guided training entry
// through the same `<VoletCard>` shell as the real volets. Title empty
// + subtitle mirrors the SM intro card's grammar (subtitle-only, no
// eyebrow), and `routeOverride` on the card sends the tap to
// /qm-training instead of /qm/<id>.
const QM_TRAINING_ENTRY: Volet = {
  id: 'qm-training',
  title: '',
  subtitle: 'Self-guided training in Quantified Meditation',
  description: 'Pick a preset matching one of our QM formats, or set up your own — timed rounds with bell cues, no spoken guidance.',
  tracks: [],
};

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
          subtitle={qmProgram.byline}
          description={qmProgram.intro}
          accent={colors.accentAlt}
        />

        {/* "Free Training" entry — bell-only timer for repeating a
            practice you already know by heart. Sits at the top of the
            QM list in the same slot SM uses for the Introduction
            volet, then a hairline divider before the three numbered
            parts. Routes to `/qm-training` (its own screen) instead
            of into a `/qm/<id>` detail page, hence the routeOverride
            on the card. */}
        <VoletCard
          key="qm-training"
          volet={QM_TRAINING_ENTRY}
          basePath="/qm"
          routeOverride="/qm-training"
          accent={colors.accentAlt}
          accentRgb="54,160,158"
        />
        <View style={styles.introDivider} />

        {qmVolets.map((v) => (
          <VoletCard
            key={v.id}
            volet={v}
            basePath="/qm"
            accent={colors.accentAlt}
            accentRgb="54,160,158"
          />
        ))}

        </View>
      </ScrollView>
      </SwipeTabs>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  column: { width: '100%', alignSelf: 'center' },
  // Hairline divider between the Free Training card and the three
  // numbered parts — same look as the SM intro divider so both tabs
  // read consistently. Soft white at low opacity, generous side
  // margins so the rule doesn't reach the screen edges.
  introDivider: {
    height: 1,
    marginVertical: spacing.lg,
    marginHorizontal: spacing.lg * 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
});
