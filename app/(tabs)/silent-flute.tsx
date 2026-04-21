import { View, Text, Image, StyleSheet } from 'react-native';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { Background } from '../../src/components/Background';
import { AboutFooter } from '../../src/components/AboutFooter';
import { ContentCard } from '../../src/components/ContentCard';
import { fluteItems } from '../../src/content/catalog';
import { colors, spacing, type } from '../../src/theme';

export default function SilentFluteScreen() {
  return (
    <Background color={colors.bgTab}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={require('../../assets/images/lounge-2.jpg')} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>SILENT FLUTE</Text>
            <Text style={styles.title}>Music for presence</Text>
          </View>
        </View>
        <View style={styles.body}>
          {fluteItems.map(f => (
            <ContentCard key={f.id} title={f.title} meta={f.duration} onPress={() => {}} accent={colors.success} />
          ))}
        </View>
        <AboutFooter />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.md },
  hero: { height: 180, justifyContent: 'flex-end', overflow: 'hidden', marginBottom: spacing.md },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.55)' },
  heroText: { padding: spacing.lg, alignItems: 'center' },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text, fontSize: 32, textAlign: 'center' },
  body: { paddingHorizontal: spacing.lg },
});
