import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import { Background } from '../../src/components/Background';
import { SwipeTabs } from '../../src/components/SwipeTabs';
import { ProgramHeader } from '../../src/components/ProgramHeader';
import { CircleButton } from '../../src/components/CircleButton';
import { useLayout } from '../../src/hooks/useLayout';
import { qmProgram, silentMindVolets, trackDuration, type AudioTrack } from '../../src/content/catalog';
import { useSessionPrefs } from '../../src/player/sessionPrefs';
import { useProgress, isTrackUnlocked } from '../../src/player/progressStore';
import { usePlayerStore } from '../../src/player/store';
import { getBellSource } from '../../src/player/bellRegistry';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * QM tab — refactored from a list of program parts into a direct
 * Quantified Meditation entry point. Two modes side-by-side:
 *  - Unguided: bell-only timer with quick presets (3×3 / 5×3 / etc.)
 *    or a custom triple. Same logic as the legacy /qm-training screen.
 *  - Guided: list of QM audio sessions (paired with their SM track in
 *    the catalog) — tap one to open the global Player. Locked sessions
 *    show their unlock SM dependency inline.
 */

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
  { id: 'qm3-12',   rounds: 12, lengthMin: 3, breakSec: 60, label: '12 × 3 min', sub: 'Extended QM3' },
  { id: 'qm5',      rounds: 5, lengthMin: 5, breakSec: 60, label: '5 × 5 min', sub: 'QM5 — Center of Gravity' },
];

