import { useRef, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { AnimatedGradient } from '../../src/components/AnimatedGradient';
import { BigPlayButton, type BigPlayMode } from '../../src/components/BigPlayButton';
import { VoletCard } from '../../src/components/VoletCard';
import { startJourneySteps, silentMindVolets } from '../../src/content/catalog';
import { usePlayerStore } from '../../src/player/store';
import { useProgress } from '../../src/player/progressStore';
import { colors, radius, spacing, type } from '../../src/theme';

type ModeKey = 'step-1min' | 'step-3min' | 'step-qm3';

const MODES: {
  key: ModeKey;
  big: BigPlayMode;
  /** Short label used on the radio row */
  short: string;
  /** Full label shown inside the big play button */
  playLabel: string;
  playLabelDone: string;
  duration: string;
}[] = [
  {
    key: 'step-1min', big: 'one',
    short: 'first practice',
    playLabel: '60s',
    playLabelDone: '60s',
    duration: '1 min',
  },
  {
    key: 'step-3min', big: 'three',
    short: 'go deeper',
    playLabel: '3min',
    playLabelDone: '3min',
    duration: '3 min',
  },
  {
    key: 'step-qm3', big: 'qm3',
    short: 'QM format',
    playLabel: '3x3min',
    playLabelDone: '3x3min',
    duration: '11 min',
  },
];

export default function StartScreen() {
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const listened = useProgress(s => s.listened);
  const { height } = useWindowDimensions();
  // Smaller play control so the full Start layout fits in one page without
  // scrolling. With the 'Start with' label + radios now sharing the lower
  // block, the play button had to give up more height — clamp 140-190.
  const playSize = Math.max(140, Math.min(190, Math.round(height / 5)));

  // Smart default: pick the first step the user hasn't listened to yet, so
  // reopening the home surfaces the next natural step. Falls back to 1 min.
  const defaultMode: ModeKey = useMemo(() => {
    for (const s of startJourneySteps) {
      if (s.track && !listened[s.track.id]) return s.id as ModeKey;
    }
    return 'step-1min';
  }, [listened]);
  const [mode, setMode] = useState<ModeKey>(defaultMode);

  const cfg = MODES.find(m => m.key === mode)!;
  const step = startJourneySteps.find(s => s.id === cfg.key);
  const track = step?.track;
  const isDone = !!(track && listened[track.id]);

  const onPlay = () => {
    if (!track) return;
    const pl = startJourneySteps.map(s => s.track).filter(Boolean) as any;
    // Intent is unambiguous here — the user just tapped the big play
    // button. Skip the pre-play screen and go straight to playback.
    openPlayer(track, pl, { autoStart: true });
  };

  const allDone = startJourneySteps.every(s => s.track && listened[s.track.id]);

  const introVolet = silentMindVolets.find(v => v.id === 'intro');

  // Measure where the play button sits so the radial gradient centres on
  // it rather than on the viewport midpoint. onLayout on the play block
  // gives its y/height inside the content box; dividing by the content
  // height gives the 0..1 ratio the gradient expects.
  const [playCenterY, setPlayCenterY] = useState(0.6);
  const contentHeight = useRef(0);
  const playBlockLayout = useRef({ y: 0, height: 0 });
  const recompute = () => {
    const h = contentHeight.current;
    const { y, height } = playBlockLayout.current;
    if (h > 0 && height > 0) {
      setPlayCenterY(Math.max(0, Math.min(1, (y + height / 2) / h)));
    }
  };
  const onContentLayout = (e: LayoutChangeEvent) => {
    contentHeight.current = e.nativeEvent.layout.height;
    recompute();
  };
  const onPlayLayout = (e: LayoutChangeEvent) => {
    playBlockLayout.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
    recompute();
  };

  return (
    <View style={styles.root}>
      <SwipeTabs current="index">
        <AnimatedGradient centerY={playCenterY}>
          <View style={styles.content} onLayout={onContentLayout}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>MEDITATION · STEP BY STEP</Text>
              <Text style={styles.title}>To the Silent Mind</Text>
            </View>

            {introVolet ? (
              <View style={styles.block}>
                <Text style={styles.sectionLabel}>What you will find on this app</Text>
                {/* VoletCard carries its own horizontal margin that assumes
                    it lives inside a padded scroll view — cancel the extra
                    inset here so it lines up flush with the rest. */}
                <View style={{ marginHorizontal: -spacing.lg }}>
                  <VoletCard
                    volet={introVolet}
                    basePath="/silent-mind"
                    accent={colors.accent}
                    accentRgb="158,54,148"
                    elevated
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orLabel}>or</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.startBlock} onLayout={onPlayLayout}>
              <Text style={[styles.sectionLabel, styles.startLabel]}>Start with</Text>

              <View style={styles.radioRow}>
                {MODES.map(m => {
                  const selected = m.key === mode;
                  const done = (() => {
                    const s = startJourneySteps.find(s => s.id === m.key);
                    return !!(s?.track && listened[s.track.id]);
                  })();
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setMode(m.key)}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.radio,
                        selected && styles.radioSelected,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>
                        {m.short}{done ? ' ✓' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.centerInner}>
                <BigPlayButton
                  mode={cfg.big}
                  label={cfg.playLabel}
                  size={playSize}
                  onPress={onPlay}
                />
              </View>
            </View>

            {allDone ? (
              <Pressable
                onPress={() => router.push('/silent-mind')}
                style={({ pressed }) => [styles.explore, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.exploreEyebrow}>READY FOR MORE ?</Text>
                <Text style={styles.exploreTitle}>Explore the Silent Mind Program →</Text>
              </Pressable>
            ) : null}
          </View>
        </AnimatedGradient>
      </SwipeTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // No scrolling on Start — every block competes for height via flex, and
  // the middle 'center' slot takes whatever's left over.
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Fixed-height top block so the title lands at the same level as the
  // hero-positioned titles on Silent Mind / QM / About tabs (hero height
  // 150, title bottom-aligned). Extra marginBottom pushes the intro
  // section a bit further below the title for breathing room.
  header: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
    marginBottom: spacing.lg,
  },
  // Intro block shrinks to its natural size so the 'or' divider sits
  // right under the card — no wasted air above it. The start block
  // below still flex-grows to fill the remaining viewport.
  block: { justifyContent: 'center' },
  startBlock: { flex: 1, justifyContent: 'center' },
  centerInner: { alignItems: 'center', justifyContent: 'center' },
  sectionLabel: {
    ...type.overline, color: colors.textMuted,
    fontSize: 10, letterSpacing: 2, textAlign: 'center',
    marginBottom: spacing.md,
  },
  // Extra margin above the 'Start with' label so the OR divider has
  // breathing room rather than kissing the label under it.
  startLabel: { marginBottom: spacing.sm },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.16)' },
  orLabel: { ...type.overline, color: colors.textMuted, fontSize: 10, letterSpacing: 2 },
  eyebrow: {
    ...type.overline, color: colors.accent,
    marginBottom: spacing.xs, fontSize: 10, letterSpacing: 3,
  },
  title: {
    ...type.display, color: colors.text,
    fontSize: 22, lineHeight: 28, textAlign: 'center',
  },

  radioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  // Outlined pill instead of a filled dot. Unselected → thin white
  // outline + muted text. Selected → accent outline + accent text.
  radio: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.40)',
    backgroundColor: 'transparent',
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioLabel: {
    ...type.overline, fontSize: 10, letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.70)', textAlign: 'center',
  },
  radioLabelSelected: { color: colors.accent },

  explore: {
    marginTop: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 2,
  },
  exploreEyebrow: { ...type.overline, color: colors.accent, fontSize: 9 },
  exploreTitle: { ...type.h2, color: colors.text, fontSize: 13, textAlign: 'center' },
});
