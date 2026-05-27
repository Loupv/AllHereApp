import { Modal, View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, radius, spacing, type as typo } from '../theme';

/**
 * Soft "update available" popup. Shown by the root layout when
 * useUpdateCheck finds a newer release on R2. Skippable — "Later"
 * records the dismissed version so it doesn't reappear until an even
 * newer one ships. No forced-update path.
 */
type Props = {
  version: string;
  url: string;
  onDismiss: () => void;
};

export function UpdateBanner({ version, url, onDismiss }: Props) {
  const openStore = () => {
    Linking.openURL(url).catch(() => {});
    onDismiss();
  };
  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>SILENT MIND</Text>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.body}>
            Version {version} is available with the latest improvements.
          </Text>
          <Pressable style={styles.cta} onPress={openStore}>
            <Text style={styles.ctaText}>Update</Text>
          </Pressable>
          <Pressable style={styles.skip} onPress={onDismiss} hitSlop={8}>
            <Text style={styles.skipText}>Later</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,4,18,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  eyebrow: {
    ...typo.overline,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  title: {
    ...typo.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    ...typo.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaText: {
    ...typo.button,
    color: colors.text,
  },
  skip: {
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  skipText: {
    ...typo.caption,
    color: colors.textDim,
  },
});
