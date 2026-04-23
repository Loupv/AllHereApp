import { ReactNode, useRef } from 'react';
import { View, PanResponder, PanResponderGestureState } from 'react-native';
import { useRouter } from 'expo-router';

type TabName = 'index' | 'silent-mind' | 'qm' | 'video' | 'about';

// Order mirrors the bottom tab bar (see app/(tabs)/_layout.tsx)
const TABS: TabName[] = ['index', 'silent-mind', 'qm', 'video', 'about'];

const HREF: Record<TabName, string> = {
  index: '/',
  'silent-mind': '/silent-mind',
  qm: '/qm',
  video: '/video',
  about: '/about',
};

type Props = {
  /** Name of the current tab, for neighbour lookup */
  current: TabName;
  children: ReactNode;
};

/**
 * Lightweight horizontal-swipe wrapper. Detects a horizontal drag on the
 * tab content and navigates to the previous / next tab when the gesture
 * crosses a threshold. Vertical drags pass through untouched so the inner
 * ScrollView keeps working.
 *
 * Nothing is rendered in the transition — the navigation itself handles
 * the screen swap. Keeps the implementation tiny and free of extra deps.
 */
export function SwipeTabs({ current, children }: Props) {
  const router = useRouter();
  const idx = TABS.indexOf(current);

  const THRESHOLD = 70;    // min horizontal pixels to qualify as a swipe
  const AXIS_RATIO = 1.4;  // |dx| must dominate |dy| by this much

  const go = (dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= TABS.length) return;
    router.replace(HREF[TABS[next]] as any);
  };

  const pan = useRef(
    PanResponder.create({
      // Don't hijack tap / vertical scroll starts
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g: PanResponderGestureState) => {
        return Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * AXIS_RATIO;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > THRESHOLD) go(-1);       // swipe right → previous tab
        else if (g.dx < -THRESHOLD) go(1);  // swipe left → next tab
      },
      onPanResponderTerminate: () => { /* no-op */ },
    }),
  ).current;

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      {children}
    </View>
  );
}
