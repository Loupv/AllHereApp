import { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';

/**
 * Detail pages (silent-mind/[id], qm/[id], qm-training, news/[id],
 * video/[id]) sit in the root stack ABOVE the tab navigator, so the
 * material-top-tabs swipe is gone. This wrapper restores the spatial
 * model the user expects:
 *
 *   ← left swipe   → jump to the NEXT tab at the (tabs) level (the
 *                    tab the parent of this sub-page belongs to + 1)
 *   → right swipe  → handled by the native stack's gestureEnabled,
 *                    which pops back up one level (Part 1 → SM tab)
 *
 * Only the left swipe is custom here. activeOffsetX([12, 9999]) means
 * we ONLY activate on negative-direction-of-finger (right→left), and
 * only after 12 px of horizontal travel — vertical scrolls win
 * cleanly. failOffsetY makes any meaningful vertical scroll abort the
 * pan immediately so reading content is never compromised.
 */

const TABS = ['index', 'silent-mind', 'qm', 'video', 'about'] as const;
const HREF: Record<(typeof TABS)[number], string> = {
  index: '/',
  'silent-mind': '/silent-mind',
  qm: '/qm',
  video: '/video',
  about: '/about',
};

function parentTabIndex(pathname: string | null): number {
  if (!pathname) return -1;
  if (pathname.startsWith('/silent-mind')) return TABS.indexOf('silent-mind');
  if (pathname.startsWith('/qm')) return TABS.indexOf('qm'); // covers /qm and /qm-training
  if (pathname.startsWith('/news')) return TABS.indexOf('video');
  if (pathname.startsWith('/video')) return TABS.indexOf('video');
  return -1;
}

export function SubPageSwipeNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Web already has the swipe handler from SwipeTabsHost on tab pages
  // and standard browser back/forward elsewhere — skip there.
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  const goNextTab = () => {
    const idx = parentTabIndex(pathname);
    if (idx < 0) return;
    const next = idx + 1;
    if (next >= TABS.length) return;
    router.dismissAll();
    router.replace(HREF[TABS[next]] as any);
  };

  const pan = Gesture.Pan()
    // Only activate on a clear leftward swipe (translationX < -12).
    // Activating only on negative motion isn't enough — gesture-handler
    // would still keep the touch in 'pending' state on a rightward
    // swipe, which blocked react-native-screens' native back-gesture
    // from kicking in. Explicitly fail on any rightward motion so the
    // touch is released back to the stack and the iOS swipe-back
    // animation can run uncontested.
    .activeOffsetX([-9999, -12])
    .failOffsetX([0, 9999])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      'worklet';
      if (e.translationX < -60) runOnJS(goNextTab)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
