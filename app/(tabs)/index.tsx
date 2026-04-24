import { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../../src/hooks/useLayout';
import { BouncyScrollView as ScrollView } from '../../src/components/BouncyScrollView';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { AnimatedGradient } from '../../src/components/AnimatedGradient';
import { BigPlayButton, type BigPlayMode } from '../../src/components/BigPlayButton';
import { KindIcon } from '../../src/components/KindIcon';
import { startJourneySteps, introAudios, type AudioTrack } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useProgress } from '../../src/player/progressStore';
import { colors, radius, spacing, type } from '../../src/theme';

type ModeKey = 'step-1min' | 'step-3min' | 'step-qm3';

/**
 * Module-level flag so the reveal sweep only plays once per app
 * launch — switching tabs and coming back shouldn't retrigger it, but
 * a cold start / app reload should. The flag resets naturally on
 * full reload since the module is re-evaluated.
 */
let didRevealOnce = false;

type ModeCfg = {
  key: ModeKey;
  big: BigPlayMode;
  /** Line 2 of the pill — discoverable intent */
  short: string;
  /** Shown inside the big play button (brand/voice, kept per user request) */
  playLabel: string;
  /** Line 1 of the pill — primary info for scan-to-decide */
  duration: string;
};

const MODES: ModeCfg[] = [
  { key: 'step-1min', big: 'one',   short: 'first practice', playLabel: '60s',    duration: '1 min'  },
  { key: 'step-3min', big: 'three', short: 'go deeper',      playLabel: '3min',   duration: '3 min'  },
  { key: 'step-qm3',  big: 'qm3',   short: 'QM format',      playLabel: '3x3min', duration: '11 min' },
];

/**
 * Start page follows the user's lifecycle: a new user sees a big intro
 * card + a first session; an in-progress user sees a progress counter +
 * the next step's big play button; a completed user sees the two full
 * programs (Silent Mind, QM) and a tiny revisit row for the gateway.
 *
 *   phase A  0/3 gateway done and intro not touched  →  "Welcome"
 *   phase B  1–2/3 gateway done (or intro touched)  →  "In progress"
 *   phase C  3/3 gateway done                        →  "Ready for the program"
 */
type Phase = 'A' | 'B' | 'C';

