import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shared layout breakpoints and derived caps so every tab reads the
 * window in the same way. Keeps the mobile-first column width intact
 * on tablets / desktop web previews (content doesn't stretch beyond
 * a comfortable reading width), and exposes `isTablet` so specific
 * screens (Start, Media grid) can bump sizes / switch to multi-column
 * when there's room.
 */
export const TABLET_MIN_WIDTH = 640;
/**
 * Single source-of-truth max width used everywhere the UI should stop
 * stretching on wider viewports: reading columns, tab bar items, the
 * Player progress bar, the Media grid. Aligned with the tab bar items
 * cap so every capped element shares the same visual rhythm.
 */
export const CONTENT_MAX_WIDTH = 900;

export type LayoutInfo = {
  width: number;
  height: number;
  isTablet: boolean;
  /** Max width for a single 'reading' column. Always ≤ window width. */
  columnMax: number;
  /** How many columns a grid should use at this width. */
  gridColumns: 1 | 2;
  /** Shared CircleButton diameter — used by Start, Player and QM
   *  Training so the round play button is the same size on every
   *  screen. Pass to <CircleButton size={playSize} />. */
  playSize: number;
  /** Absolute Y (from screen top) of the play button centre — shared
   *  across Start, QM Training and the Player so the circle lands at
   *  the same pixel on every screen. */
  playCenterY: number;
  /** Y of the play button centre AFTER the Start screen's upward nudge
   *  AND the short-screen safety clamp. Both Start and the Player pin
   *  their CircleButton to this same value, so the cross-fade morph
   *  reads as a single button across the two surfaces. On tall screens
   *  it's the original (nudged-up) Y; on short viewports it's pushed
   *  down enough to leave room for the title block above it. */
  effectivePlayCenterY: number;
};

export function useLayout(): LayoutInfo {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const playSize = isTablet
    ? Math.max(180, Math.min(240, Math.round(height / 5.0)))
    : Math.max(120, Math.min(160, Math.round(height / 5.5)));
  const usableH = Math.max(360, height - insets.top - insets.bottom);
  const playCenterY = insets.top + Math.round(usableH * 0.45);

  // Effective Y the play button should actually land at — shared by
  // Start and the Player.
  //   • Ideal: Start nudges the button 56 px UP from the shared
  //     playCenterY so the circle sits at the same Y the Player's flex
  //     layout naturally lands it. Use that as the preferred Y.
  //   • Floor: on short viewports the title + meta block above the
  //     button needs room (Start's "Your journey…" headline is up to
  //     2 lines + the audio name + duration row + spacing). Estimate
  //     the minimum top of the button so it never collides with that
  //     block. Conservative so it works without measuring per-screen
  //     header heights (which differ between Start and the Player).
  const playButtonNudgeUp = 56;
  const idealButtonTop = playCenterY - playSize / 2 - playButtonNudgeUp;
  // safe-top + Start's 2-line "Your journey to the Silent Mind" title
  // (paddingTop 56 + ~72 line-pair) + the "Welcome" name + duration
  // row that hangs above the button + small breathing gap. Tuned
  // empirically: 176 was tight enough that the "Welcome" tail
  // overlapped the title's bottom line on Firefox Android (the A53);
  // 200 gives ~10 px of clearance in the worst-case header height.
  const minButtonTop = insets.top + 200;
  const effectiveButtonTop = Math.max(idealButtonTop, minButtonTop);
  const effectivePlayCenterY = effectiveButtonTop + playSize / 2;

  return {
    width,
    height,
    isTablet,
    columnMax: Math.min(width, CONTENT_MAX_WIDTH),
    gridColumns: isTablet ? 2 : 1,
    playSize,
    playCenterY,
    effectivePlayCenterY,
  };
}
