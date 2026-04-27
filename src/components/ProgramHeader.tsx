import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, type } from '../theme';
import { noOrphan } from '../utils/noOrphan';

type Props = {
  /** Uppercase identity string shown inside the banner (e.g. "Silent
   *  Mind Program · Part 1"). The banner is the only place where the
   *  program accent colour appears in the header — keeps the brand
   *  cue and never leaks into the body type. */
  eyebrow: string;
  /** Page title — the only large-display string. Same size on every
   *  screen so SM tab / QM tab / detail pages / About all share the
   *  same hierarchy. */
  title: string;
  /** Optional running paragraph below the title. Multi-line strings
   *  are preserved (each `\n` becomes a paragraph break). */
  description?: string;
  /** Brand tint for the banner (magenta for SM, teal for QM, etc.). */
  accent: string;
};

/**
 * Shared header for the SM / QM / About tabs and their detail pages.
 *
 * Visual structure:
 *
 *   ─────  EYEBROW  ─────       (thin accent rules + uppercase label)
 *           Title                (display, fontSize 22)
 *           Description          (body, muted)
 *
 * The banner unifies the "you are in this program" cue across every
 * screen so the tab + its detail pages feel like one continuous
 * surface rather than three independent pages with slightly
 * different typographic stacks.
 */
export function ProgramHeader({ eyebrow, title, description, accent }: Props) {
  return (
    <View style={styles.root}>
      {/* Eyebrow text only — the flanking accent hairlines were
          removed: the uppercased + spaced + tinted text is enough of
          a "you are in this program" cue without the heavier ruled
          line on either side. */}
      <Text style={[styles.bannerText, { color: accent }]} numberOfLines={2}>
        {eyebrow}
      </Text>

      <Text style={styles.title}>{noOrphan(title)}</Text>

      {description ? (
        <Text style={styles.description}>{noOrphan(description)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  bannerText: {
    ...type.overline,
    fontSize: 10,
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  title: {
    ...type.display,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  description: {
    ...type.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
