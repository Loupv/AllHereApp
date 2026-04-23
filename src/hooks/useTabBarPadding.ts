import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_BASE } from '../../app/(tabs)/_layout';

/**
 * Returns the padding a tab screen's ScrollView should apply at the
 * bottom so its last item clears the responsive tab bar (base height +
 * OS safe-area inset) with a little air on top. Lets callers stop
 * hard-coding magic numbers like `paddingBottom: 80`.
 */
export function useTabBarPadding(extra = 16) {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE + insets.bottom + extra;
}
