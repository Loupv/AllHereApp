import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { Platform, ScrollView, ScrollViewProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';

/**
 * ScrollView with iOS-style rubber-band overscroll on web.
 * Wheel jumps are smoothed with a short timing, accumulated overscroll
 * is mapped through a tanh saturation, and springs back when released.
 */
export const BouncyScrollView = forwardRef<ScrollView, ScrollViewProps>(function BouncyScrollView(
  { children, style, contentContainerStyle, bounces = true, ...rest },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView);

  // Raw accumulated pull (px). Displayed overscroll = softBound(raw).
  const raw = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: any = scrollRef.current;
    if (!node) return;
    const el: HTMLElement | null =
      typeof node.getScrollableNode === 'function' ? node.getScrollableNode() :
      node._nativeRef?._node ?? null;
    if (!el) return;

    const ATBOUND = 1.5;
    // Smaller factor on wheel since each tick is a big chunk (~100)
    const WHEEL_FACTOR = 0.22;
    const TOUCH_FACTOR = 0.9;
    let releaseTimer: any = 0;

    const springHome = () => {
      cancelAnimation(raw);
      raw.value = withSpring(0, {
        damping: 18,
        stiffness: 260,
        mass: 0.6,
        overshootClamping: false,
        restDisplacementThreshold: 0.3,
        restSpeedThreshold: 0.5,
      });
    };

    const pull = (delta: number) => {
      // Apply instantly: each wheel tick is ~60fps frame; smoothing adds lag.
      cancelAnimation(raw);
      raw.value = raw.value + delta;
    };

    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop <= ATBOUND;
      const atBottom = scrollTop + clientHeight >= scrollHeight - ATBOUND;
      const absorb = (atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0);
      if (absorb) {
        e.preventDefault();
        pull(e.deltaY * WHEEL_FACTOR);
        clearTimeout(releaseTimer);
        // Release fast: most wheel bursts settle within ~40ms between ticks.
        releaseTimer = setTimeout(springHome, 50);
      } else if (Math.abs(raw.value) > 0.1) {
        // Left the edge — release instantly
        clearTimeout(releaseTimer);
        springHome();
      }
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
      clearTimeout(releaseTimer);
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      const dy = touchY - y;
      touchY = y;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop <= ATBOUND;
      const atBottom = scrollTop + clientHeight >= scrollHeight - ATBOUND;
      if ((atTop && dy < 0) || (atBottom && dy > 0)) {
        pull(dy * TOUCH_FACTOR);
      }
    };
    const onTouchEnd = () => {
      clearTimeout(releaseTimer);
      springHome();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      clearTimeout(releaseTimer);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // tanh saturation: raw can grow unbounded but translate is capped to ±MAX
  const MAX = 70;
  const animStyle = useAnimatedStyle(() => {
    'worklet';
    const r = raw.value;
    // soft-bound with tanh: linear near 0, saturates around ±MAX
    const translate = -MAX * Math.tanh(r / MAX);
    return { transform: [{ translateY: translate }] };
  });

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
