import { ScrollView, Text, StyleSheet } from 'react-native';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { ContentCard } from '../../src/components/ContentCard';
import { fluteItems } from '../../src/content/catalog';
import { colors, spacing, type } from '../../src/theme';

export default function SilentFluteScreen() {
  return (
    <Background>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Silent Flute</Text>
        <Text style={styles.title}>Music for presence</Text>
        {fluteItems.map(f => (
          <ContentCard key={f.id} title={f.title} meta={f.duration} onPress={() => {}} accent={colors.success} />
        ))}
        <AboutFooter />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.md },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm, textAlign: 'center' },
  title: { ...type.display, color: colors.text, fontSize: 32, marginBottom: spacing.lg, textAlign: 'center' },
});
