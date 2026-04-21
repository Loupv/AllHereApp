import { useEffect, useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

export function Collapse({ open, children, duration = 260 }: { open: boolean; children: React.ReactNode; duration?: number }) {
  const [inner, setInner] = useState(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (inner === 0) return;
    const easing = Easing.inOut(Easing.cubic);
    height.value = withTiming(open ? inner : 0, { duration, easing });
    opacity.value = withTiming(open ? 1 : 0, { duration: Math.round(duration * 0.8), easing });
  }, [open, inner, duration]);

  const wrapperStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: 'hidden',
    position: 'relative',
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - inner) > 0.5) setInner(h);
  };

  return (
    <Animated.View style={wrapperStyle}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        onLayout={onLayout}
      >
        {children}
      </View>
    </Animated.View>
  );
}
