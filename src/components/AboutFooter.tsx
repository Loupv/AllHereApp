import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, type } from '../theme';

export function AboutFooter() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <Text style={styles.tagline}>WHERE MEDITATION MEETS{'\n'}SCIENCE & TECHNOLOGY</Text>
      <Pressable onPress={() => router.push('/about')} hitSlop={8}>
        <Text style={styles.link}>About All Here →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.xl,
  },
  tagline: { ...type.overline, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  link: { ...type.caption, color: colors.accent },
});
