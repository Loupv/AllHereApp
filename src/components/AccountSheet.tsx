import { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown, SlideOutDown, FadeOut } from 'react-native-reanimated';
import { useAuth } from '../auth/authStore';
import { useProgress } from '../player/progressStore';
import { colors, radius, spacing, type } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Bottom-sheet account menu.
 *
 * Surfaces the few actions a user actually performs from the home tab:
 *   – greeting + email (passive context)
 *   – Reset progress (with a 2-step confirm so a misclick can't wipe
 *     someone's run through the program)
 *   – Sign out
 *
 * Implemented as a modal with an opaque scrim + slide-up sheet — keeps
 * the rest of the app static behind it instead of pushing a route, so
 * dismissing returns the user exactly where they were on Start.
 */
export function AccountSheet({ visible, onClose }: Props) {
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);
  const resetProgress = useProgress(s => s.resetProgress);
  const insets = useSafeAreaInsets();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetProgress();
    setConfirmingReset(false);
    onClose();
  };

  const handleClose = () => {
    setConfirmingReset(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View
        style={StyleSheet.absoluteFill}
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(180)}
      >
        {/* Scrim — tap to dismiss. Sits behind the sheet so the sheet
            interior stays interactive. */}
        <Pressable style={styles.scrim} onPress={handleClose} />
        <Animated.View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(220)}
        >
          {/* Drag handle — non-functional, just an affordance hint. */}
          <View style={styles.handle} />

          <Text style={styles.greeting}>
            {user?.name ? `Hello, ${user.name}` : 'Account'}
          </Text>
          {user?.email ? (
            <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
          ) : null}

          <View style={styles.divider} />

          {/* Reset progress — two-tap confirm. First tap reveals the
              warning copy in red; second tap commits. Auto-resets if
              the sheet is closed. */}
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={[styles.rowLabel, confirmingReset && styles.rowLabelDanger]}>
              {confirmingReset ? 'Tap again to confirm' : 'Reset progress'}
            </Text>
            <Text style={[styles.rowHint, confirmingReset && styles.rowHintDanger]}>
              {confirmingReset
                ? 'This clears every "listened" mark.'
                : 'Start the journey from the top.'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { logout(); onClose(); }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowLabel}>Sign out</Text>
          </Pressable>

          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLabel}>Close</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: spacing.md,
  },
  greeting: { ...type.h2, color: colors.text, fontSize: 18 },
  email: { ...type.caption, color: colors.textMuted, fontSize: 12, marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: spacing.md,
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rowLabel: { ...type.body, color: colors.text, fontSize: 15 },
  rowLabelDanger: { color: '#FF6B6B' },
  rowHint: { ...type.caption, color: colors.textDim, fontSize: 12, marginTop: 2 },
  rowHintDanger: { color: 'rgba(255,107,107,0.78)' },
  cancelBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelLabel: { ...type.caption, color: colors.textDim, textDecorationLine: 'underline' },
});
