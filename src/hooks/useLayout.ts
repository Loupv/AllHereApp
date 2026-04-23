import { useWindowDimensions } from 'react-native';

/**
 * Shared layout breakpoints and derived caps so every tab reads the
 * window in the same way. Keeps the mobile-first column width intact
 * on tablets / desktop web previews (content doesn't stretch beyond
 * a comfortable reading width), and exposes `isTablet` so specific
 * screens (Start, Media grid) can bump sizes / switch to multi-column
 * when there's room.
 */
const TABLET_MIN_WIDTH = 640;
const COLUMN_CAP = 560;

export type LayoutInfo = {
  width: number;
  height: number;
  isTablet: boolean;
  /** Max width for a single 'reading' column. Always ≤ window width. */
  columnMax: number;
  /** How many columns a grid should use at this width. */
  gridColumns: 1 | 2;
};

export function useLayout(): LayoutInfo {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  return {
    width,
    height,
    isTablet,
    columnMax: Math.min(width, COLUMN_CAP),
    gridColumns: isTablet ? 2 : 1,
  };
}
