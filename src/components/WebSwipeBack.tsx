import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

/**
 * Detail-page paths where a left-edge swipe should pop back to the
 * previous tab. Anything inside a `(tabs)` route never matches these
 * regex (they're rooted under `/silent-mind/`, `/qm/`, etc.).
 */
const DETAIL_PATTERNS: RegExp[] = [
  /^\/silent-mind\/[^/]+$/,
  /^\/qm\/[^/]+$/,
  /^\/news\/[^/]+$/,
  /^\/video\/[^/]+$/,
];

/** Extract { x, y } from a Pointer/Mouse/Touch event uniformly. */
function pointFromEvent(e: any): { x: number; y: number } | null {
  if (typeof e?.clientX === 'number' && typeof e?.clientY === 'number') {
    return { x: e.clientX, y: e.clientY };
  }
  const t = e?.changedTouches?.[0] ?? e?.touches?.[0];
  if (t && typeof t.clientX === 'number') return { x: t.clientX, y: t.clientY };
  return null;
}

/**
 * Web-only iOS-style "swipe from the left edge to go back" gesture.
 *
 * react-native-screens' native-stack handles this on iOS / Android via
 * `gestureEnabled`, but the web build of expo-router doesn't ship a
 * gesture layer for stack screens. This component listens at the
 * window level for a pointerdown that starts within the left
 * `EDGE_PX` strip, then a pointerup that has moved more than
 * `THRESHOLD_X` to the right with limited vertical drift — exactly
 * the heuristics react-native-screens uses natively. When matched,
 * `router.back()` returns the user to whichever tab pushed the
 * current detail page.
 *
 * No-op on native (the native stack already owns this gesture) and on
 * non-detail routes (so the gesture never accidentally backs out of a
 * tab page or modal).
 */
export function WebSwipeBack() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const isDetail = DETAIL_PATTERNS.some((p) => p.test(pathname));

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDetail) return;

    const EDGE_PX = 60;       // pointerdown must start within this many px from the left edge
    const THRESHOLD_X = 64;   // total horizontal travel needed to fire back()
    const MAX_DRIFT_Y = 80;   // ignore mostly-vertical swipes (page scrolls)

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onDown = (e: PointerEvent | MouseEvent | TouchEvent) => {
      const p = pointFromEvent(e);
      if (p && p.x <= EDGE_PX) {
        startX = p.x;
        startY = p.y;
        tracking = true;
      }
    };
    const onUp = (e: PointerEvent | MouseEvent | TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const p = pointFromEvent(e);
      if (!p) return;
      const dx = p.x - startX;
      const dy = Math.abs(p.y - startY);
      if (dx >= THRESHOLD_X && dy <= MAX_DRIFT_Y) {
        // Always pop to the parent tab (`/silent-mind/<id>` →
        // `/silent-mind`), regardless of how the user reached this
        // detail page. Using `router.back()` would follow the actual
        // navigation history — if the user crossed over from a QM
        // detail via "Back to Silent Mind", history.back would
        // (counterintuitively) bring them back to the QM detail.
        // The user expectation: once on an SM detail, swipe-back
        // lands on the SM root — and same for QM.
        try {
          const parent = pathname.replace(/\/[^/]+$/, '');
          if (parent) router.replace(parent as any);
        } catch {}
      }
    };
    const onCancel = () => { tracking = false; };

    // Touchmove claims the gesture as a horizontal back-swipe as soon
    // as it's clearly more lateral than vertical. Without this, the
    // browser locks the gesture as a vertical scroll the moment the
    // user's finger drifts even slightly off horizontal — and our
    // pointerup never fires (the gesture became a scroll). With
    // passive: false we can preventDefault on touchmove, which stops
    // the page from scrolling and keeps the gesture ours.
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const p = pointFromEvent(e);
      if (!p) return;
      const dx = p.x - startX;
      const dy = Math.abs(p.y - startY);
      if (dx > 10 && dx > dy * 1.2) {
        // Claim it: prevent page scroll for the rest of this gesture.
        e.preventDefault();
      }
    };

    // Listen to **both** Pointer and legacy Mouse/Touch events. Some
    // Chrome desktop scenarios (notably trackpad mouse-emulation in
    // certain configs and synthetic events) deliver mouse events but
    // not pointer events to window, so the dual-listener belt-and-
    // braces guarantees we catch the gesture. `touchmove` is
    // **non-passive** so we can preventDefault when the gesture is
    // horizontal and "ours".
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    window.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown as any);
      window.removeEventListener('pointerup', onUp as any);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('mousedown', onDown as any);
      window.removeEventListener('mouseup', onUp as any);
      window.removeEventListener('touchstart', onDown as any);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('touchend', onUp as any);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, [isDetail, router, pathname]);

  return null;
}
