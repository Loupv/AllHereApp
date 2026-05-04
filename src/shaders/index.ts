/**
 * Theme registry — maps the four "where am I in the journey" buckets
 * to their SkSL source. Adding a new variant means importing it
 * here and pointing the matching theme at it; nothing in
 * `ShaderBackground` needs to change.
 */
import { SHADER_DEFAULT, SHADER_EARTH, SHADER_SKY, SHADER_SPACE } from './sources';

export type ShaderTheme = 'default' | 'earth' | 'sky' | 'space';

export const SHADER_FOR_THEME: Record<ShaderTheme, string> = {
  default: SHADER_DEFAULT,
  earth: SHADER_EARTH,
  sky: SHADER_SKY,
  space: SHADER_SPACE,
};

/**
 * Derive the theme from the next-up track id. Used by the home page
 * to pick the atmosphere that matches the user's current part of the
 * SM journey:
 *   - intro-* / no nextId         → default (subtle pulse)
 *   - p1-* / qm1-*                → earth
 *   - p2-* / qm2-*                → sky
 *   - p3-* / qm3-*                → space
 */
export function themeForNextTrack(trackId: string | undefined): ShaderTheme {
  if (!trackId) return 'space'; // user has finished — reward with the cosmos
  if (trackId.startsWith('intro-') || trackId === 'home-1min' || trackId === 'home-3min' || trackId === 'home-qm3') {
    return 'default';
  }
  if (trackId.startsWith('p1-') || trackId.startsWith('qm1-')) return 'earth';
  if (trackId.startsWith('p2-') || trackId.startsWith('qm2-')) return 'sky';
  if (trackId.startsWith('p3-') || trackId.startsWith('qm3-')) return 'space';
  return 'default';
}
