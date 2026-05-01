import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import { BouncyScrollView as ScrollView } from '../src/components/BouncyScrollView';
import { Background } from '../src/components/Background';
import { BackButton } from '../src/components/BackButton';
import { ProgramHeader } from '../src/components/ProgramHeader';
import { CircleButton } from '../src/components/CircleButton';
import { useLayout } from '../src/hooks/useLayout';
import { qmProgram } from '../src/content/catalog';
import { colors, radius, spacing, type } from '../src/theme';

// Picker presets — the three knobs the user can twist before starting
// a free-training session. Values in *seconds* internally so the timer
// math is uniform; the UI labels translate back to "1 min / 3 min /
// 5 min" etc. for readability.
const ROUND_OPTIONS: { rounds: number }[] = [
  { rounds: 3 },
  { rounds: 6 },
  { rounds: 12 },
];
const LENGTH_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 1, label: '1 min' },
  { minutes: 3, label: '3 min' },
  { minutes: 5, label: '5 min' },
];
const BREAK_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 15, label: '15 s' },
  { seconds: 30, label: '30 s' },
  { seconds: 60, label: '1 min' },
];

// Pre-round countdown — plays a short visual + audio cue before
// every round so the practitioner has a beat to settle in. Shared
// between the initial start and inter-round transitions.
const PRE_ROUND_SECONDS = 3;

// Audio cues — bundled at build time. Each one is loaded into its own
// dedicated expo-audio instance that we reuse across the whole session
// (every round / break / countdown boundary just calls
// `seekTo(0); .play()` on the matching player). Two separate instances
// so a fast countdown tick can't preempt the bell mid-decay and vice
// versa.
const BELL_SOURCE = require('../assets/audio/bell_short.mp3');
const TICK_SOURCE = require('../assets/audio/tick.mp3');

const fmtMMSS = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

type Phase = 'config' | 'countdown' | 'round' | 'break' | 'done';