export default function StartScreen() {
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const listened = useProgress(s => s.listened);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isTablet, columnMax } = useLayout();
  const usableH = Math.max(360, height - insets.top - insets.bottom);
  const playSize = isTablet
    ? Math.max(220, Math.min(320, Math.round(usableH / 4)))
    : Math.max(130, Math.min(180, Math.round(usableH / 5.5)));

  // Introduction audios — four short tracks that welcome the user and
  // prepare the space. Surfaced directly on the Start page; no
  // dedicated volet page exists for them anymore.
  const introTracks = introAudios;

  // Play the staggered reveal only on the app's first Start-screen
  // mount. `useState` initializer runs once per component instance,
  // and the module flag survives remounts during the same session.
  const [reveal] = useState(() => {
    if (didRevealOnce) return false;
    didRevealOnce = true;
    return true;
  });

  // Phase detection: read from progressStore so the page mutates as the
  // user progresses through the gateway.
  const gatewayTrackIds = useMemo(
    () => startJourneySteps.map(s => s.track?.id).filter(Boolean) as string[],
    [],
  );
  const introTrackIds = useMemo(
    () => introTracks.map(t => t.id),
    [introTracks],
  );
  const gatewayDone = gatewayTrackIds.filter(id => listened[id]).length;
  const introTouched = introTrackIds.some(id => listened[id]);
  const phase: Phase =
    gatewayDone >= 3 ? 'C'
    : (gatewayDone === 0 && !introTouched) ? 'A'
    : 'B';

  // Smart default: first unlistened step.
  const defaultMode: ModeKey = useMemo(() => {
    for (const s of startJourneySteps) {
      if (s.track && !listened[s.track.id]) return s.id as ModeKey;
    }
    return 'step-1min';
  }, [listened]);
  const [mode, setMode] = useState<ModeKey>(defaultMode);
  // Auto-advance fires **only** when the currently-selected step
  // just transitioned from unlistened to listened (i.e. the user
  // really did finish it this session). Comparing against the
  // previous `listened` snapshot lets a user tap a completed pill
  // to replay it without the selection snapping away.
  const prevListened = useRef(listened);
  useEffect(() => {
    const currentTrackId = startJourneySteps.find(s => s.id === mode)?.track?.id;
    if (currentTrackId) {
      const wasListened = !!prevListened.current[currentTrackId];
      const isListened = !!listened[currentTrackId];
      if (!wasListened && isListened && defaultMode !== mode) {
        setMode(defaultMode);
      }
    }
    prevListened.current = listened;
  }, [listened, mode, defaultMode]);
  const cfg = MODES.find(m => m.key === mode)!;

  const playMode = (key: ModeKey) => {
    const step = startJourneySteps.find(s => s.id === key);
    if (!step?.track) return;
    const pl = startJourneySteps.map(s => s.track).filter(Boolean) as any;
    openPlayer(step.track, pl, { autoStart: true });
  };

  const onPlay = () => playMode(mode);

  // Gradient climbs with the user's progress through the onboarding:
  //   0/3 done → glow sits on the big play button (bottom-ish)
  //   1/3     → rises toward mid
  //   2/3     → above mid
  //   3/3     → top of the viewport
  // The AnimatedGradient component eases the transition in ~800ms so
  // completing a step feels like the page itself is reaching upward.
  const gradientCenterY = 0.78 - (gatewayDone / 3) * 0.60;

  // onPrimaryLayout is kept as a no-op hook so children can attach it
  // without knowing the gradient is now phase-driven. Eventually we
  // can remove the prop entirely.
  const onPrimaryLayout = (_e: LayoutChangeEvent) => {};
  const onContentLayout = (_e: LayoutChangeEvent) => {};

  return (
    <View style={styles.root}>
      <SwipeTabs current="index">
        <AnimatedGradient centerY={gradientCenterY}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContainer,
              { paddingBottom: Math.max(insets.bottom, 0) },
            ]}
          >
            <View style={[styles.content, { maxWidth: columnMax, alignSelf: 'center' }]} onLayout={onContentLayout}>
              <Animated.View
                style={styles.header}
                entering={reveal ? FadeInDown.duration(600) : undefined}
              >
                <Text style={styles.eyebrow}>STEP BY STEP</Text>
                <Text style={[styles.title, isTablet && styles.titleTablet]}>
                  {phase === 'A' ? 'Welcome' : phase === 'B' ? 'Welcome back' : 'Ready for more'}
                </Text>
                <Text style={styles.subtitle}>Your journey to the Silent Mind</Text>
              </Animated.View>

              {phase === 'A' && (
                <PhaseA
                  reveal={reveal}
                  isTablet={isTablet}
                  introTracks={introTracks}
                  onPlayIntroTrack={(t) => {
                    openPlayer(t, introTracks as any, { autoStart: true });
                  }}
                  modes={MODES}
                  mode={mode}
                  setMode={setMode}
                  playSize={playSize}
                  playLabel={cfg.playLabel}
                  playBig={cfg.big}
                  onPlay={onPlay}
                  onPrimaryLayout={onPrimaryLayout}
                  listened={listened}
                />
              )}

              {phase === 'B' && (
                <PhaseB
                  reveal={reveal}
                  isTablet={isTablet}
                  introTracks={introTracks}
                  onPlayIntroTrack={(t) => openPlayer(t, introTracks as any, { autoStart: true })}
                  gatewayDone={gatewayDone}
                  modes={MODES}
                  mode={mode}
                  setMode={setMode}
                  playSize={playSize}
                  playLabel={cfg.playLabel}
                  playBig={cfg.big}
                  onPlay={onPlay}
                  onPrimaryLayout={onPrimaryLayout}
                  listened={listened}
                />
              )}

              {phase === 'C' && (
                <PhaseC
                  reveal={reveal}
                  isTablet={isTablet}
                  onOpenSM={() => router.push('/silent-mind')}
                  onOpenQM={() => router.push('/qm')}
                  introTracks={introTracks}
                  onPlayIntroTrack={(t) => openPlayer(t, introTracks as any, { autoStart: true })}
                  modes={MODES}
                  onRevisitMode={playMode}
                  onPrimaryLayout={onPrimaryLayout}
                />
              )}
            </View>
          </ScrollView>
        </AnimatedGradient>
      </SwipeTabs>
    </View>
  );
}

// --------- Shared section-label divider --------------------------------

