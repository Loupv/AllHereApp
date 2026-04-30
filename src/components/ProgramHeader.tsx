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
  /** Optional smaller line that sits **inside the title block**, just
   *  under the main title, before any running description. Use for a
   *  brand-promise byline like "A new way to meditate" sitting under
   *  "High Intensity Training" — same typographic group, secondary
   *  weight. Renders nothing if not provided. */
  subtitle?: string;
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
export function ProgramHeader({ eyebrow, title, subtitle, description, accent }: Props) {
  return (
    <View style={styles.root}>
      {/* Eyebrow text only — the flanking accent hairlines were
          removed: the uppercased + spaced + tinted text is enough of
          a "you are in this program" cue without the heavier ruled
          line on either side. */}
      <Text style={[styles.bannerText, { color: accent }]} numberOfLines={2}>
        {eyebrow}
      </Text>

      {/* Title group: main title + (optional) byline. They live in
          the same wrapper so they read as a single typographic unit;
          the `gap` from `styles.root` doesn't apply between them
          because they're inside one View. When `subtitle` is omitted
          we still render an invisible placeholder of the same height
          so SM and QM tabs (the latter has "A new way to meditate")
          land their content at exactly the same vertical Y — keeps
          the cross-tab swipe feeling like one continuous surface. */}
      <View style={styles.titleGroup}>
        <Text style={styles.title}>{noOrphan(title)}</Text>
        <Text
          style={[styles.titleByline, !subtitle && styles.titleBylineHidden]}
          aria-hidden={!subtitle}
        >
          {subtitle ? noOrphan(subtitle) : ' '}
        </Text>
      </View>

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
    // Generous bottom padding so the section title is clearly its own
    // beat before the audio-list panel / volet cards below it.
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    // gap between eyebrow → title → description bumped (md → lg) so
    // the three lines breathe instead of stacking tight. Combined with
    // the looser bottom padding, the upper section now reads as a
    // proper header rather than a header-shaped block of text.
    gap: spacing.lg,
  },
  bannerText: {
    ...type.overline,
    fontSize: 10,
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  // Wraps the main title + the optional byline so they sit as one
  // tight group, separate from the running description below.
  titleGroup: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...type.display,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  // Secondary title line — same display family / uppercase / letter
  // spacing as the main title, just smaller. Reads as part of the
  // title group rather than a body line.
  titleByline: {
    ...type.display,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1.2,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  // Reserves the byline's vertical box without drawing anything when
  // the consumer didn't pass a subtitle — equalizes header height
  // across SM (no byline) and QM (has byline).
  titleBylineHidden: {
    opacity: 0,
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
