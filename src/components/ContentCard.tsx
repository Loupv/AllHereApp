import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress: () => void;
  accent?: string;
};

export function ContentCard({ title, subtitle, meta, onPress, accent = colors.accent }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm + 4,
    gap: spacing.md,
  },
  pressed: { opacity: 0.7, backgroundColor: colors.surfaceElevated },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  body: { flex: 1 },
  title: { ...type.h3, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  meta: { ...type.caption, color: colors.textDim },
});
