import { Pressable, Text, View, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { colors, radius, spacing, type } from '../theme';
import { KindIcon, type MediaKind } from './KindIcon';
import { noOrphan } from '../utils/noOrphan';

// Enable LayoutAnimation on Android so the accordion expand/collapse is
// animated there too. iOS / web get it for free.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  /**
   * Track description shown when the card is expanded (accordion mode).
   * If absent, the card stays a plain row that calls `onPress` directly.
   */
  description?: string | { text: string; style?: 'bold' | 'italic' }[];
  /**
   * Tap on the row body — expands the accordion if `description` +
   * `onPlay` are provided (controlled mode via `expanded` /
   * `onToggle`), otherwise behaves like a plain CTA via `onPress`.
   */
  onPress?: () => void;
  /**
   * Tap on the play button revealed when the accordion is expanded.
   * If omitted, the play button isn't rendered.
   */
  onPlay?: () => void;
  /**
   * Controlled accordion state — the parent owns which card is open
   * so opening one auto-closes the others. When `onToggle` is
   * provided, the card delegates expansion to the parent.
   */
  expanded?: boolean;
  onToggle?: () => void;
  accent?: string;
};

export function ContentCard({
  title, subtitle, meta,
  duration, kind = 'audio', disabled,
  description, onPress, onPlay, expanded = false, onToggle,
  accent = colors.accent,
}: Props) {
  const tint = disabled ? colors.textDim : accent;
  const expandable = !!description && !!onPlay && !!onToggle && !disabled;

  const handleRowPress = () => {
    if (disabled) return;
    if (expandable) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onToggle!();
    } else {
      onPress?.();
    }
  };

  // Description can be a single string or a structured list of lines (for
  // pre-formatted tracks like the QM intro). Normalise to a flat array.
  const descLines: { text: string; style?: 'bold' | 'italic' }[] | null =
    typeof description === 'string'
      ? [{ text: description }]
      : Array.isArray(description) ? description : null;

  return (
    <View style={[styles.card, disabled && styles.cardDisabled]}>
      <Pressable
        onPress={handleRowPress}
        disabled={disabled || (!onPress && !expandable)}
        style={({ pressed }) => [
          styles.row,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <View style={[styles.accent, { backgroundColor: tint }]} />
        <View style={styles.body}>
          <Text style={[styles.title, disabled && styles.textDisabled]}>{noOrphan(title)}</Text>
          {subtitle ? <Text style={styles.subtitle}>{noOrphan(subtitle)}</Text> : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        <View style={styles.trailing}>
          {duration ? <Text style={[styles.duration, { color: tint }]}>{duration}</Text> : null}
          {expandable ? (
            <Text style={[styles.chevron, { color: tint, transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>
              ⌄
            </Text>
          ) : (
            <KindIcon kind={kind} color={tint} size={22} />
          )}
        </View>
      </Pressable>

      {expandable && expanded && descLines ? (
        <View style={styles.expanded}>
          <View style={styles.descBlock}>
            {descLines.map((l, i) => (
              <Text
                key={i}
                style={[
                  styles.desc,
                  l.style === 'bold' && styles.descBold,
                  l.style === 'italic' && styles.descItalic,
                ]}
              >
                {l.text}
              </Text>
            ))}
          </View>
          <Pressable
            onPress={onPlay}
            style={({ pressed }) => [
              styles.playBtn,
              { borderColor: tint },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={[styles.playGlyph, { color: tint }]}>▶</Text>
            <Text style={[styles.playLabel, { color: tint }]}>Play</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer card holds the row + the optional expanded panel together so
  // they share the hairline divider underneath.
  card: {
    backgroundColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.09)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardDisabled: { opacity: 0.5 },
  // Borderless + background-less row matching the Start intro list and
  // the VoletCard: a hairline between rows gives structure without the
  // weight of stacked filled cards. The 4px coloured accent rail on the
  // left keeps per-row identity.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    gap: spacing.md,
  },
  pressed: { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.04)' },
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
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  duration: { ...type.overline, fontSize: 10 },
  chevron: { fontSize: 22, lineHeight: 22, marginLeft: 2 },
  // Expanded panel — sits below the row, indented past the accent rail
  // so it visually belongs to the same item.
  expanded: {
    paddingLeft: spacing.sm + 4 + spacing.md, // accent (4) + row paddingLeft + row gap
    paddingRight: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  descBlock: { gap: 6 },
  desc: { ...type.body, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  descBold: { ...type.body, color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 14, lineHeight: 20 },
  descItalic: { ...type.body, color: colors.textMuted, fontStyle: 'italic' },
  playBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  playGlyph: { fontSize: 12 },
  playLabel: { ...type.overline, fontSize: 11, letterSpacing: 1.4 },
});
