/**
 * Theme registry — maps the four "where am I in the journey" buckets
 * to their SkSL source. Adding a new variant means importing it
 * here and pointing the matching theme at it; nothing in
 * `ShaderBackground` needs to change.
 */
import { SHADER_DEFAULT, SHADER_EARTH, SHADER_SKY, SHADER_SPACE } from './sources';

export type ShaderTheme = 'default' | 'earth' | 'grass' | 'sky' | 'space' | 'lake';

export const SHADER_FOR_THEME: Record<ShaderTheme, string> = {
  default: SHADER_DEFAULT,
  // `earth` is rendered as a looping video at the layout level, not
  // as a shader. Map it here for completeness so any code that
  // resolves a SkSL source for an arbitrary theme still has a
  // sensible fallback (the original grass shader).
  earth: SHADER_EARTH,
  grass: SHADER_EARTH,
  sky: SHADER_SKY,
  space: SHADER_SPACE,
  lake: SHADER_EARTH, // placeholder until glsl exports change below
};

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
