import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { Platform, ScrollView, ScrollViewProps, View } from 'react-native';

/**
 * ScrollView with iOS-style rubber-band overscroll on web.
 * On web we bypass Reanimated entirely: wheel deltas are applied directly to
 * the wrapper's CSS transform (zero-frame latency), and release is handled
 * by a simple rAF critically-damped spring. On native we fall through to the
 * stock RN ScrollView (which already bounces on iOS).
 */
export const BouncyScrollView = forwardRef<ScrollView, ScrollViewProps>(function BouncyScrollView(
  { children, style, contentContainerStyle, bounces = true, ...rest },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  const wrapperRef = useRef<View>(null);
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
    if (!scrollEl || !wrapEl) return;

    const ATBOUND = 1.5;
    const WHEEL_FACTOR = 0.22;
    const TOUCH_FACTOR = 0.9;
    const MAX = 70; // px soft cap

    let raw = 0;       // accumulated overscroll, can exceed MAX (saturated via tanh)
    let current = 0;   // displayed translate in px
    let velocity = 0;  // for spring
    let rafId = 0;
    let releasing = false;
    let releaseTimer: any = 0;

    const softBound = (r: number) => -MAX * Math.tanh(r / MAX);

    const paint = (tx: number) => {
      // willChange kept static via CSS below; direct style write = next-frame paint
      wrapEl.style.transform = tx === 0 ? '' : `translate3d(0, ${tx}px, 0)`;
    };

    const loop = () => {
      // Critically-damped spring toward 0
      const k = 320;     // stiffness
      const d = 34;      // damping (2*sqrt(k) ~ 35.8 → slightly under-damped)
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
      // Seed velocity from the rate of recent pull so release feels connected.
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

    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const atTop = scrollTop <= ATBOUND;
      const atBottom = scrollTop + clientHeight >= scrollHeight - ATBOUND;
      const absorb = (atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0);
      if (absorb) {
        e.preventDefault();
        pull(e.deltaY * WHEEL_FACTOR);
        clearTimeout(releaseTimer);
        // Spring back as soon as wheel stops — 32ms is just over one wheel tick.
        releaseTimer = setTimeout(startRelease, 32);
      } else if (raw !== 0) {
        // Pointer scrolled back into content — release immediately
        clearTimeout(releaseTimer);
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
      startRelease();
    };

    // Baseline styles for the wrapper — avoid transition (we drive it ourselves)
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

  return (
    <View ref={wrapperRef} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        bounces={bounces}
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
});
