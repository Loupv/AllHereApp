import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { Platform, ScrollView, ScrollViewProps, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, type } from '../theme';

type Props = ScrollViewProps & {
  /** Called when the user drags the top down past the refresh threshold. */
  onRefresh?: () => void;
  /** When true, show the indicator in its spinning state until it flips back to false. */
  refreshing?: boolean;
};

/**
 * ScrollView with iOS-style rubber-band overscroll on web, plus an optional
 * pull-to-refresh indicator.
 *
 * - Web: bypass Reanimated entirely. Wheel / touch deltas are applied
 *   directly to the wrapper's CSS transform (zero-frame latency), release
 *   is handled by a simple rAF critically-damped spring. Refresh indicator
 *   is a React component whose rotation / opacity is driven from the same
 *   loop via a `data-p` attribute and scoped CSS.
 * - Native: fall through to the stock RN ScrollView. If onRefresh is set,
 *   a RefreshControl is attached so iOS/Android pull-to-refresh works out
 *   of the box.
 */
export const BouncyScrollView = forwardRef<ScrollView, Props>(function BouncyScrollView(
  {
    children, style, contentContainerStyle, bounces = true,
    onRefresh, refreshing,
    refreshControl, // do not double-wrap if a caller already supplied one
    ...rest
  },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  const wrapperRef = useRef<View>(null);
  const indicatorRef = useRef<View>(null);
  // Stash callbacks in refs so the event-listener closures always see the
  // latest values without having to re-attach on every render.
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(!!refreshing);
  onRefreshRef.current = onRefresh;
  refreshingRef.current = !!refreshing;

  useImperativeHandle(ref, () => scrollRef.current as ScrollView);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: any = scrollRef.current;
    if (!node) return;
    const scrollEl: HTMLElement | null =
      typeof node.getScrollableNode === 'function' ? node.getScrollableNode() :
      node._nativeRef?._node ?? null;
    const wrapperNode: any = wrapperRef.current as any;
    const wrapEl: HTMLElement | null = wrapperNode?._nativeRef?._node ?? wrapperNode ?? null;
    const indicatorNode: any = indicatorRef.current as any;
    const indicatorEl: HTMLElement | null = indicatorNode?._nativeRef?._node ?? indicatorNode ?? null;
    if (!scrollEl || !wrapEl) return;

    const ATBOUND = 1.5;
    const WHEEL_FACTOR = 0.22;
    const TOUCH_FACTOR = 0.9;
    const MAX = 70;
    const REFRESH_TRIGGER = 55; // px of visible pull-down that arms onRefresh

    let raw = 0;
    let current = 0;
    let velocity = 0;
    let rafId = 0;
    let releasing = false;
    let releaseTimer: any = 0;

    const softBound = (r: number) => -MAX * Math.tanh(r / MAX);

    const paintIndicator = (pullPx: number) => {
      if (!indicatorEl) return;
      const active = pullPx > 4;
      const p = Math.min(1, Math.max(0, pullPx / REFRESH_TRIGGER));
      indicatorEl.style.opacity = String(active ? Math.min(1, p + 0.1) : 0);
      indicatorEl.style.transform = `translate(-50%, 0) rotate(${p * 180}deg)`;
    };

    const paint = (tx: number) => {
      wrapEl.style.transform = tx === 0 ? '' : `translate3d(0, ${tx}px, 0)`;
      paintIndicator(tx);
    };

    const loop = () => {
      const k = 320;
      const d = 34;
      const dt = 1 / 60;
      const a = -k * current - d * velocity;
      velocity += a * dt;
      current += velocity * dt;
      if (Math.abs(current) < 0.2 && Math.abs(velocity) < 0.8) {
        current = 0;
        velocity = 0;
        raw = 0;
        paint(0);
        releasing = false;
        rafId = 0;
        return;
      }
      paint(current);
      rafId = requestAnimationFrame(loop);
    };

    const startRelease = () => {
      if (releasing) return;
      releasing = true;
      if (!rafId) rafId = requestAnimationFrame(loop);
    };

    const cancelRelease = () => {
      releasing = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    };

    const applyRaw = () => {
      current = softBound(raw);
      velocity = 0;
      paint(current);
    };

    const pull = (delta: number) => {
      cancelRelease();
      raw += delta;
      applyRaw();
    };

    const maybeFireRefresh = () => {
      if (!onRefreshRef.current) return;
      if (refreshingRef.current) return; // already in-flight
      if (current >= REFRESH_TRIGGER) {
        try { onRefreshRef.current(); } catch { /* ignore */ }
      }
    };

    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const atTop = scrollTop <= ATBOUND;
      const atBottom = scrollTop + clientHeight >= scrollHeight - ATBOUND;
      const absorb = (atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0);
      if (absorb) {
        e.preventDefault();
        pull(e.deltaY * WHEEL_FACTOR);
        clearTimeout(releaseTimer);
        releaseTimer = setTimeout(() => {
          maybeFireRefresh();
          startRelease();
        }, 32);
      } else if (raw !== 0) {
        clearTimeout(releaseTimer);
        maybeFireRefresh();
        startRelease();
      }
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
      clearTimeout(releaseTimer);
      cancelRelease();
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      const dy = touchY - y;
      touchY = y;
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const atTop = scrollTop <= ATBOUND;
      const atBottom = scrollTop + clientHeight >= scrollHeight - ATBOUND;
      if ((atTop && dy < 0) || (atBottom && dy > 0)) {
        pull(dy * TOUCH_FACTOR);
      }
    };
    const onTouchEnd = () => {
      clearTimeout(releaseTimer);
      maybeFireRefresh();
      startRelease();
    };

    wrapEl.style.willChange = 'transform';
    wrapEl.style.transition = '';

    scrollEl.addEventListener('wheel', onWheel, { passive: false });
    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: true });
    scrollEl.addEventListener('touchend', onTouchEnd, { passive: true });
    scrollEl.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      clearTimeout(releaseTimer);
      if (rafId) cancelAnimationFrame(rafId);
      scrollEl.removeEventListener('wheel', onWheel);
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
      scrollEl.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // Native: wire RefreshControl so iOS/Android pull-to-refresh still works.
  let effectiveRefreshControl = refreshControl;
  if (!effectiveRefreshControl && onRefresh && Platform.OS !== 'web') {
    // Lazy require to avoid a web bundle cost for an unused component.
    const { RefreshControl } = require('react-native');
    effectiveRefreshControl = (
      <RefreshControl
        refreshing={!!refreshing}
        onRefresh={onRefresh}
        tintColor={colors.accent}
        colors={[colors.accent]}
      />
    );
  }

  // Indicator — web only. Native has its own RefreshControl spinner.
  const showIndicator = Platform.OS === 'web' && !!onRefresh;

  return (
    <View ref={wrapperRef} style={{ flex: 1 }}>
      {showIndicator ? (
        <View
          ref={indicatorRef}
          // Drawn inside the wrapper so it follows the pull translate. Sits
          // above the top edge by default (opacity 0) and peeks into view as
          // the user drags.
          style={styles.indicator}
          pointerEvents="none"
        >
          <View style={[styles.indicatorInner, refreshing && styles.indicatorSpinning]}>
            <Text style={styles.indicatorArrow}>{refreshing ? '◴' : '↓'}</Text>
          </View>
          {refreshing ? <Text style={styles.indicatorLabel}>Refreshing…</Text> : null}
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        bounces={bounces}
        refreshControl={effectiveRefreshControl}
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: -46,
    left: '50%',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
    opacity: 0,
    // Center via translate (left:50% + translateX(-50%) done in JS on web)
    ...(Platform.OS === 'web' ? ({ transform: 'translate(-50%, 0)' } as any) : null),
  },
  indicatorInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSpinning: {
    // Use a CSS animation on web only; native wouldn't use this path anyway.
    ...(Platform.OS === 'web' ? ({ animation: 'ah-spin 800ms linear infinite' } as any) : null),
  },
  indicatorArrow: { ...type.caption, color: colors.accent, fontSize: 14, lineHeight: 16 },
  indicatorLabel: { ...type.overline, color: colors.textDim, fontSize: 9 },
});

// Inject the keyframes once on web.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const id = 'ah-bouncy-spin';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.innerHTML = '@keyframes ah-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }
}
