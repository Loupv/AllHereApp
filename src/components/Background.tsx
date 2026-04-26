import { View, StyleSheet } from 'react-native';

/**
 * Page background wrapper.
 *
 * Historically this painted a solid tint per tab (`bgTab`, `bgTabAlt`).
 * The app now hosts a single shared `AnimatedGradient` at the tabs
 * layout level so navigation between tabs feels continuous — every
 * tab and detail screen renders over the same atmospheric backdrop.
 *
 * To preserve callers without breaking the API, this component now
 * renders a transparent flex container regardless of the `color` prop.
 * The prop is accepted for backwards compatibility and intentionally
 * ignored.
 */
export function Background({ children, color: _color }: { children: React.ReactNode; color?: string }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
});
