import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
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
    short: '60 sec',
    playLabel: 'START WITH 60 SEC',
    playLabelDone: 'LISTEN AGAIN · 60 SEC',
    duration: '1 min',
  },
  {
    key: 'step-3min', big: 'three',
    short: '3 min',
    playLabel: 'CONTINUE WITH 3 MIN',
    playLabelDone: 'LISTEN AGAIN · 3 MIN',
    duration: '3 min',
  },
  {
    key: 'step-qm3', big: 'qm3',
    short: '3 × 3 min',
    playLabel: 'EXPLORE THE QM FORMAT\n3 × 3 MIN',
    playLabelDone: 'LISTEN AGAIN · 3 × 3 MIN',
    duration: '11 min',
  },
];

export default function StartScreen() {
  const router = useRouter();
  const openPlayer = usePlayerStore(s => s.open);
  const listened = useProgress(s => s.listened);
  const { height } = useWindowDimensions();
  // Smaller play control so the full Start layout fits in one page without
  // scrolling (intro card + OR divider + play + radios + optional explore
  // pill). Was roughly h/3, now h/4 with tighter clamps.
  const playSize = Math.max(170, Math.min(230, Math.round(height / 4)));

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

  return (
    <View style={styles.root}>
      <SwipeTabs current="index">
        <AnimatedGradient>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>MEDITATION · STEP BY STEP</Text>
              <Text style={styles.title}>To the Silent Mind</Text>
            </View>

            {introVolet ? (
              <View style={styles.introBlock}>
                <Text style={styles.sectionLabel}>What you will find on this app</Text>
                <VoletCard
                  volet={introVolet}
                  basePath="/silent-mind"
                  accent={colors.accent}
                  accentRgb="158,54,148"
                />
              </View>
            ) : null}

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orLabel}>or</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.center}>
              <BigPlayButton
                mode={cfg.big}
                label={isDone ? cfg.playLabelDone : cfg.playLabel}
                size={playSize}
                onPress={onPlay}
              />
            </View>

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
                    style={styles.radio}
                  >
                    <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
                      {selected ? <View style={styles.radioDotInner} /> : null}
                    </View>
                    <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>
                      {m.short}{done ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                );
              })}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  header: { alignItems: 'center', marginBottom: spacing.sm },
  // Cancel the content's horizontal padding so VoletCard's own margins line
  // up with the Silent Mind / QM screens.
  introBlock: { marginHorizontal: -spacing.lg, marginBottom: spacing.xs },
  sectionLabel: {
    ...type.overline, color: colors.textMuted,
    fontSize: 10, letterSpacing: 2, textAlign: 'center',
    marginBottom: spacing.xs,
  },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
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

  // The center slot flex-grows so the big play button sits between the
  // intro card and the radio row without needing explicit margins. This is
  // also how the page auto-balances on very tall / very short viewports.
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  radio: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  radioDot: {
    width: 14, height: 14, borderRadius: 7,
    borderColor: 'rgba(255,255,255,0.45)', borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDotSelected: { borderColor: colors.accent },
  radioDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  radioLabel: {
    ...type.overline, fontSize: 9, letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.55)', textAlign: 'center',
  },
  radioLabelSelected: { color: colors.text },

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
