import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle, useSharedValue, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../../src/hooks/useLayout';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { CircleButton } from '../../src/components/CircleButton';
import { themeForNextTrack, type ShaderTheme } from '../../src/shaders';
import { useShaderThemeStore } from '../../src/shaders/themeStore';
import { KindIcon } from '../../src/components/KindIcon';
import { AccountSheet } from '../../src/components/AccountSheet';
import {
  startJourneySteps,
  silentMindVolets,
  qmVolets,
  trackDuration,
  type AudioTrack,
} from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useProgress } from '../../src/player/progressStore';
import { useAuth } from '../../src/auth/authStore';
import { colors, radius, spacing, type } from '../../src/theme';
import { noOrphan } from '../../src/utils/noOrphan';

type ModeKey = 'step-1min' | 'step-3min' | 'step-qm3';
type ModeCfg = {
  key: ModeKey;
  /** Primary label — duration on first read */
  duration: string;
  /** Sub-label — discoverable intent (uppercase overline) */
  short: string;
};

/** The three quick-meditation pills sitting under the big play button —
 *  always reachable, regardless of where the user is in the SM journey.
 *  Two-line pills: duration first, intent below as an overline. */
const MODES: ModeCfg[] = [
  { key: 'step-1min', duration: '1 min',     short: 'first practice' },
  { key: 'step-3min', duration: '3 min',     short: 'go deeper'      },
  { key: 'step-qm3',  duration: '3min × 3',  short: 'QM training'    },
];

/**
 * Module-level flag so the reveal sweep only plays once per app
 * launch — switching tabs and coming back shouldn't retrigger it, but
 * a cold start / app reload should.
 */
let didRevealOnce = false;

/**
 * Compact bust silhouette for the account button — head + shoulders
 * carved out of a single path. Renders crisply at 18 px and avoids the
 * inconsistent emoji rendering you'd get from 👤 across iOS / Android.
 */
function BustIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 3.1-8 7v1h16v-1c0-3.9-3.6-7-8-7z"
        fill={color}
      />
    </Svg>
  );
}


/**
 * Start page — single, unified layout (no phase A/B/C anymore).
 *
 *   [account]          (top-right of the safe area)
 *   Title — "Your journey to the Silent Mind"
 *
 *   "Start / Continue with"
 *   Next-track title
 *   ▶  Big play button → launches the next unlistened SM audio
 *
 *   1 min · 3 min · 11 min   (quick-meditation pills, always available)
 *
 * The big button's target is driven by `useProgress.nextTrackId()` which
 * walks the SM volets in order (intro → Part 1 → Part 2 → Part 3, plus
 * the QM tail). When everything's been listened it falls back to the
 * very first track (replay).
 */
