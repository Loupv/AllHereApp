import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { Platform, ScrollView, ScrollViewProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, cancelAnimation } from 'react-native-reanimated';

/**
 * ScrollView with iOS-style rubber-band overscroll on web.
 * Content elastically follows the user at bounds, then springs back when released.
 */
export const BouncyScrollView = forwardRef<ScrollView, ScrollViewProps>(function BouncyScrollView(
  { children, style, contentContainerStyle, bounces = true, ...rest },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView);

  const overscroll = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: any = scrollRef.current;
    if (!node) return;
    const el: HTMLElement | null =
      typeof node.getScrollableNode === 'function' ? node.getScrollableNode() :
      node._nativeRef?._node ?? null;
    if (!el) return;

    const ATBOUND = 1.5;
    const MAX = 120;
    const DAMP = 0.35;
    let springTimer: any = 0;

    const releaseSpring = () => {
      overscroll.value = withSpring(0, {
        damping: 18,
        stiffness: 140,
        overshootClamping: false,
        restDisplacementThreshold: 0.5,
      });
    };

    const applyDelta = (delta: number, atTop: boolean, atBottom: boolean) => {
      if ((atTop && delta < 0) || (atBottom && delta > 0)) {
        cancelAnimation(overscroll);
        const cur = overscroll.value;
        // progressive resistance: further you pull, more it resists
        const resistance = Math.max(0.15, 1 - Math.abs(cur) / MAX);
        const next = Math.max(-MAX, Math.min(MAX, cur + delta * DAMP * resistance));
        overscroll.value = next;
        clearTimeout(springTimer);
        // Small deltas = trackpad inertia winding down → spring back right away.
        // Normal drags keep refreshing the timer so spring stays parked.
        if (Math.abs(delta) < 4 && Math.abs(cur) > 3) {
          releaseSpring();
        } else {
          springTimer = setTimeout(releaseSpring, 30);
        }
        return true;
      }
      if (Math.abs(overscroll.value) > 0.1) {
        cancelAnimation(overscroll);
        clearTimeout(springTimer);
        releaseSpring();
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop <= ATBOUND;
      const atBottom = scrollTop + clientHeight >= scrollHeight - ATBOUND;
      const absorbed = applyDelta(e.deltaY, atTop, atBottom);
      if (absorbed) e.preventDefault();
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
      clearTimeout(springTimer);
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      const dy = touchY - y;
      touchY = y;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop <= ATBOUND;
      const atBottom = scrollTop + clientHeight >= scrollHeight - ATBOUND;
      applyDelta(dy, atTop, atBottom);
    };
    const onTouchEnd = () => {
      clearTimeout(springTimer);
      releaseSpring();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      clearTimeout(springTimer);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -overscroll.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <ScrollView
        ref={scrollRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        bounces={bounces}
        {...rest}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
});
