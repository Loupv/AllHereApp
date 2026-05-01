import { Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../theme';

/**
 * Floating chevron-back button shown in the top-left of every detail
 * screen. We removed the navigation header (so the page's own colored
 * eyebrow lines up with the tab pages), but the user still wants a
 * tap target for going back as an alternative to the right-swipe
 * gesture. Sits above the safe-area top inset, semi-transparent so it
 * doesn't fight the page content.
 */
export function BackButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [
        styles.btn,
        { top: insets.top + spacing.xs },
        pressed && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.glyph}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    left: spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  glyph: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 32,
    fontWeight: '300',
    // Slight nudge up to optically-center the chevron in the box.
    marginTop: -2,
  },
});