export default function StartScreen() {
  const openPlayer = usePlayerStore(s => s.open);
  const listened = useProgress(s => s.listened);
  const nextTrackId = useProgress(s => s.nextTrackId);
  const user = useAuth(s => s.user);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isTablet, columnMax, playSize } = useLayout();
  const usableH = Math.max(360, height - insets.top - insets.bottom);
  const isTall = !isTablet && usableH >= 820;

  const [reveal] = useState(() => {
    if (didRevealOnce) return false;
    didRevealOnce = true;
    return true;
  });

  const [accountOpen, setAccountOpen] = useState(false);

  // Flat catalog of every playable track, in journey order. Drives both
  // id→track lookup and the playlist passed to the player so "next" /
  // "previous" inside the player follow the same SM walk the Start page
  // is advancing through.
  const journeyTracks = useMemo<AudioTrack[]>(() => {
    const sm = silentMindVolets.flatMap(v =>
      [...v.tracks, ...(v.qmTracks ?? [])].filter(t => !t.comingSoon),
    );
    const qm = qmVolets.flatMap(v => v.tracks.filter(t => !t.comingSoon));
    return [...sm, ...qm];
  }, []);

  // Resolve the next unlistened track. Falls back to the first journey
  // track if everything's been listened — pressing play then replays
  // the welcome instead of doing nothing.
  const nextId = nextTrackId();
  const nextTrack = useMemo(() => {
    if (nextId) return journeyTracks.find(t => t.id === nextId);
    return journeyTracks[0];
  }, [nextId, journeyTracks]);

  // Duration string for the next track — feeds the small media meta
  // row (icon + duration) that sits between the title and the play
  // button. We currently only journey through audios, but reading the
  // kind-agnostic helper keeps us ready for video tracks later.
  const nextDuration = nextTrack ? trackDuration(nextTrack) : undefined;

  const onPlayNext = () => {
    if (!nextTrack) return;
    openPlayer(nextTrack, journeyTracks, { autoStart: true });
  };

  // Quick-meditation pills — independent from the journey. Each is its
  // own short Start track from `startJourneySteps` (1min / 3min / QM3).
  const playMode = (key: ModeKey) => {
    const step = startJourneySteps.find(s => s.id === key);
    if (!step?.track) return;
    const pl = startJourneySteps.map(s => s.track).filter(Boolean) as AudioTrack[];
    openPlayer(step.track, pl, { autoStart: true });
  };

  // The avatar shows a generic bust silhouette regardless of provider —
  // simpler & more universal than an initial that may collide with
  // emoji'd OAuth display names. The user prop is read here only to
  // satisfy the lint check that we still depend on auth state for the
  // accessibility label.
  void user;

  // Fade-out is now handled at the root layout level (covers Start
  // + every other screen at once when the Player opens via any
  // entry point — Start CTA, QM/SM list ContentCard, etc.). No
  // per-screen subscription needed here.

  // Shader theme state lives in a tiny shared store so the
  // ShaderBackground (now rendered at the root layout, behind the
  // audio Player) and this dev pill can both reach it.
  const themeOverride = useShaderThemeStore(s => s.override);
  const setThemeOverride = useShaderThemeStore(s => s.setOverride);
  const autoTheme = themeForNextTrack(nextId);
  const cycleTheme = () => {
    const order: (ShaderTheme | null)[] = [null, 'earth', 'sky', 'space', 'lake', 'default'];
    const i = order.indexOf(themeOverride);
    setThemeOverride(order[(i + 1) % order.length]);
  };

  return (
    <View style={styles.root}>
      <SwipeTabs current="index">
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContainer,
              { paddingBottom: Math.max(insets.bottom, 0) },
            ]}
          >
            <View style={[styles.content, { maxWidth: columnMax, alignSelf: 'center' }]}>
              <Animated.View
                style={styles.header}
                entering={reveal ? FadeInDown.duration(600) : undefined}
              >
                {/* Title row: spacer · centred title · account avatar.
                    The leading spacer matches the avatar's footprint
                    so the title stays visually centred while the
                    avatar sits at the right end of the same band —
                    aligned with the title's eye level. */}
                <View style={styles.titleRow}>
                  <View style={styles.avatarSlot} />
                  <Text
                    style={[
                      styles.title,
                      isTall && styles.titleTall,
                      isTablet && styles.titleTablet,
                      { flex: 1 },
                    ]}
                    numberOfLines={2}
                  >
                    {noOrphan('Your journey to the Silent Mind')}
                  </Text>
                  <Pressable
                    onPress={() => setAccountOpen(true)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Open account menu"
                    style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.7 }]}
                  >
                    <BustIcon size={18} color={colors.text} />
                  </Pressable>
                </View>
              </Animated.View>

              <View style={styles.spacerTop} />

              {/* Journey block — text block (eyebrow + title + meta
                  row) ABOVE the round play button. The button itself
                  is the same `CircleButton` shell the Player uses so
                  the ring + glow + breath stay pinned at the same
                  screen position through the Start ↔ Player
                  crossfade — only the inner glyph changes (▶ here,
                  pause bars / live ring on the Player) and the rest
                  of the Start UI fades around it. */}
              <Animated.View
                style={styles.journeyBlock}
                entering={reveal ? FadeInDown.delay(220).duration(550) : undefined}
              >
                {/* "INTRODUCTION · 1 / 3" style eyebrow now lives in
                    the Player above its play circle (same vertical
                    position as the next-track title block here) — we
                    don't print it twice on the Start screen. */}
                {nextTrack ? (
                  <Text style={styles.nextTitle} numberOfLines={2}>
                    {noOrphan(nextTrack.title)}
                  </Text>
                ) : null}
                {nextTrack ? (
                  <View style={styles.metaRow}>
                    <KindIcon kind="audio" color={colors.textMuted} size={14} />
                    {nextDuration ? (
                      <Text style={styles.metaLabel}>{nextDuration}</Text>
                    ) : null}
                  </View>
                ) : null}
                <CircleButton
                  mode="pre"
                  size={playSize}
                  accent="#9D8AE8"
                  onPress={onPlayNext}
                />
              </Animated.View>

              <View style={styles.spacerBottom} />

              {/* Quick-meditation pills — always available as a side
                  channel, independent from the journey. Sentence-case
                  caption + three labelled pills, matching the existing
                  divider/pill grammar. */}
              <Animated.View
                entering={reveal ? FadeInDown.delay(420).duration(550) : undefined}
              >
                <Text style={[styles.pillsLabel, isTablet && styles.captionTablet]}>
                  {noOrphan('Instant Meditation')}
                </Text>
                <View style={styles.pillsRow}>
                  {MODES.map(m => (
                    <Pressable
                      key={m.key}
                      onPress={() => playMode(m.key)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Start ${m.duration} meditation, ${m.short}`}
                      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
                    >
                      <Text style={styles.pillLabel} numberOfLines={1}>{m.duration}</Text>
                      <Text style={styles.pillSub} numberOfLines={1}>{m.short}</Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>

              <View style={styles.bottomFloor} />
            </View>
          </ScrollView>
        </View>
      </SwipeTabs>

      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />

      {/* Dev-only theme cycler — floating pill in the bottom-right
          corner that cycles through the four shader themes (auto +
          three overrides). Hidden in production builds via __DEV__. */}
      {__DEV__ ? (
        <Pressable
          onPress={cycleTheme}
          style={({ pressed }) => [styles.themePill, pressed && { opacity: 0.7 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Cycle shader theme — current: ${themeOverride ?? 'auto'}`}
        >
          <Text style={styles.themePillText}>
            {themeOverride ? themeOverride.toUpperCase() : `AUTO · ${autoTheme}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const themePillStyles = {
  themePill: {
    position: 'absolute' as const,
    bottom: 90,
    right: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 100,
  },
  themePillText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '600' as const,
  },
};

const styles = StyleSheet.create({
  ...themePillStyles,
  root: { flex: 1 },
  scrollContainer: { flexGrow: 1, alignItems: 'center' },
  content: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  // Title row — flex row that pairs a leading spacer (same footprint
  // as the avatar) with the centred title and the avatar itself. Keeps
  // the title visually centred while the avatar sits in the same
  // horizontal band, so the bust icon reads as 'aligned with' the
  // title rather than floating above it.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  avatarSlot: { width: 32, height: 32 },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    ...type.display, color: colors.text,
    fontSize: 15, lineHeight: 20, letterSpacing: 0.8, textAlign: 'center',
  },
  titleTall: { fontSize: 17, lineHeight: 22, letterSpacing: 0.9 },
  titleTablet: { fontSize: 20, lineHeight: 24, letterSpacing: 1 },

  // Vertical spacers — flex:1 with a tiny floor so on compact phones
  // everything stays packed and on tall viewports the surplus is
  // distributed evenly between hero/journey and pills.
  // Spacers tuned so the CircleButton lands at roughly the same
  // vertical Y as the Player's circle (which sits at ~44 % of the
  // usable height between header and bottom area, computed from
  // its flexSpacer 0.78 + middle flex 1 ratio). spacerTop is
  // weighted heavier than the bottom spacers so the journey
  // block + circle sit visually centred-low like in the Player.
  spacerTop: { flex: 1.7, minHeight: spacing.sm },
  spacerBottom: { flex: 1, minHeight: spacing.md },
  bottomFloor: { flex: 1, minHeight: spacing.sm },

  // Journey block — the page's primary action.
  journeyBlock: { alignItems: 'center' },
  // Media meta row — sits below the next-track title as a quiet
  // descriptor of what's about to play (audio + duration). Headphones
  // icon flips to a play glyph when the track is a video. Tight gap
  // so it reads as a single chip.
  nextTitle: {
    ...type.h2,
    color: colors.text,
    fontSize: 18, lineHeight: 24, textAlign: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  // Audio kind icon + duration row, sits between the title and the
  // play button.
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  metaLabel: {
    ...type.caption,
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  captionTablet: { fontSize: 11, letterSpacing: 1.8 },

  // Quick-meditation pills row.
  pillsLabel: {
    ...type.overline,
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 1.6,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minWidth: 84,
    alignItems: 'center',
    // Soft accent glow — same direction as the central button's
    // halo, scaled down so the pills feel related to the hero CTA
    // without competing with it. RN shadow* props are honoured on
    // iOS / web; Android picks up the elevation fallback.
    shadowColor: '#9D8AE8',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    backgroundColor: 'rgba(157, 138, 232, 0.04)',
  },
  pillPressed: { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.04)' },
  pillLabel: {
    ...type.h3,
    color: colors.text,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  // Sub-label sits under the duration as an overline — same grammar as
  // the previous radio pills (FIRST PRACTICE / GO DEEPER / QM TRAINING).
  pillSub: {
    ...type.overline,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
