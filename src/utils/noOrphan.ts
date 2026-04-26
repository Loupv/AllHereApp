/**
 * Prevent widowed / orphaned words at the end of wrapping text.
 *
 * Replaces the final space in a string with a non-breaking space (U+00A0)
 * so the last two words wrap together. Works for any multi-line text —
 * titles, hero intros, descriptions, hints, paragraphs — as long as the
 * renderer respects \u00A0 (all of React Native's <Text> does).
 *
 * Handles:
 *   - multi-line strings (preserves hard '\n' breaks, glues each segment's
 *     last two words)
 *   - trailing punctuation / arrows (the glue still lands before the last
 *     word token, not after a bare symbol)
 *   - single-word strings (returned as-is)
 *   - `null` / `undefined` (returned as-is) so it's safe to splat on
 *     optional props.
 *
 * Usage:
 *   <Text>{noOrphan(track.description)}</Text>
 *   <Text>{noOrphan('Your journey to the Silent Mind')}</Text>
 *   → renders "Your journey to the Silent\u00A0Mind" so "Mind" never
 *     lands alone on its own line.
 */
export function noOrphan<T extends string | null | undefined>(s: T): T {
  if (s == null) return s;
  // Glue the last two tokens of every hard-broken segment independently,
  // so '\n'-separated lines each get orphan protection.
  return (s as string).split('\n').map(glueLastSpace).join('\n') as T;
}

/** Replace the last ASCII/regular space in `line` with U+00A0. */
function glueLastSpace(line: string): string {
  const idx = line.lastIndexOf(' ');
  if (idx < 0) return line;
  return line.slice(0, idx) + '\u00A0' + line.slice(idx + 1);
}
