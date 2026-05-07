import { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';

type TabName = 'index' | 'silent-mind' | 'qm' | 'video' | 'about';

// Order mirrors the bottom tab bar (see app/(tabs)/_layout.tsx)
const TABS: TabName[] = ['index', 'qm', 'silent-mind', 'video', 'about'];

const HREF: Record<TabName, string> = {
  index: '/',
  'silent-mind': '/silent-mind',
  qm: '/qm',
  video: '/video',
  about: '/about',
};

// Map a pathname back to the tab that owns it so we can lift the swipe
// handler above the individual tab screens (see SwipeTabsHost below).
function tabFromPath(p: string | null): TabName | null {
  if (!p || p === '/') return 'index';
  for (const t of TABS) {
    if (t === 'index') continue;
    const href = HREF[t];
    if (p === href || p.startsWith(`${href}/`)) return t;
  }
  return null;
}

type Props = {
  /** Name of the current tab, for neighbour lookup */
  current: TabName;
  children: ReactNode;
};

/**
 * Horizontal-swipe wrapper for tab navigation. Uses
 * react-native-gesture-handler's `Pan` gesture (not the legacy
 * PanResponder), which gives us two crucial knobs:
 *
 *  - `activeOffsetX([-12, 12])` — declares the gesture inactive until
 *    the finger has moved ≥ 12 px horizontally. The gesture-handler
 *    runtime then claims responder ownership AT THAT MOMENT, before
 *    any nested ScrollView has a chance to start vertical-scrolling.
 *  - `failOffsetY([-15, 15])` — auto-fails the gesture if vertical
 *    travel reaches 15 px first. Honest vertical scrolls win cleanly,
 *    no jitter. Honest horizontal swipes win cleanly, no "did it
 *    register?" doubt.
 *
 * Together this fixes both the "small vertical scroll triggered when I
 * meant to swipe" and the "I had to try the swipe twice to make it
 * register" symptoms the legacy PanResponder version had.
 */
/**
 * Per-tab wrapper kept for backwards-compat — every tab screen still
 * imports `<SwipeTabs current="…">` and renders its content inside it.
 * The actual gesture handler now lives one level up in
 * `<SwipeTabsHost>` (mounted by `app/(tabs)/_layout.tsx`) so the
 * gesture-handler View doesn't get torn down + rebuilt on every tab
 * switch — that mount/unmount race was leaving newly-mounted tabs
 * blank until a second navigation kicked them into life.
 */
export function SwipeTabs({ children }: Props) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

/**
 * Mounted ONCE at the (tabs) layout. Reads the current pathname every
 * render so left/right swipes resolve against the live tab order
 * without needing each tab screen to pass its name down.
 */
export function SwipeTabsHost({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const THRESHOLD = 60; // min horizontal travel at release to commit a swipe

  const go = (dir: -1 | 1) => {
    const current = tabFromPath(pathname);
    if (!current) return;
    const idx = TABS.indexOf(current);
    const next = idx + dir;
    if (next < 0 || next >= TABS.length) return;
    router.replace(HREF[TABS[next]] as any);
  };

  // Native: temporarily disabled. RN's `Pressable` doesn't reliably
  // honour the touch-cancel signal that react-native-gesture-handler
  // sends when our Pan activates — taps on buttons would race with the
  // swipe and either fire the press or eat the gesture. Until we either
  // (a) wrap every in-tab Pressable with gesture-handler's own Pressable
  // or (b) move to react-native-pager-view (proper native paging where
  // the gesture vs touch arbitration lives in the OS), the bottom tab
  // bar is the canonical way to navigate on phone — there's no swipe
  // gesture to fight with. Web keeps the swipe handler because the
  // browser pointer-event model handles cancellation cleanly.
  if (Platform.OS !== 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      'worklet';
      if (e.translationX > THRESHOLD) runOnJS(go)(-1);
      else if (e.translationX < -THRESHOLD) runOnJS(go)(1);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
