import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing, type } from '../theme';
import { KindIcon, type MediaKind } from './KindIcon';

type Props = {
  title: string;
  subtitle?: string;
  meta?: string;
  /** Total duration / run time, shown next to the kind icon */
  duration?: string;
  /** Media kind — picks the icon on the right. Defaults to audio. */
  kind?: MediaKind;
  /** When true the card renders greyed-out and is not pressable. Used for
   *  coming-soon tracks so they keep the exact same list layout. */
  disabled?: boolean;
  onPress?: () => void;
  accent?: string;
};

export function ContentCard({
  title, subtitle, meta,
  duration, kind = 'audio', disabled,
  onPress, accent = colors.accent,
}: Props) {
  const tint = disabled ? colors.textDim : accent;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: tint }]} />
      <View style={styles.body}>
        <Text style={[styles.title, disabled && styles.textDisabled]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <View style={styles.trailing}>
        {duration ? <Text style={[styles.duration, { color: tint }]}>{duration}</Text> : null}
        <KindIcon kind={kind} color={tint} size={22} />
      </View>
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
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    marginBottom: spacing.sm + 4,
    gap: spacing.md,
  },
  pressed: { opacity: 0.7, backgroundColor: colors.surfaceElevated },
  cardDisabled: { opacity: 0.5 },
  textDisabled: { color: colors.textDim },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  body: { flex: 1 },
  title: { ...type.h3, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  meta: { ...type.caption, color: colors.textDim, marginTop: 2 },
  trailing: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  duration: { ...type.overline, fontSize: 10 },
});
