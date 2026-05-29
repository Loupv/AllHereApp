/**
 * Journey → theme mapping. `ShaderTheme` is the set of atmosphere
 * variants; the live GL renderer (`AtmosphereBackground`) resolves the
 * actual fragment shader from `glsl.ts`. The functions below pick the
 * theme from the user's SM-journey position.
 */
import { silentMindVolets } from '../content/catalog';

export type ShaderTheme = 'default' | 'earth' | 'grass' | 'sky' | 'space' | 'lake';

/**
 * Derive the theme from the next-up track id. Used by the home page
 * to pick the atmosphere that matches the user's current part of the
 * SM journey:
 *   - intro-* / quick-meditation / no nextId  → earth (default)
 *   - p1-* / qm1-*                            → earth
 *   - p2-* / qm2-*                            → sky
 *   - p3-* / qm3-*                            → space
 *
 * The `default` theme exists for completeness but is no longer
 * surfaced through auto-selection — fresh users land on EARTH
 * (the lake) since that's the start of the journey arc.
 */
export function themeForNextTrack(trackId: string | undefined): ShaderTheme {
  if (!trackId) return 'space'; // user has finished — reward with the cosmos
  if (trackId.startsWith('intro-')) return 'lake'; // first connection
  if (trackId.startsWith('p2-') || trackId.startsWith('qm2-')) return 'sky';
  if (trackId.startsWith('p3-') || trackId.startsWith('qm3-')) return 'space';
  return 'earth'; // p1 / qm1 / home
}

/**
 * Per-part accent colours — kept here next to the theme picker so
 * the shader theme + UI accent stay in lockstep. Mirrors the
 * `partColor` switch used by the SM tree.
 */
export const JOURNEY_ACCENTS = {
  intro: '#C9A66B', // warm dawn gold — first connection
  part1: '#3D8E5E', // vivid forest green — Earth
  part2: '#3D6BBA', // dark blue — Sky
  part3: '#9B6FDD', // purple — Space
} as const;

/**
 * Theme picked from the user's CURRENT SM JOURNEY POSITION rather
 * than from whatever the global `nextTrackId()` happens to point at.
 *
 * Why two functions: `nextTrackId()` includes QMs in its walk, so a
 * user who has finished every SM up through Part 2 but skipped
 * `qm1-2` will get `nextTrackId = 'qm1-2'` → `themeForNextTrack`
 * returns 'earth' even though they've conceptually unlocked Space.
 * The shader behind the SM tab then stays on the forest video,
 * which contradicts the journey state the user perceives.
 *
 * This helper walks SM tracks only (skipping QMs), finds the next
 * SM after the last-listened SM, and routes through the same
 * theme-mapping logic. The result reads as "where the user is
 * heading in the SM arc" — independent of QM completion side trips.
 */
export function themeForJourneyPosition(
  listened: Record<string, true>,
): ShaderTheme {
  const smOrder: string[] = [];
  for (const v of silentMindVolets) {
    for (const t of v.tracks) {
      if (t.comingSoon) continue;
      smOrder.push(t.id);
    }
  }
  let lastListenedIdx = -1;
  for (let i = 0; i < smOrder.length; i++) {
    if (listened[smOrder[i]]) lastListenedIdx = i;
  }
  const nextSm = smOrder[lastListenedIdx + 1];
  return themeForNextTrack(nextSm);
}
