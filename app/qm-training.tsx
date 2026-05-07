import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import { Background } from '../src/components/Background';
import { BackButton } from '../src/components/BackButton';
import { ProgramHeader } from '../src/components/ProgramHeader';
import { CircleButton } from '../src/components/CircleButton';
import { useLayout } from '../src/hooks/useLayout';
import { qmProgram } from '../src/content/catalog';
import { useSessionPrefs } from '../src/player/sessionPrefs';
import { getBellSource } from '../src/player/bellRegistry';
import { colors, radius, spacing, type } from '../src/theme';

// Quick-pick presets — formats that mirror the guided QM audios. A user
// who just finished QM3-Breath (7 × 3 min) and wants to repeat it
// silently picks the matching preset; a beginner picks 3 × 3 min for a
// shorter taste. All run with a 1-minute break between rounds, like the
// guided sessions.
type Preset = {
  id: string;
  rounds: number;
  lengthMin: number;
  breakSec: number;
  label: string;
  sub: string;
};
const PRESETS: Preset[] = [
  { id: 'beginner', rounds: 3, lengthMin: 3, breakSec: 60, label: '3 × 3 min', sub: 'A first taste' },
  { id: 'standard', rounds: 5, lengthMin: 3, breakSec: 60, label: '5 × 3 min', sub: 'Standard format' },
  { id: 'qm3-6',    rounds: 6, lengthMin: 3, breakSec: 60, label: '6 × 3 min', sub: 'QM3 — Unfollow & Witness' },
  { id: 'qm3-7',    rounds: 7, lengthMin: 3, breakSec: 60, label: '7 × 3 min', sub: 'QM3 — Breathing Body' },
  { id: 'qm5',      rounds: 5, lengthMin: 5, breakSec: 60, label: '5 × 5 min', sub: 'QM5 — Center of Gravity' },
];

// Custom-format modal pickers — the three knobs the user can twist when
// none of the presets fit. Values in *seconds* internally so the timer
// math is uniform; UI labels translate back to "1 min / 3 min" etc.
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

