import { ScrollView, Text, View, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Background } from '../../src/components/Background';
import { ContentCard } from '../../src/components/ContentCard';
import { silentMindVolets } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { colors, spacing, type } from '../../src/theme';

export default function VoletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const openPlayer = usePlayerStore(s => s.open);
  const volet = silentMindVolets.find(v => v.id === id);

  if (!volet) {
    return (
      <Background>
        <Text style={[styles.title, { padding: spacing.lg }]}>Not found</Text>
      </Background>
    );
  }

  return (
    <Background>
      <Stack.Screen options={{ title: volet.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {volet.image ? (
            <Image source={volet.image} style={styles.circle} resizeMode="cover" />
          ) : null}
          <Text style={styles.eyebrow}>{volet.title.toUpperCase()}</Text>
          <Text style={styles.title}>{volet.subtitle}</Text>
          {volet.tagline ? <Text style={styles.tagline}>{volet.tagline}</Text> : null}
          {volet.description ? <Text style={styles.description}>{volet.description}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>Practices</Text>
        {volet.tracks.map((t) => (
          <ContentCard
            key={t.id}
            title={t.title}
            meta={t.transcript ? 'Transcript' : undefined}
            onPress={() => openPlayer(t, volet.tracks)}
          />
        ))}
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.md,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  eyebrow: { ...type.overline, color: colors.accent, marginBottom: spacing.sm },
  title: { ...type.display, color: colors.text, fontSize: 26, textAlign: 'center', marginBottom: spacing.sm },
  tagline: { ...type.caption, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginBottom: spacing.md },
  description: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  sectionLabel: { ...type.overline, color: colors.textMuted, marginBottom: spacing.md },
});