/**
 * Section label flanked by thin horizontal lines — the visual motif
 * used everywhere on the Start page so every phase breathes the same
 * way. Text is auto-uppercased (via `type.overline`) so callers can
 * pass plain case.
 *
 * Default tint is `textDim` (the neutral separator) — pass `accent`
 * for counters / status lines that should pop (STEP X OF 3, GATEWAY
 * COMPLETED). When `onPress` is provided the whole row is tappable;
 * pass `trailing` for accessory text like a chevron.
 */
function DividerLabel(props: {
  text: string;
  color?: string;
  trailing?: string;
  onPress?: () => void;
  isTablet?: boolean;
  style?: any;
}) {
  const { text, color, trailing, onPress, isTablet, style } = props;
  const label = (
    <View style={[styles.orRow, style]}>
      <View style={styles.orLine} />
      <Text style={[styles.orLabel, isTablet && styles.sectionLabelTablet, color ? { color } : null]}>
        {text}{trailing ? ` ${trailing}` : ''}
      </Text>
      <View style={styles.orLine} />
    </View>
  );
  if (!onPress) return label;
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      {label}
    </Pressable>
  );
}

// --------- Phase A — "Welcome" -----------------------------------------

function PhaseA(props: {
  reveal: boolean;
  isTablet: boolean;
  introTracks: AudioTrack[];
  onPlayIntroTrack: (t: AudioTrack) => void;
  modes: ModeCfg[];
  mode: ModeKey;
  setMode: (k: ModeKey) => void;
  playSize: number;
  playLabel: string;
  playBig: BigPlayMode;
  onPlay: () => void;
  onPrimaryLayout: (e: LayoutChangeEvent) => void;
  listened: Record<string, true>;
}) {
  const { reveal, isTablet, introTracks, onPlayIntroTrack, modes, mode, setMode, playSize, playLabel, playBig, onPlay, onPrimaryLayout, listened } = props;
  // Staggered reveal — header at 0ms (handled by parent), intro block
  // at 180ms, OR divider at 360ms, start block at 520ms. Each uses a
  // mild downward slide so the page "fills in" from top to bottom.
  const enter = (delay: number) =>
    reveal ? FadeInDown.delay(delay).duration(550) : undefined;
  return (
    <>
      <View style={styles.introSpacerTop} />
      {introTracks.length > 0 ? (
        <Animated.View style={styles.block} entering={enter(180)}>
          {/* Plain centered label (no flanking lines) — reserves the
              divider-with-lines motif for real semantic splits like
              "or …" below, where two alternatives sit either side. */}
          <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>
            New here? Start with the intro
          </Text>
          {/* Unpacked intro volet — each of the 4 audios is directly
              launchable from the home, with a headphone glyph to make
              the medium unambiguous. Kept tight (compact rows) so the
              list doesn't steal the whole first screen. */}
          <View style={styles.introList}>
            {introTracks.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => onPlayIntroTrack(t)}
                accessibilityRole="button"
                accessibilityLabel={`Play intro audio: ${t.title}${t.durationHint ? `, ${t.durationHint}` : ''}`}
                style={({ pressed }) => [styles.introRow, pressed && { opacity: 0.85 }]}
              >
                <KindIcon kind="audio" color={colors.textDim} size={18} />
                <Text style={styles.introRowTitle} numberOfLines={1}>{t.title}</Text>
                {t.durationHint ? (
                  <Text style={styles.introRowMeta}>{t.durationHint}</Text>
                ) : null}
                <Text style={styles.introRowChevron}>→</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.orSpacerTop} />
      <Animated.View entering={enter(360)}>
        <DividerLabel text="or start a quick meditation" isTablet={isTablet} />
      </Animated.View>
      <View style={styles.orSpacerBottom} />

      <Animated.View entering={enter(520)}>
        <StartBlock
          isTablet={isTablet}
          modes={modes}
          mode={mode}
          setMode={setMode}
          playSize={playSize}
          playLabel={playLabel}
          playBig={playBig}
          onPlay={onPlay}
          onPrimaryLayout={onPrimaryLayout}
          listened={listened}
          showLabel={false}
        />
      </Animated.View>
      <View style={styles.bottomSpacer} />
    </>
  );
}

// --------- Phase B — "In progress" -------------------------------------

function PhaseB(props: {
  reveal: boolean;
  isTablet: boolean;
  introTracks: AudioTrack[];
  onPlayIntroTrack: (t: AudioTrack) => void;
  gatewayDone: number;
  modes: ModeCfg[];
  mode: ModeKey;
  setMode: (k: ModeKey) => void;
  playSize: number;
  playLabel: string;
  playBig: BigPlayMode;
  onPlay: () => void;
  onPrimaryLayout: (e: LayoutChangeEvent) => void;
  listened: Record<string, true>;
}) {
  const { reveal, isTablet, introTracks, onPlayIntroTrack, gatewayDone, modes, mode, setMode, playSize, playLabel, playBig, onPlay, onPrimaryLayout, listened } = props;
  const enter = (delay: number) =>
    reveal ? FadeInDown.delay(delay).duration(550) : undefined;
  return (
    <>
      <View style={styles.introSpacerTop} />
      <Animated.View style={styles.block} entering={enter(180)}>
        <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>
          Intro audios
        </Text>
        <View style={styles.introList}>
          {introTracks.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onPlayIntroTrack(t)}
              accessibilityRole="button"
              accessibilityLabel={`Play intro audio: ${t.title}${t.durationHint ? `, ${t.durationHint}` : ''}`}
              style={({ pressed }) => [styles.introRow, pressed && { opacity: 0.85 }]}
            >
              <KindIcon kind="audio" color={colors.accent} size={18} />
              <Text style={styles.introRowTitle} numberOfLines={1}>{t.title}</Text>
              {t.durationHint ? (
                <Text style={styles.introRowMeta}>{t.durationHint}</Text>
              ) : null}
              <Text style={styles.introRowChevron}>→</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <View style={styles.orSpacerTop} />
      <Animated.View entering={enter(320)}>
        <DividerLabel
          text={`Step ${gatewayDone + 1} of 3`}
          isTablet={isTablet}
          style={{ marginBottom: spacing.md }}
        />
        <StartBlock
          isTablet={isTablet}
          modes={modes}
          mode={mode}
          setMode={setMode}
          playSize={playSize}
          playLabel={playLabel}
          playBig={playBig}
          onPlay={onPlay}
          onPrimaryLayout={onPrimaryLayout}
          listened={listened}
          showLabel={false}
        />
      </Animated.View>
      <View style={styles.bottomSpacer} />
    </>
  );
}

// --------- Phase C — "Ready for the program" ---------------------------

function PhaseC(props: {
  reveal: boolean;
  isTablet: boolean;
  onOpenSM: () => void;
  onOpenQM: () => void;
  introTracks: AudioTrack[];
  onPlayIntroTrack: (t: AudioTrack) => void;
  modes: ModeCfg[];
  onRevisitMode: (k: ModeKey) => void;
  onPrimaryLayout: (e: LayoutChangeEvent) => void;
}) {
  const { reveal, isTablet, onOpenSM, onOpenQM, introTracks, onPlayIntroTrack, modes, onRevisitMode, onPrimaryLayout } = props;
  const enter = (delay: number) =>
    reveal ? FadeInDown.delay(delay).duration(550) : undefined;
  return (
    <>
      <View style={styles.introSpacerTop} />
      <Animated.View style={styles.block} entering={enter(180)}>
        <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>
          Intro audios
        </Text>
        <View style={styles.introList}>
          {introTracks.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onPlayIntroTrack(t)}
              accessibilityRole="button"
              accessibilityLabel={`Play intro audio: ${t.title}${t.durationHint ? `, ${t.durationHint}` : ''}`}
              style={({ pressed }) => [styles.introRow, pressed && { opacity: 0.85 }]}
            >
              <KindIcon kind="audio" color={colors.accent} size={18} />
              <Text style={styles.introRowTitle} numberOfLines={1}>{t.title}</Text>
              {t.durationHint ? (
                <Text style={styles.introRowMeta}>{t.durationHint}</Text>
              ) : null}
              <Text style={styles.introRowChevron}>→</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <View style={styles.orSpacerTop} />

      <Animated.View style={styles.programsWrap} onLayout={onPrimaryLayout} entering={enter(340)}>
        <Pressable
          onPress={onOpenSM}
          accessibilityRole="button"
          accessibilityLabel="Open Silent Mind program — three guided parts"
          style={({ pressed }) => [styles.programCta, styles.programCtaSM, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.programEyebrow}>SILENT MIND PROGRAM</Text>
          <Text style={styles.programTitle}>To the Silent Mind →</Text>
          <Text style={styles.programHint}>Three guided parts, at your pace.</Text>
        </Pressable>
        <Pressable
          onPress={onOpenQM}
          accessibilityRole="button"
          accessibilityLabel="Open QM Format — timed rounds"
          style={({ pressed }) => [styles.programCta, styles.programCtaQM, pressed && { opacity: 0.88 }]}
        >
          <Text style={[styles.programEyebrow, { color: colors.accentAlt }]}>QM FORMAT</Text>
          <Text style={styles.programTitle}>Quantified Meditation →</Text>
          <Text style={styles.programHint}>Timed rounds, same practices, on demand.</Text>
        </Pressable>
      </Animated.View>

      <View style={styles.orSpacerBottom} />

      <Animated.View entering={enter(540)}>
        <DividerLabel
          text="Replay quick meditation"
          isTablet={isTablet}
          style={{ marginBottom: spacing.sm }}
        />
        <View style={styles.revisitRow}>
          {modes.map(m => (
            <Pressable
              key={m.key}
              onPress={() => onRevisitMode(m.key)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Replay ${m.duration} session`}
              style={({ pressed }) => [styles.miniPill, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.miniPillLabel}>{m.duration}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <View style={styles.bottomSpacer} />
    </>
  );
}

// --------- Shared pills + big play block -------------------------------

function StartBlock(props: {
  isTablet: boolean;
  modes: ModeCfg[];
  mode: ModeKey;
  setMode: (k: ModeKey) => void;
  playSize: number;
  playLabel: string;
  playBig: BigPlayMode;
  onPlay: () => void;
  onPrimaryLayout: (e: LayoutChangeEvent) => void;
  listened: Record<string, true>;
  showLabel: boolean;
}) {
  const { isTablet, modes, mode, setMode, playSize, playLabel, playBig, onPlay, onPrimaryLayout, listened, showLabel } = props;

  // Description of the currently-selected track — shown between the
  // pills and the big play button so the user knows what starts on tap
  // (autoStart skips pre-play). Pulled from startJourneySteps so the
  // strings live with the content, not in the UI.
  const selectedStep = startJourneySteps.find(s => s.id === mode);
  const description = selectedStep?.description ?? '';

  return (
    <View style={styles.startBlock} onLayout={onPrimaryLayout}>
      {showLabel ? (
        <Text style={[styles.sectionLabel, styles.startLabel, isTablet && styles.sectionLabelTablet]}>Start with</Text>
      ) : null}

      <View style={styles.radioRow} accessibilityRole="radiogroup">
        {modes.map(m => {
          const selected = m.key === mode;
          const done = (() => {
            const s = startJourneySteps.find(s => s.id === m.key);
            return !!(s?.track && listened[s.track.id]);
          })();
          return (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${m.duration}, ${m.short}${done ? ', completed' : ''}`}
              style={({ pressed }) => [
                styles.radio,
                selected && styles.radioSelected,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.radioDuration,
                  isTablet && styles.radioDurationTablet,
                  selected && styles.radioDurationSelected,
                ]}
                numberOfLines={1}
              >
                {m.duration}{done ? ' ✓' : ''}
              </Text>
              <Text
                style={[
                  styles.radioSub,
                  isTablet && styles.radioSubTablet,
                  selected && styles.radioSubSelected,
                ]}
                numberOfLines={1}
              >
                {m.short}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {description ? (
        <Text style={styles.descLine} numberOfLines={3}>{description}</Text>
      ) : null}

      <View style={styles.centerInner}>
        <BigPlayButton
          mode={playBig}
          label={playLabel}
          size={playSize}
          onPress={onPlay}
        />
      </View>
    </View>
  );
}

// --------- styles ------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContainer: { flexGrow: 1, alignItems: 'center' },
  content: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Header now carries eyebrow + title + subtitle — a touch taller to
  // absorb the extra line without clipping.
  header: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
  },
  block: { justifyContent: 'center' },
  startBlock: { alignItems: 'stretch' },
  introSpacerTop: { flex: 2, minHeight: spacing.md },
  orSpacerTop: { flex: 2, minHeight: spacing.md },
  orSpacerBottom: { flex: 1, minHeight: spacing.sm },
  bottomSpacer: { flex: 1, minHeight: spacing.md },
  centerInner: { alignItems: 'center', justifyContent: 'center' },
  // Tier 1 — brand eyebrow at the very top, strongest presence.
  // Text shadows removed site-wide on Start: with the softer gradient,
  // they read as weight/noise rather than separation.
  eyebrow: {
    ...type.overline, color: colors.accent,
    marginBottom: spacing.xs, fontSize: 10, letterSpacing: 3,
  },
  title: {
    ...type.display, color: colors.text,
    fontSize: 24, lineHeight: 30, textAlign: 'center',
  },
  titleTablet: { fontSize: 30, lineHeight: 36 },
  // Subtitle under the contextual title — brand/positioning line.
  subtitle: {
    ...type.caption, color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center', marginTop: 4,
  },
  // Tier 2 — section helpers (New here?, Start with, Intro audios).
  // Sentence-case medium weight (theme's sectionLabel tier) — reserves
  // uppercase overline for true state labels (ROUND 1/3 etc.).
  sectionLabel: {
    ...type.sectionLabel, color: colors.textDim,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  startLabel: { marginBottom: spacing.sm },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.16)' },
  // Tier 3 — connectors between row groups ("or", "Replay quick
  // meditation"). Matches the same label grammar as sectionLabel.
  orLabel: {
    ...type.sectionLabel, color: colors.textDim,
  },
  sectionLabelTablet: { fontSize: 13, letterSpacing: 0.5 },

  radioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  // Two-line pill: duration (primary) stacked above intent (sub-label).
  // Padding and font sizes bumped to meet HIG tap-target / readability.
  // Borderless column pill — selection shown as a 2px accent underline
  // (see radioSelected), no filled background / no outline. Keeps the
  // rhythm of the three options clean and signals "this is a radio"
  // without the heavy chip look.
  radio: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 78,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  radioSelected: {
    borderBottomColor: colors.accent,
  },
  radioDuration: {
    ...type.h2, color: colors.text,
    fontSize: 13, lineHeight: 16, textAlign: 'center',
  },
  radioDurationTablet: { fontSize: 15, lineHeight: 18 },
  radioDurationSelected: { color: colors.accent },
  radioSub: {
    ...type.overline, color: 'rgba(255,255,255,0.72)',
    fontSize: 9, letterSpacing: 0.8, textAlign: 'center',
    marginTop: 2,
  },
  radioSubTablet: { fontSize: 10, letterSpacing: 1 },
  radioSubSelected: { color: colors.accent },
  // Description of the active mode — the "what actually happens when I
  // tap play" line. Centred, capped to 2 lines.
  descLine: {
    ...type.caption, color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center', marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },

  // Phase A — unpacked intro audio list.
  // Borderless + background-less list: a thin hairline between rows
  // gives enough structure (iOS-style inset list) without the weight
  // of 4 bordered cards stacking on top of a soft gradient.
  introList: { gap: 0 },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.09)',
  },
  introRowTitle: {
    ...type.h2, color: colors.text,
    fontSize: 14, flex: 1,
  },
  introRowMeta: {
    ...type.overline, color: colors.textDim,
    fontSize: 10, letterSpacing: 0.6,
  },
  introRowChevron: { ...type.display, fontSize: 14, color: colors.textDim, marginLeft: 2 },

  // Phase B / C — compact intro list (collapsible).
  introListCompact: { gap: 4, marginTop: 4 },
  introRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0, 8, 35, 0.35)',
  },
  introRowTitleCompact: {
    ...type.caption, color: colors.text,
    fontSize: 12, flex: 1,
  },

  // Phase C — program CTAs
  programsWrap: { gap: spacing.md },
  programCta: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 4,
    alignItems: 'center',
  },
  programCtaSM: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(158,54,148,0.10)',
  },
  programCtaQM: {
    borderColor: colors.accentAlt,
    backgroundColor: 'rgba(32,120,108,0.10)',
  },
  programEyebrow: { ...type.overline, color: colors.accent, fontSize: 10, letterSpacing: 2.5 },
  programTitle: { ...type.h2, color: colors.text, fontSize: 18, textAlign: 'center' },
  programHint: { ...type.caption, color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  // Phase C — revisit row of mini pills.
  revisitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  miniPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  miniPillLabel: {
    ...type.overline, color: colors.textMuted,
    fontSize: 10, letterSpacing: 0.8,
  },
});