// Audio cues — the tick is hard-coded (only one variant), but the
// bell is user-selectable via Session Sounds in Settings. The tick
// player loads its sample once; the bell player rebinds whenever the
// user picks a new variant (or "None"), via `replace` on the same
// instance. Two separate instances so a fast countdown tick can't
// preempt the bell mid-decay and vice versa.
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
  const { columnMax, playSize, playCenterY } = useLayout();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  // TOP_FLEX drives the flex spacer above the play circle so content
  // above (header / timer) and below (controls) straddle the button
  // at its fixed playCenterY without overlap.
  const usableH = Math.max(360, winH - insets.top - insets.bottom);
  const gapTop = playCenterY - insets.top - playSize / 2;
  const TOP_FLEX = Math.max(0.1, gapTop) / Math.max(1, usableH - playSize - gapTop);
  const BOTTOM_FLEX = 1;

  // User-selected bell variant from Session Sounds. `null` means the
  // user picked "None" — every `playBell()` becomes a no-op. We bind
  // an audio instance to whichever sample is currently selected and
  // re-replace when the id changes.
  const bellSoundId = useSessionPrefs(s => s.bellSoundId);
  const bellSource = useMemo(() => getBellSource(bellSoundId), [bellSoundId]);
  // expo-audio doesn't accept `null` as initial source — pass a tiny
  // dummy and swallow the play() when the user picked None.
  const bellPlayer = useAudioPlayer(bellSource ?? TICK_SOURCE);
  const tickPlayer = useAudioPlayer(TICK_SOURCE);
  const playBell = () => {
    if (!bellSource) return; // 'none' selected — silent.
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

  // ---- config: a preset OR a custom triple --------------------------
  // Default = the "Standard format" preset (5 × 3 min) — friendliest
  // entry point for someone landing on this screen for the first time.
  const [roundsCount, setRoundsCount] = useState<number>(5);
  const [roundLengthMin, setRoundLengthMin] = useState<number>(3);
  const [breakSeconds, setBreakSeconds] = useState<number>(60);
  // Custom-format modal state. Open it from "Custom format…", commit
  // its picks via Apply (which updates the three values above + closes).
  const [customOpen, setCustomOpen] = useState<boolean>(false);
  // Modal-local copies so the user can twiddle without affecting the
  // outer state until they hit Apply (or dismiss to discard).
  const [draftRounds, setDraftRounds] = useState<number>(roundsCount);
  const [draftLength, setDraftLength] = useState<number>(roundLengthMin);
  const [draftBreak, setDraftBreak] = useState<number>(breakSeconds);

  // Identify which preset (if any) matches the current triple — drives
  // the selected styling in the preset grid. Custom-format selections
  // simply leave nothing highlighted.
  const matchedPresetId =
    PRESETS.find(
      p => p.rounds === roundsCount && p.lengthMin === roundLengthMin && p.breakSec === breakSeconds,
    )?.id ?? null;

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

  // Last 3 seconds of break = the "3 / 2 / 1" countdown beeps. We
  // detect this in-band (no separate phase anymore) so the visual +
  // audio cue rides on top of the existing break timer rather than
  // adding a third state. `inBreakCountdown` is the source of truth
  // for both audio (tick) and visual (big number) below.
  const inBreakCountdown =
    phase === 'break' && remaining > 0 && remaining <= PRE_ROUND_SECONDS;

  // Per-second audio cue during the lead-in (initial countdown phase
  // before round 1, or the last 3 s of every break). One tick at each
  // "3 / 2 / 1" mark, not 4 taps from the 250 ms ticker — we track the
  // last whole second we sounded and only fire when it changes.
  const lastTickSecondRef = useRef<number | null>(null);
  useEffect(() => {
    const isInCountdown = phase === 'countdown' || inBreakCountdown;
    if (!isInCountdown) {
      lastTickSecondRef.current = null;
      return;
    }
    if (countdownInt !== lastTickSecondRef.current) {
      lastTickSecondRef.current = countdownInt;
      // Tick on each "3 / 2 / 1" beat — short, distinct from the bell
      // so the countdown reads as "get ready" rather than "round
      // boundary". The full bell fires when the round actually starts.
      playTick();
    }
  }, [phase, countdownInt, inBreakCountdown]);

  // Phase transitions — when elapsed catches up to phaseDuration:
  //   countdown → round (initial start, full bell)
  //   round     → break (or done if last round)
  //   break     → round directly (no separate countdown phase; the
  //               last 3 s of the break carry the 3-2-1 ticks above)
  useEffect(() => {
    if (phase !== 'round' && phase !== 'break' && phase !== 'countdown') return;
    if (elapsed < phaseDuration) return;
    if (phase === 'countdown') {
      // Initial lead-in finished: full bell + start round 1.
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
      // Break done → straight to next round (countdown ticks already
      // played in-band during the last 3 seconds).
      setCurrentRound(c => c + 1);
      setPhase('round');
      setElapsed(0);
    }
  }, [elapsed, phase, phaseDuration, currentRound, roundsCount]);

  // ---- handlers ----------------------------------------------------
  const startSession = () => {
    setCurrentRound(1);
    setElapsed(0);
    setPaused(false);
    // Drop straight into round 1 with the bell — the 3-2-1 ticks are
    // only used to bridge breaks back to the next round, not at the
    // initial start (the user already tapped play).
    playBell();
    setPhase('round');
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
      setPhase('round');
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
          <View style={[styles.content, { alignItems: 'center', paddingTop: insets.top, flex: 1 }]}>
            <View style={[styles.column, { maxWidth: columnMax, flex: 1 }]}>
              {/* Top region — header anchored to top, total line
                  pushed to the bottom so it sits right above the
                  play circle. Flex 1.7 / 1 ratio matches Start. */}
              <View style={{ flex: TOP_FLEX, alignItems: 'center' }}>
                <ProgramHeader
                  eyebrow={qmProgram.eyebrow}
                  title="Self-guided training"
                  description="Pick a format matching one of our QM sessions, or set up your own. Bell cues only — no spoken guidance."
                  accent={colors.accentAlt}
                />
                <View style={{ flex: 1 }} />
                <Text style={styles.totalLine}>
                  {roundsCount} × {roundLengthMin} min · break {breakSeconds < 60 ? `${breakSeconds}s` : `${Math.round(breakSeconds / 60)} min`}
                </Text>
              </View>

              {/* Spacer reserves the play circle's vertical
                  footprint; the actual button is rendered absolutely
                  below so it lines up with the in-session play. */}
              <View style={{ height: playSize }} />

              {/* Bottom region — presets fill the available space
                  starting just below the play. */}
              <View style={{ flex: 1, alignItems: 'center', width: '100%' }}>
                <View style={{ flex: 1 }} />
                <View style={styles.presetBlock}>
                <Text style={styles.pickerLabel}>Choose a format</Text>
                <View style={styles.presetGrid}>
                  {PRESETS.map(p => {
                    const selected = matchedPresetId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setRoundsCount(p.rounds);
                          setRoundLengthMin(p.lengthMin);
                          setBreakSeconds(p.breakSec);
                        }}
                        style={({ pressed }) => [
                          styles.presetCell,
                          selected && styles.presetCellSelected,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetCellLabel,
                            selected && styles.presetCellLabelSelected,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => {
                      setDraftRounds(roundsCount);
                      setDraftLength(roundLengthMin);
                      setDraftBreak(breakSeconds);
                      setCustomOpen(true);
                    }}
                    style={({ pressed }) => [
                      styles.presetCell,
                      styles.customCell,
                      matchedPresetId === null && styles.presetCellSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetCellLabel,
                        matchedPresetId === null && styles.presetCellLabelSelected,
                      ]}
                    >
                      Custom…
                    </Text>
                  </Pressable>
                </View>
                </View>
              </View>
            </View>
          </View>

          {/* Pre-play CircleButton — pinned absolutely so its centre
              sits at exactly playCenterY, identical to the in-session
              play position rendered later. */}
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, top: playCenterY - playSize / 2, alignItems: 'center' }}
          >
            <CircleButton
              mode="pre"
              size={playSize}
              accent={colors.accentAlt}
              onPress={startSession}
            />
          </View>

          {/* Custom-format modal — three picker rows, mirrored from the
              previous inline layout. Apply commits to the outer state
              and closes; the dim backdrop dismisses without committing. */}
          <Modal visible={customOpen} transparent animationType="slide" onRequestClose={() => setCustomOpen(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setCustomOpen(false)}>
              <Pressable style={styles.modalSheet} onPress={() => { /* swallow taps inside the sheet */ }}>
                <Text style={styles.modalTitle}>Custom format</Text>

                <Text style={styles.pickerLabel}>Rounds</Text>
                <View style={styles.pickerRow}>
                  {ROUND_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.rounds}
                      onPress={() => setDraftRounds(opt.rounds)}
                      style={({ pressed }) => [
                        styles.pickerCell,
                        draftRounds === opt.rounds && styles.pickerCellSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={[styles.pickerCellText, draftRounds === opt.rounds && styles.pickerCellTextSelected]}>
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
                      onPress={() => setDraftLength(opt.minutes)}
                      style={({ pressed }) => [
                        styles.pickerCell,
                        draftLength === opt.minutes && styles.pickerCellSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={[styles.pickerCellText, draftLength === opt.minutes && styles.pickerCellTextSelected]}>
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
                      onPress={() => setDraftBreak(opt.seconds)}
                      style={({ pressed }) => [
                        styles.pickerCell,
                        draftBreak === opt.seconds && styles.pickerCellSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={[styles.pickerCellText, draftBreak === opt.seconds && styles.pickerCellTextSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setCustomOpen(false)}
                    style={({ pressed }) => [styles.modalCancel, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      // Commit drafts + close modal + kick off the session.
                      // `startSession` only flips `phase` to 'countdown';
                      // the timer's phaseDuration calc reads the freshly
                      // committed config values on the next render.
                      setRoundsCount(draftRounds);
                      setRoundLengthMin(draftLength);
                      setBreakSeconds(draftBreak);
                      setCustomOpen(false);
                      startSession();
                    }}
                    style={({ pressed }) => [styles.modalApply, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={[styles.modalApplyText, { color: colors.accentAlt }]}>▶  Start</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
      </Background>
    );
  }

  // -- session in progress: round / break / done --
  return (
    <Background color={colors.bgTabAlt}>
      <Stack.Screen options={{ title: '' }} />
      <BackButton />
        <View style={[styles.content, { alignItems: 'center', paddingTop: insets.top }]}>
          <View style={[styles.column, { maxWidth: columnMax, alignItems: 'center', flex: 1 }]}>
            {/* Top region — round label + dots anchored at top, timer
                pushed to bottom so it sits right above the play. Flex
                1.7 / 1 ratio matches Start. */}
            <View style={{ flex: TOP_FLEX, alignItems: 'center', width: '100%' }}>
              <Text style={[styles.roundBarText, { color: colors.accentAlt }, phase === 'break' && styles.roundBarBreak]}>
                {phase === 'done'
                  ? 'SESSION COMPLETE'
                  : phase === 'countdown'
                    ? `· STARTING · round ${currentRound} of ${roundsCount} ·`
                    : phase === 'break'
                      ? `· BREAK · between round ${currentRound} and ${currentRound + 1} ·`
                      : `ROUND ${currentRound} / ${roundsCount}`}
              </Text>

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

              <View style={{ flex: 1 }} />

              <View style={styles.timerSlot}>
                <Text style={[
                  styles.timer,
                  (phase === 'countdown' || inBreakCountdown) && styles.timerCountdown,
                ]}>
                  {phase === 'done'
                    ? '0:00'
                    : phase === 'countdown' || inBreakCountdown
                      ? String(countdownInt)
                      : fmtMMSS(remaining)}
                </Text>
                <Text style={styles.timerSub}>
                  {phase === 'done'
                    ? `${roundsCount} × ${roundLengthMin} min completed`
                    : phase === 'countdown'
                      ? 'get ready…'
                      : inBreakCountdown
                        ? 'next round in…'
                        : phase === 'break'
                          ? 'breathing break'
                          : `${roundLengthMin} min round`}
                </Text>
              </View>
            </View>

            {/* Spacer reserves the play circle's footprint; the
                actual button is rendered absolutely below so it sits
                at the same Y as the pre-play. */}
            <View style={{ height: playSize }} />

            {/* Bottom region — skip / exit links sit just below the
                play, then breathing room before the screen edge. */}
            <View style={{ flex: 1, alignItems: 'center', width: '100%' }}>
            {phase !== 'done' ? (
              <View style={styles.controlsStack}>
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
        </View>
        {/* In-session CircleButton — pinned at the same playCenterY
            as the pre-play CircleButton above. */}
        {phase !== 'done' ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, top: playCenterY - playSize / 2, alignItems: 'center' }}
          >
            <CircleButton
              mode={paused ? 'paused' : 'playing'}
              size={playSize}
              accent={colors.accentAlt}
              onPress={() => setPaused(p => !p)}
            />
          </View>
        ) : null}
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, flexGrow: 1 },
  column: { width: '100%', alignSelf: 'center' },

  // ---- preset grid + custom button -------------------------------
  presetBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  presetCell: {
    // Two columns with a small gap — uses calc-style flex-basis so two
    // cards fit per row at iPhone width and gracefully fall back to one
    // column on very narrow viewports.
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    gap: 2,
  },
  presetCellSelected: {
    borderColor: colors.accentAlt,
    backgroundColor: 'rgba(54,160,158,0.18)',
  },
  presetCellLabel: {
    ...type.h3,
    color: colors.text,
    fontSize: 15,
  },
  presetCellLabelSelected: {
    color: colors.accentAlt,
  },
  // The Custom card sits inside the same grid as the presets (it's
  // just another option). Marked subtly with a dashed border so the
  // user reads it as "open editor" rather than "use this preset".
  customCell: {
    borderStyle: 'dashed',
  },

  // ---- custom-format modal ---------------------------------------
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#091226',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: spacing.xs,
    // Don't set alignItems here — pickerRow needs to fill the sheet
    // width so its `flex: 1` cells size correctly. We center each
    // item via per-style textAlign / justifyContent instead.
  },
  modalTitle: {
    ...type.h3,
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  // Centered button row — Cancel + Apply share the column's
  // optical centre so the whole modal reads as one stacked column.
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalCancelText: {
    ...type.overline,
    color: colors.textDim,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  modalApply: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentAlt,
  },
  modalApplyText: {
    ...type.overline,
    fontSize: 11,
    letterSpacing: 1.6,
  },

  // ---- legacy picker styles (now used inside the modal) ----------
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
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  pickerCell: {
    flex: 1,
    maxWidth: 110,
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

  // ---- bell radio ------------------------------------------------
  bellGroup: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  radioCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  radioDotSelected: {
    borderColor: colors.accentAlt,
    backgroundColor: colors.accentAlt,
  },
  radioLabel: {
    ...type.body,
    color: colors.textDim,
    fontSize: 13,
  },
  radioLabelSelected: {
    color: colors.accentAlt,
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
