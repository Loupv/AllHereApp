import { TAB_BAR_BASE } from '../../app/(tabs)/_layout';

/**
 * Returns the padding a tab screen's ScrollView should apply at the
 * bottom so its last item clears the tab bar with a little air on top.
 * The bar no longer extends into the OS safe-area (we stopped painting
 * `colors.bg` behind the Android gesture nav because it read as a blue
 * dead band), so the safe-area inset is no longer part of the sum.
 */
export function useTabBarPadding(extra = 16) {
  return TAB_BAR_BASE + extra;
}