const ROUND_OPTIONS: { rounds: number }[] = [
  { rounds: 3 }, { rounds: 6 }, { rounds: 12 },
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

const PRE_ROUND_SECONDS = 3;
const TICK_SOURCE = require('../../assets/audio/tick.mp3');

const fmtMMSS = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

type Phase = 'config' | 'countdown' | 'round' | 'break' | 'done';
type Mode = 'unguided' | 'guided';

// ---------------------------------------------------------------------------

/** Build the guided-audio list — every QM track in the catalogue that
 *  isn't `comingSoon`, grouped by its parent Part so Earth → Sky →
 *  Space order is preserved (mirrors the journey tree). */
type GuidedItem = {
  partId: 'part1' | 'part2' | 'part3';
  partLabel: string;
  track: AudioTrack;
  /** SM track that gates this QM, when one is declared. Used for the
   *  "Listen to ‘X’ first" hint on locked QMs. */
  smGate?: AudioTrack;
};

function buildGuidedItems(): GuidedItem[] {
  const out: GuidedItem[] = [];
  const partLabel: Record<string, string> = {
    part1: 'Part 1 — The Earth',
    part2: 'Part 2 — The Sky',
    part3: 'Part 3 — The Space',
  };
  for (const v of silentMindVolets) {
    if (v.id === 'intro' || !v.qmTracks) continue;
    for (const qm of v.qmTracks) {
      if (qm.comingSoon) continue;
      // Find the SM gate for this QM via the explicit catalog pairing
      // exposed through the unlock walker (same source of truth as the
      // tree). We re-import the pairing here lazily to avoid a circular
      // import; lookup is one row.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PAIRING = require('../../src/content/catalog').QM_TO_SM_PAIRING as Record<string, string>;
      const smId = PAIRING[qm.id];
      const smGate = smId ? v.tracks.find(t => t.id === smId) : undefined;
      out.push({
        partId: v.id as GuidedItem['partId'],
        partLabel: partLabel[v.id] ?? v.id,
        track: qm,
        smGate,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

export default function QMScreen() {
  const { columnMax, playSize, playCenterY } = useLayout();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const usableH = Math.max(360, winH - insets.top - insets.bottom);
  const gapTop = playCenterY - insets.top - playSize / 2;
  const TOP_FLEX = Math.max(0.1, gapTop) / Math.max(1, usableH - playSize - gapTop);

  // ---- mode (guided / unguided) ----
  const [mode, setMode] = useState<Mode>('unguided');

  // ---- audio cues (shared between countdown ticks + round bell) ----
  const bellSoundId = useSessionPrefs(s => s.bellSoundId);
  const bellSource = useMemo(() => getBellSource(bellSoundId), [bellSoundId]);
  const bellPlayer = useAudioPlayer(bellSource ?? TICK_SOURCE);
  const tickPlayer = useAudioPlayer(TICK_SOURCE);
  const playBell = () => {
    if (!bellSource) return;
    try { bellPlayer.seekTo(0); bellPlayer.play(); } catch {}
  };
  const playTick = () => {
    try { tickPlayer.seekTo(0); tickPlayer.play(); } catch {}
  };

  // ---- timer config (presets / custom) ----
  const [roundsCount, setRoundsCount] = useState<number>(5);
  const [roundLengthMin, setRoundLengthMin] = useState<number>(3);
  const [breakSeconds, setBreakSeconds] = useState<number>(60);
  const [customOpen, setCustomOpen] = useState<boolean>(false);
  const [draftRounds, setDraftRounds] = useState<number>(roundsCount);
  const [draftLength, setDraftLength] = useState<number>(roundLengthMin);
  const [draftBreak, setDraftBreak] = useState<number>(breakSeconds);
  const matchedPresetId =
    PRESETS.find(p => p.rounds === roundsCount && p.lengthMin === roundLengthMin && p.breakSec === breakSeconds)?.id ?? null;

  // ---- timer session state ----
  const [phase, setPhase] = useState<Phase>('config');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [elapsed, setElapsed] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const roundSeconds = roundLengthMin * 60;
  const phaseDuration =
    phase === 'break' ? breakSeconds
    : phase === 'countdown' ? PRE_ROUND_SECONDS
    : roundSeconds;
  const remaining = Math.max(0, phaseDuration - elapsed);
  const countdownInt = Math.max(1, Math.ceil(remaining));

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

  const inBreakCountdown =
    phase === 'break' && remaining > 0 && remaining <= PRE_ROUND_SECONDS;

  const lastTickSecondRef = useRef<number | null>(null);
  useEffect(() => {
    const isInCountdown = phase === 'countdown' || inBreakCountdown;
    if (!isInCountdown) { lastTickSecondRef.current = null; return; }
    if (countdownInt !== lastTickSecondRef.current) {
      lastTickSecondRef.current = countdownInt;
      playTick();
    }
  }, [phase, countdownInt, inBreakCountdown]);

  useEffect(() => {
    if (phase !== 'round' && phase !== 'break' && phase !== 'countdown') return;
    if (elapsed < phaseDuration) return;
    if (phase === 'countdown') {
      playBell();
      setPhase('round');
      setElapsed(0);
      return;
    }
    playBell();
    if (phase === 'round') {
      const isLastRound = currentRound >= roundsCount;
      if (isLastRound) { setPhase('done'); return; }
      setPhase('break'); setElapsed(0);
    } else if (phase === 'break') {
      setCurrentRound(c => c + 1); setPhase('round'); setElapsed(0);
    }
  }, [elapsed, phase, phaseDuration, currentRound, roundsCount]);

  const startSession = () => {
    setCurrentRound(1); setElapsed(0); setPaused(false);
    setPhase('countdown');
  };
  const skipPhase = () => {
    if (phase === 'countdown') { setPhase('round'); setElapsed(0); return; }
    if (phase === 'round') {
      const isLastRound = currentRound >= roundsCount;
      if (isLastRound) { setPhase('done'); return; }
      setPhase('break'); setElapsed(0); return;
    }
    if (phase === 'break') {
      setCurrentRound(c => c + 1); setPhase('round'); setElapsed(0);
    }
  };
  const closeSession = () => {
    setPhase('config'); setElapsed(0); setCurrentRound(1);
  };

  // ---- guided list ----
  const guidedItems = useMemo(() => buildGuidedItems(), []);
  const listened = useProgress(s => s.listened);
  const openPlayer = usePlayerStore(s => s.open);
  const playGuided = (it: GuidedItem) => {
    if (!isTrackUnlocked(it.track.id, listened)) {
      // Locked — surface the unlock dependency rather than just doing
      // nothing. We re-use the existing in-app message via a lightweight
      // alert; native shows a system dialog, web a console-friendly one.
      const gate = it.smGate?.title ?? 'the matching practice in Silent Mind';
      // eslint-disable-next-line no-alert
      alert(`Listen to “${gate}” first in the Silent Mind program to unlock this QM session.`);
      return;
    }
    const playlist = guidedItems.map(g => g.track).filter(t => isTrackUnlocked(t.id, listened));
    openPlayer(it.track, playlist, { autoStart: true });
  };

  // ---- render ---------------------------------------------------------

  // Session in progress: render the timer-active screen (round / break / done)
  if (phase !== 'config') {
    return (
      <Background color={colors.bgTabAlt}>
        <Stack.Screen options={{ title: '' }} />
        <SwipeTabs current="qm">
        <View style={[styles.content, { alignItems: 'center', paddingTop: insets.top }]}>
          <View style={[styles.column, { maxWidth: columnMax, alignItems: 'center', flex: 1 }]}>
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
            <View style={{ height: playSize }} />
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
                  <Pressable onPress={closeSession} hitSlop={10} style={styles.exitLink}>
                    <Text style={styles.exitLinkText}>Exit training</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.controlsStack}>
                  <Pressable onPress={closeSession} style={styles.donePill}>
                    <Text style={[styles.donePillText, { color: colors.accentAlt }]}>Reset</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </View>
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
        </SwipeTabs>
      </Background>
    );
  }

  // Config phase — header + Guided/Unguided toggle + play circle +
  // (presets | guided list) below the circle.
  return (
    <Background color={colors.bgTabAlt}>
      <Stack.Screen options={{ title: '' }} />
      <SwipeTabs current="qm">
      <View style={[styles.content, { alignItems: 'center', paddingTop: insets.top, flex: 1 }]}>
        <View style={[styles.column, { maxWidth: columnMax, flex: 1 }]}>
          <View style={{ flex: TOP_FLEX, alignItems: 'center' }}>
            <ProgramHeader
              eyebrow={qmProgram.eyebrow}
              title="QM Training"
              description={mode === 'unguided'
                ? 'Bell-only timed rounds — pick a preset or set your own format.'
                : 'Tap a guided session to open the audio. Locked sessions unlock with their Silent Mind counterpart.'}
              accent={colors.accentAlt}
            />
            <ModeToggle mode={mode} onChange={setMode} />
            <View style={{ flex: 1 }} />
            {mode === 'unguided' ? (
              <Text style={styles.totalLine}>
                {roundsCount} × {roundLengthMin} min · break {breakSeconds < 60 ? `${breakSeconds}s` : `${Math.round(breakSeconds / 60)} min`}
              </Text>
            ) : null}
          </View>

          <View style={{ height: playSize }} />

          <View style={{ flex: 1, alignItems: 'center', width: '100%' }}>
            <View style={{ flex: 1 }} />
            {mode === 'unguided' ? (
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
                        <Text style={[styles.presetCellLabel, selected && styles.presetCellLabelSelected]}>
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
                    <Text style={[
                      styles.presetCellLabel,
                      matchedPresetId === null && styles.presetCellLabelSelected,
                    ]}>
                      Custom…
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <GuidedList items={guidedItems} listened={listened} onPress={playGuided} />
            )}
          </View>
        </View>
      </View>

      {/* Pre-play CircleButton — only meaningful in unguided mode (it
          starts the timer). Hidden in guided mode since each list row
          carries its own play affordance. */}
      {mode === 'unguided' ? (
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
      ) : null}

      <Modal visible={customOpen} transparent animationType="slide" onRequestClose={() => setCustomOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCustomOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => { /* swallow */ }}>
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
      </SwipeTabs>
    </Background>
  );
}

// ---------------------------------------------------------------------------

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <View style={styles.modeToggle}>
      {(['guided', 'unguided'] as Mode[]).map(m => {
        const active = m === mode;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={({ pressed }) => [
              styles.modeBtn,
              active && styles.modeBtnActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
              {m === 'guided' ? 'Guided' : 'Unguided'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------

function GuidedList({
  items,
  listened,
  onPress,
}: {
  items: GuidedItem[];
  listened: Record<string, true>;
  onPress: (it: GuidedItem) => void;
}) {
  // Group items by part for visual section headers — same Earth/Sky/
  // Space rhythm as the journey tree, so the QM list stays integrated
  // with the program structure even though it's flat-rendered here.
  const groups = useMemo(() => {
    const map: Record<string, GuidedItem[]> = {};
    for (const it of items) {
      (map[it.partLabel] ??= []).push(it);
    }
    return Object.entries(map);
  }, [items]);

  if (items.length === 0) {
    return (
      <View style={styles.guidedEmpty}>
        <Text style={styles.guidedEmptyText}>
          More guided QM sessions coming soon. In the meantime, try the Unguided timer.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.guidedList}>
      {groups.map(([label, rows]) => (
        <View key={label} style={styles.guidedSection}>
          <Text style={styles.guidedSectionLabel}>{label}</Text>
          {rows.map(row => {
            const unlocked = isTrackUnlocked(row.track.id, listened);
            const done = !!listened[row.track.id];
            const dur = trackDuration(row.track);
            return (
              <Pressable
                key={row.track.id}
                onPress={() => onPress(row)}
                style={({ pressed }) => [
                  styles.guidedRow,
                  !unlocked && styles.guidedRowLocked,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.guidedRowDot}>
                  {unlocked ? (
                    <Text style={styles.guidedRowPlay}>▶</Text>
                  ) : (
                    <Text style={styles.guidedRowLock}>🔒</Text>
                  )}
                </View>
                <View style={styles.guidedRowText}>
                  <Text
                    style={[styles.guidedRowTitle, !unlocked && styles.guidedRowTitleLocked]}
                    numberOfLines={1}
                  >
                    {row.track.title}
                  </Text>
                  <Text style={styles.guidedRowMeta} numberOfLines={1}>
                    {!unlocked && row.smGate
                      ? `Listen to ‘${row.smGate.title}’ first`
                      : done
                        ? `${dur ?? ''} · listened`
                        : (dur ?? '')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  column: { width: '100%', alignSelf: 'center' },

  modeToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 3,
    marginTop: spacing.sm,
  },
  modeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  modeBtnActive: {
    backgroundColor: 'rgba(54,160,158,0.22)',
  },
  modeBtnText: {
    ...type.overline,
    color: colors.textDim,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  modeBtnTextActive: {
    color: colors.accentAlt,
  },

  presetBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    width: '100%',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  presetCell: {
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
  presetCellLabel: { ...type.h3, color: colors.text, fontSize: 15 },
  presetCellLabelSelected: { color: colors.accentAlt },
  customCell: { borderStyle: 'dashed' },

  guidedList: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  guidedSection: { gap: spacing.xs },
  guidedSectionLabel: {
    ...type.overline,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.6,
    marginBottom: spacing.xs,
  },
  guidedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(54,160,158,0.45)',
    backgroundColor: 'rgba(54,160,158,0.08)',
  },
  guidedRowLocked: {
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  guidedRowDot: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.accentAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  guidedRowPlay: {
    color: colors.accentAlt, fontSize: 11, marginLeft: 2, fontWeight: '700',
  },
  guidedRowLock: { fontSize: 12 },
  guidedRowText: { flex: 1 },
  guidedRowTitle: { ...type.h3, color: colors.text, fontSize: 14 },
  guidedRowTitleLocked: { color: colors.textDim },
  guidedRowMeta: { ...type.caption, color: colors.textMuted, fontSize: 11, marginTop: 2 },

  guidedEmpty: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, alignItems: 'center' },
  guidedEmptyText: { ...type.caption, color: colors.textMuted, textAlign: 'center', fontSize: 13 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
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
  },
  modalTitle: {
    ...type.h3, color: colors.text, fontSize: 16,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row', justifyContent: 'center',
    gap: spacing.md, marginTop: spacing.lg,
  },
  modalCancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  modalCancelText: {
    ...type.overline, color: colors.textDim, fontSize: 11, letterSpacing: 1.4,
  },
  modalApply: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentAlt,
  },
  modalApplyText: { ...type.overline, fontSize: 11, letterSpacing: 1.6 },

  pickerLabel: {
    ...type.sectionLabel, color: colors.textMuted,
    fontSize: 11, marginTop: spacing.sm, textAlign: 'center',
  },
  pickerRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  pickerCell: {
    flex: 1, maxWidth: 110,
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
  pickerCellText: { ...type.h3, color: colors.text, fontSize: 14 },
  pickerCellTextSelected: { color: colors.accentAlt },

  totalLine: {
    ...type.overline, color: colors.textDim,
    fontSize: 11, letterSpacing: 1.4,
    textAlign: 'center', marginTop: spacing.sm,
  },

  roundBarText: {
    ...type.overline, fontSize: 11, letterSpacing: 1.6,
    textAlign: 'center', marginTop: spacing.xl,
  },
  roundBarBreak: { color: colors.textMuted },
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.45)' },
  dotCurrent: { width: 8, height: 8, borderRadius: 4 },

  timerSlot: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  timer: {
    ...type.display, color: colors.text,
    fontSize: 64, lineHeight: 70, letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  timerCountdown: { fontSize: 96, lineHeight: 100, color: colors.accentAlt },
  timerSub: {
    ...type.overline, color: colors.textDim,
    fontSize: 10, letterSpacing: 1.4, marginTop: spacing.xs,
  },

  controlsStack: { alignItems: 'center', marginTop: spacing.lg, gap: spacing.md },
  skipBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  skipBtnText: { ...type.overline, fontSize: 11, letterSpacing: 1.4 },

  donePill: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentAlt,
  },
  donePillText: { ...type.overline, fontSize: 11, letterSpacing: 1.6 },

  exitLink: { marginTop: spacing.xl, paddingVertical: spacing.sm },
  exitLinkText: { ...type.caption, color: colors.textDim },
});
