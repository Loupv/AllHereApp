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
};

export function useLayout(): LayoutInfo {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const playSize = isTablet
    ? Math.max(180, Math.min(240, Math.round(height / 5.0)))
    : Math.max(120, Math.min(160, Math.round(height / 5.5)));
  const usableH = Math.max(360, height - insets.top - insets.bottom);
  const playCenterY = insets.top + Math.round(usableH * 0.52);
  return {
    width,
    height,
    isTablet,
    columnMax: Math.min(width, CONTENT_MAX_WIDTH),
    gridColumns: isTablet ? 2 : 1,
    playSize,
    playCenterY,
  };
}
