import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown, SlideOutDown, FadeOut } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useProgress } from '../player/progressStore';
import { useAuth } from '../auth/authStore';
import { fetchStats, type AccountStats } from '../analytics/stats';
import { colors, radius, spacing, type } from '../theme';

const fmtTime = (s: number): string => {
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

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
 *
 * (Sign out was removed — there's no real auth gate yet, the guest user
 * is created automatically on first launch, so a logout button just
 * dropped people back onto the same screen with no observable effect.)
 *
 * Implemented as a modal with an opaque scrim + slide-up sheet — keeps
 * the rest of the app static behind it instead of pushing a route, so
 * dismissing returns the user exactly where they were on Start.
 */
export function AccountSheet({ visible, onClose }: Props) {
  const resetProgress = useProgress(s => s.resetProgress);
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);
  const handleLogout = () => { logout(); onClose(); };
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<AccountStats | null>(null);
  useEffect(() => {
    if (!visible || !user) { setStats(null); return; }
    let on = true;
    void fetchStats().then((s) => { if (on) setStats(s); });
    return () => { on = false; };
  }, [visible, user]);
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

  // Vertical-swipe-down to dismiss. Activates only on a clearly
  // downward drag (≥ 12 px) so the inner ScrollView gets the
  // gesture for normal vertical scrolling. Triggers when the
  // drag has gone past 80 px or the velocity is high enough to
  // suggest a flick.
  const dismissPan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetY(-8)
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 80 || e.velocityY > 600) {
        runOnJS(handleClose)();
      }
    });

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
        <GestureDetector gesture={dismissPan}>
        <Animated.View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(220)}
        >
          {/* Drag handle — non-functional, just an affordance hint. */}
          <View style={styles.handle} />

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* No login flow yet — progress is local-only — so we
                drop the "Hello, …" banner that had no value when no
                real account is attached. The sheet opens straight
                into actions; no header line. */}

            {user && <Text style={styles.email}>{user.email ?? 'Signed in'}</Text>}

            {user && stats && (
              <View style={styles.statsBlock}>
                <Text style={styles.statLine}>{stats.listens} listens · {fmtTime(stats.seconds)} listened</Text>
                <Text style={styles.statLine}>{stats.qmRounds} QM rounds · {stats.streakDays}-day streak</Text>
              </View>
            )}

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
              {confirmingReset ? (
                <Text style={[styles.rowHint, styles.rowHintDanger]}>
                  This clears every "listened" mark.
                </Text>
              ) : null}
            </Pressable>

            {user && (
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowLabel}>Log out</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.cancelLabel}>Close</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
        </GestureDetector>
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
    // Cap the sheet at ~80 % of the viewport so the inner ScrollView
    // gets a proper bounded height — without this on web the content
    // can push the sheet off-screen.
    maxHeight: '85%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  scrollArea: { flexShrink: 1 },
  scrollContent: { gap: spacing.xs, paddingBottom: spacing.md },
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
  statsBlock: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 2 },
  statLine: { ...type.caption, color: colors.textMuted, fontSize: 12 },
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

  // ---- Session sounds section ------------------------------------
  sectionLabel: {
    ...type.sectionLabel,
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  rowSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rowLabelDimmed: { opacity: 0.45 },
  bellGroup: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  // Greyed-out state used when the master Bell toggle is off — applied
  // to the sound radio + the boundaries sub-toggle so they read as
  // inert. Combined with `pointerEvents="none"` on the wrapping View
  // so taps don't sneak through.
  groupDisabled: {
    opacity: 0.4,
  },
  bellSoundLabel: {
    marginBottom: 2,
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  radioCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  radioCellSelected: {
    borderColor: colors.accentAlt,
    backgroundColor: 'rgba(54,160,158,0.18)',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  radioDotSelected: {
    borderColor: colors.accentAlt,
    backgroundColor: colors.accentAlt,
  },
  radioLabel: {
    ...type.body,
    color: colors.text,
    fontSize: 14,
  },
  radioLabelSelected: { color: colors.accentAlt },
});
