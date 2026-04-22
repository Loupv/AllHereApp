import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

type MediaKind = 'audio' | 'video' | 'text';

// Headphones / play / read glyphs. Emojis give a soft visual signal without
// pulling in an icon font; on platforms where the emoji renders in color
// the accent border + text colour stay intact because only the glyph itself
// is tinted by the OS.
const ICON: Record<MediaKind, string> = {
  audio: '🎧',
  video: '▶',
  text: '¶',
};

type Props = {
  title: string;
  subtitle?: string;
  meta?: string;
  /** Total duration / run time, shown next to the kind icon */
  duration?: string;
  /** Media kind — picks the icon on the right. Defaults to audio. */
  kind?: MediaKind;
  onPress: () => void;
  accent?: string;
};

export function ContentCard({
  title, subtitle, meta,
  duration, kind = 'audio',
  onPress, accent = colors.accent,
}: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <View style={styles.trailing}>
        {duration ? <Text style={[styles.duration, { color: accent }]}>{duration}</Text> : null}
        <View style={[styles.kindChip, { borderColor: accent }]}>
          <Text style={[styles.kindIcon, { color: accent }]}>{ICON[kind]}</Text>
        </View>
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
    paddingRight: spacing.sm + 4,
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
  meta: { ...type.caption, color: colors.textDim, marginTop: 2 },
  trailing: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  duration: { ...type.overline, fontSize: 10 },
  kindChip: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  kindIcon: { fontSize: 16, lineHeight: 18, marginTop: -1 },
});