export default function QMTrainingScreen() {
  const router = useRouter();
  const { columnMax } = useLayout();
  const insets = useSafeAreaInsets();

  // Single bell + single tick instances, reused for every cue.
  // `replace` semantics aren't needed — seekTo(0) before play()
  // restarts the sample whether it was idle or mid-decay.
  const bellPlayer = useAudioPlayer(BELL_SOURCE);
  const tickPlayer = useAudioPlayer(TICK_SOURCE);
  const playBell = () => {
    try {
      bellPlayer.seekTo(0);
      bellPlayer.play();
    } catch {
      // Silent fallback — a missed bell shouldn't break the timer.
    }
  };
  const playTick = () => {
    try {
      tickPlayer.seekTo(0);
      tickPlayer.play();
    } catch {
      // Silent fallback — see playBell.
    }
  };

  // ---- config (the three pickers) ----------------------------------
  const [roundsCount, setRoundsCount] = useState<number>(6);
  const [roundLengthMin, setRoundLengthMin] = useState<number>(3);
  const [breakSeconds, setBreakSeconds] = useState<number>(60);

  // ---- session state ----------------------------------------------
  const [phase, setPhase] = useState<Phase>('config');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [elapsed, setElapsed] = useState<number>(0); // seconds in the current round / break
  const [paused, setPaused] = useState<boolean>(false);

  // Convert config to seconds so the timer math is uniform.
  const roundSeconds = roundLengthMin * 60;
  const phaseDuration =
    phase === 'break' ? breakSeconds
    : phase === 'countdown' ? PRE_ROUND_SECONDS
    : roundSeconds;
  const remaining = Math.max(0, phaseDuration - elapsed);
  // Whole-second tick of the countdown — used both for the visible
  // big number ("3" → "2" → "1" → "GO") and for firing the audio
  // tick once per second instead of every animation frame.
  const countdownInt = Math.max(1, Math.ceil(remaining));

  // Timer — tick every 250 ms when not paused. We avoid 1 Hz so the
  // displayed countdown updates immediately on play / pause without
  // waiting up to a full second for the next tick.
  const lastTickRef = useRef<number>(0);
  useEffect(() => {
    if (phase !== 'round' && phase !== 'break' && phase !== 'countdown') return;
    if (paused) return;
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setElapsed(prev => prev + delta);
    }, 250);
    return () => clearInterval(id);
  }, [phase, paused]);

  // Per-second audio cue during the countdown — we want exactly one
  // bell tap at each "3 / 2 / 1" mark, not 4 taps from the 250 ms
  // ticker. Track the last whole second we sounded and only fire when
  // it changes.
  const lastTickSecondRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'countdown') {
      lastTickSecondRef.current = null;
      return;
    }
    if (countdownInt !== lastTickSecondRef.current) {
      lastTickSecondRef.current = countdownInt;
      // Tick on each "3 / 2 / 1" beat — short, distinct from the bell
      // so the countdown reads as "get ready" rather than "round
      // boundary". The full bell fires at the moment the countdown
      // hits zero (see the phase transition below).
      playTick();
    }
  }, [phase, countdownInt]);

  // Phase transitions — when elapsed catches up to phaseDuration:
  //   countdown → round (start of round, full bell)
  //   round     → break (or done if last round)
  //   round     → countdown for the next round if no break
  //   break     → countdown for the next round
  useEffect(() => {
    if (phase !== 'round' && phase !== 'break' && phase !== 'countdown') return;
    if (elapsed < phaseDuration) return;
    if (phase === 'countdown') {
      // Start of round: full bell + flip to the round phase.
      playBell();
      setPhase('round');
      setElapsed(0);
      return;
    }
    playBell();
    if (phase === 'round') {
      const isLastRound = currentRound >= roundsCount;
      if (isLastRound) {
        setPhase('done');
        return;
      }
      setPhase('break');
      setElapsed(0);
    } else if (phase === 'break') {
      setCurrentRound(c => c + 1);
      setPhase('countdown');
      setElapsed(0);
    }
  }, [elapsed, phase, phaseDuration, currentRound, roundsCount]);

  // ---- handlers ----------------------------------------------------
  const startSession = () => {
    setCurrentRound(1);
    setElapsed(0);
    setPaused(false);
    setPhase('countdown');
    // No bell here — the per-second cue inside the countdown effect
    // covers the "3 / 2 / 1" beats and a final bell fires when the
    // round phase begins.
  };
  const skipPhase = () => {
    // Manual "end round / skip break / start now" — does the same
    // phase transition as a natural timer-end, but WITHOUT firing the
    // bell. A user-initiated skip is silent on purpose: the bell is
    // there to mark the round naturally completing, not every flip
    // through the state machine.
    if (phase === 'countdown') {
      setPhase('round');
      setElapsed(0);
      return;
    }
    if (phase === 'round') {
      const isLastRound = currentRound >= roundsCount;
      if (isLastRound) {
        setPhase('done');
        return;
      }
      setPhase('break');
      setElapsed(0);
      return;
    }
    if (phase === 'break') {
      setCurrentRound(c => c + 1);
      setPhase('countdown');
      setElapsed(0);
    }
  };
  const closeSession = () => {
    setPhase('config');
    setElapsed(0);
    setCurrentRound(1);
  };

  // ---- render branches --------------------------------------------
  if (phase === 'config') {
    return (
      <Background color={colors.bgTabAlt}>
        <Stack.Screen options={{ title: '' }} />
        <BackButton />
          <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center', paddingTop: insets.top }]}>
            <View style={[styles.column, { maxWidth: columnMax }]}>
              <ProgramHeader
                eyebrow={qmProgram.eyebrow}
                title="Free Training"
                description="Set up a self-guided session — timed rounds with bell cues, no spoken guidance."
                accent={colors.accentAlt}
              />

              {/* Three picker rows. Each row is a label + segmented
                  buttons; selected button gets the QM accent fill. */}
              <View style={styles.pickerBlock}>
                <Text style={styles.pickerLabel}>Rounds</Text>
                <View style={styles.pickerRow}>
                  {ROUND_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.rounds}
                      onPress={() => setRoundsCount(opt.rounds)}
                      style={({ pressed }) => [
                        styles.pickerCell,
                        roundsCount === opt.rounds && styles.pickerCellSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerCellText,
                          roundsCount === opt.rounds && styles.pickerCellTextSelected,
                        ]}
                      >
                        {opt.rounds}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.pickerLabel}>Round length</Text>
                <View style={styles.pickerRow}>
                  {LENGTH_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.minutes}
                      onPress={() => setRoundLengthMin(opt.minutes)}
                      style={({ pressed }) => [
                        styles.pickerCell,
                        roundLengthMin === opt.minutes && styles.pickerCellSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerCellText,
                          roundLengthMin === opt.minutes && styles.pickerCellTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.pickerLabel}>Break between rounds</Text>
                <View style={styles.pickerRow}>
                  {BREAK_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.seconds}
                      onPress={() => setBreakSeconds(opt.seconds)}
                      style={({ pressed }) => [
                        styles.pickerCell,
                        breakSeconds === opt.seconds && styles.pickerCellSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerCellText,
                          breakSeconds === opt.seconds && styles.pickerCellTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Total session preview, then the launch button. */}
              <Text style={styles.totalLine}>
                {roundsCount} × {roundLengthMin} min · break {breakSeconds < 60 ? `${breakSeconds}s` : `${Math.round(breakSeconds / 60)} min`}
              </Text>

              <View style={styles.launchRow}>
                <CircleButton
                  mode="pre"
                  size={120}
                  accent={colors.accentAlt}
                  onPress={startSession}
                />
              </View>
              <Text style={styles.launchHint}>Start when you are ready</Text>
            </View>
          </ScrollView>
      </Background>
    );
  }

  // -- session in progress: round / break / done --
  return (
    <Background color={colors.bgTabAlt}>
      <Stack.Screen options={{ title: '' }} />
      <BackButton />
        <View style={[styles.content, { alignItems: 'center', paddingTop: insets.top }]}>
          <View style={[styles.column, { maxWidth: columnMax, alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
            {/* Round / break / countdown label — same grammar as the
                audio Player's round bar so the session reads as a
                sibling experience. */}
            <Text style={[styles.roundBarText, { color: colors.accentAlt }, phase === 'break' && styles.roundBarBreak]}>
              {phase === 'done'
                ? 'SESSION COMPLETE'
                : phase === 'countdown'
                  ? `· STARTING · round ${currentRound} of ${roundsCount} ·`
                  : phase === 'break'
                    ? `· BREAK · between round ${currentRound} and ${currentRound + 1} ·`
                    : `ROUND ${currentRound} / ${roundsCount}`}
            </Text>

            {/* Round dot indicator — one dot per planned round, lit by
                progress so far. */}
            {phase !== 'done' ? (
              <View style={styles.dotsRow}>
                {Array.from({ length: roundsCount }, (_, i) => {
                  const state = i + 1 < currentRound ? 'done' : i + 1 === currentRound ? 'current' : 'upcoming';
                  return (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        state === 'done' && styles.dotDone,
                        state === 'current' && [styles.dotCurrent, { backgroundColor: colors.accentAlt }],
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}

            {/* Big number — during the 3-2-1 countdown shows the
                whole-second tick (visual cue paired with the per-tick
                bell), otherwise the mm:ss remaining for the round /
                break / done state. The single number is the focal
                point of the session — nothing else for the eyes to
                wander to. */}
            <View style={styles.timerSlot}>
              <Text style={[styles.timer, phase === 'countdown' && styles.timerCountdown]}>
                {phase === 'done'
                  ? '0:00'
                  : phase === 'countdown'
                    ? String(countdownInt)
                    : fmtMMSS(remaining)}
              </Text>
              <Text style={styles.timerSub}>
                {phase === 'done'
                  ? `${roundsCount} × ${roundLengthMin} min completed`
                  : phase === 'countdown'
                    ? 'get ready…'
                    : phase === 'break'
                      ? 'breathing break'
                      : `${roundLengthMin} min round`}
              </Text>
            </View>

            {/* Controls — vertical stack so the play button is on the
                column's optical centre with the secondary actions
                directly below. Order top → bottom: play/pause →
                end-round → exit-training. */}
            {phase !== 'done' ? (
              <View style={styles.controlsStack}>
                <CircleButton
                  mode={paused ? 'paused' : 'playing'}
                  size={104}
                  accent={colors.accentAlt}
                  onPress={() => setPaused(p => !p)}
                />
                <Pressable onPress={skipPhase} hitSlop={10} style={styles.skipBtn}>
                  <Text style={[styles.skipBtnText, { color: colors.accentAlt }]}>
                    {phase === 'break'
                      ? 'Skip break →'
                      : phase === 'countdown'
                        ? 'Start now →'
                        : 'End round →'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => router.back()} hitSlop={10} style={styles.exitLink}>
                  <Text style={styles.exitLinkText}>Exit training</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.controlsStack}>
                <Pressable onPress={closeSession} style={styles.donePill}>
                  <Text style={[styles.donePillText, { color: colors.accentAlt }]}>Reset</Text>
                </Pressable>
                <Pressable onPress={() => router.back()} hitSlop={10} style={styles.exitLink}>
                  <Text style={styles.exitLinkText}>Exit training</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, flexGrow: 1 },
  column: { width: '100%', alignSelf: 'center' },

  // ---- config picker ---------------------------------------------
  // Tightened in 78% to fit the whole setup screen (header + 3 pickers
  // + total + launch + hint) within a standard iPhone viewport
  // (375×812 minus safe-area + tab-bar) without scrolling.
  pickerBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  pickerLabel: {
    ...type.sectionLabel,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerCell: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  pickerCellSelected: {
    borderColor: colors.accentAlt,
    backgroundColor: 'rgba(54,160,158,0.18)',
  },
  pickerCellText: {
    ...type.h3,
    color: colors.text,
    fontSize: 14,
  },
  pickerCellTextSelected: {
    color: colors.accentAlt,
  },
  totalLine: {
    ...type.overline,
    color: colors.textDim,
    fontSize: 11,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  launchRow: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  launchHint: {
    ...type.overline,
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // ---- session UI -----------------------------------------------
  roundBarText: {
    ...type.overline,
    fontSize: 11,
    letterSpacing: 1.6,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  roundBarBreak: {
    color: colors.textMuted,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.45)' },
  dotCurrent: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  timerSlot: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  timer: {
    ...type.display,
    color: colors.text,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  // Countdown ticks (3 / 2 / 1) get a slightly larger size + the QM
  // accent colour so the moment feels like its own beat rather than
  // a leftover frame of the round timer.
  timerCountdown: {
    fontSize: 96,
    lineHeight: 100,
    color: colors.accentAlt,
  },
  timerSub: {
    ...type.overline,
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 1.4,
    marginTop: spacing.xs,
  },

  // Vertical control stack — keeps the play circle on the column's
  // optical centre. Secondary actions stack directly below the play
  // button rather than flanking it (the previous flex-row layout had
  // the play circle pushed off-centre by the `End round →` text on
  // one side and an empty placeholder on the other).
  controlsStack: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  skipBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipBtnText: {
    ...type.overline,
    fontSize: 11,
    letterSpacing: 1.4,
  },

  donePill: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentAlt,
  },
  donePillText: {
    ...type.overline,
    fontSize: 11,
    letterSpacing: 1.6,
  },

  exitLink: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  exitLinkText: {
    ...type.caption,
    color: colors.textDim,
  },
});
