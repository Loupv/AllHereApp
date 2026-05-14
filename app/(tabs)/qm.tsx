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
import { useTabBarPadding } from '../../src/hooks/useTabBarPadding';
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

// 5 s pre-round countdown gives users a longer settle-in moment before
// the first bell — the previous 3 s felt rushed once we added the
// pre-bell breathing intent. Adjust here only; the rest of the QM
// timer chain reads from this constant.
const PRE_ROUND_SECONDS = 5;
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
  const tabPad = useTabBarPadding();
  const { height: winH } = useWindowDimensions();
  const usableH = Math.max(360, winH - insets.top - insets.bottom);
  const gapTop = playCenterY - insets.top - playSize / 2;
  const TOP_FLEX = Math.max(0.1, gapTop) / Math.max(1, usableH - playSize - gapTop);

  // ---- mode (guided / unguided) ----
  // Null = nothing picked yet; the QM tab opens on the two large
  // mode cards, content reveals only after a tap.
  const [mode, setMode] = useState<Mode | null>(null);

  // ---- audio cues (shared between countdown ticks + round bell) ----
  const bellSoundId = useSessionPrefs(s => s.bellSoundId);
  const bellSource = useMemo(() => getBellSource(bellSoundId), [bellSoundId]);
  const bellPlayer = useAudioPlayer(bellSource ?? TICK_SOURCE);
  const tickPlayer = useAudioPlayer(TICK_SOURCE);
  const playBell = () => {
    if (!bellSource) return;
    try { bellPlayer.seekTo(0); bellPlayer.play(); } catch {}
  };
  // Cuts any in-flight bell decay — used by Exit Training and the
  // mode→guided guard below so a bell triggered in unguided doesn't
  // bleed into the guided audio (which has its own opening bell baked
  // into the mp3).
  const stopBell = () => {
    try { bellPlayer.pause(); } catch {}
    try { bellPlayer.seekTo(0); } catch {}
  };
  const playTick = () => {
    try { tickPlayer.seekTo(0); tickPlayer.play(); } catch {}
  };

  // Defensive: if the user toggles to guided while a phase-transition
  // bell is still decaying, mute it. The guided mp3 has its own bell
  // baked in; we don't want the unguided one bleeding on top.
  useEffect(() => {
    if (mode === 'guided') {
      try { bellPlayer.pause(); } catch {}
    }
  // bellPlayer ref is stable from useAudioPlayer; we only react to mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ---- timer config (presets / custom) ----
  const [roundsCount, setRoundsCount] = useState<number>(5);
  const [roundLengthMin, setRoundLengthMin] = useState<number>(3);
  const [breakSeconds, setBreakSeconds] = useState<number>(60);
  const [customOpen, setCustomOpen] = useState<boolean>(false);
  const [draftRounds, setDraftRounds] = useState<number>(roundsCount);
  const [draftLength, setDraftLength] = useState<number>(roundLengthMin);
  const [draftBreak, setDraftBreak] = useState<number>(breakSeconds);

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
    // Cut the bell decay first — if Exit Training is tapped right
    // after a phase-transition bell rang, we don't want it ringing
    // out into a silent screen (or worse, into a guided audio the
    // user opens immediately after).
    stopBell();
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
        <View style={[styles.content, { alignItems: 'center', paddingTop: insets.top, paddingBottom: tabPad }]}>
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
                          ? ''
                          : `${roundLengthMin} min round`}
                </Text>
              </View>
            </View>
            <View style={{ height: playSize }} />
            <View style={{ flex: 1, alignItems: 'center', width: '100%' }}>
              {phase !== 'done' ? (
                <View style={styles.controlsStack}>
                  {/* Skip is only useful during the break — we hide it
                      during countdown ('Start now') and round ('End
                      round') because it collides visually with the big
                      play / pause CircleButton sitting at the same
                      vertical position. The bell + duration drive
                      those phases on their own. */}
                  {phase === 'break' ? (
                    <Pressable
                      onPress={skipPhase}
                      hitSlop={10}
                      style={[styles.skipBtn, styles.skipBtnBreakOffset]}
                    >
                      <Text style={[styles.skipBtnText, { color: colors.accentAlt }]}>
                        Skip break →
                      </Text>
                    </Pressable>
                  ) : null}
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

  // Config phase — header + Guided/Unguided toggle + (presets | guided
  // list). No big play button here: tapping a preset starts the timer
  // directly; tapping a guided row opens the Player.
  return (
    <Background color={colors.bgTabAlt}>
      <Stack.Screen options={{ title: '' }} />
      <SwipeTabs current="qm">
      <View style={[styles.content, { alignItems: 'center', paddingTop: insets.top, flex: 1 }]}>
        <View style={[styles.column, { maxWidth: columnMax, flex: 1 }]}>
          <ProgramHeader
            eyebrow={qmProgram.eyebrow}
            title={qmProgram.title}
            subtitle={qmProgram.byline}
            description={qmProgram.intro}
            accent={colors.accentAlt}
          />

          <View style={{ width: '100%', marginTop: spacing.md }}>
            <ModePicker mode={mode} onChange={setMode} />
          </View>

          {/* Content area — only renders once a mode is picked. Before
              that, only the two ModePicker cards are visible above.
              `mode === null` keeps the page intentionally sparse so
              the user makes a deliberate choice. */}
          <View style={{ flex: 1, alignItems: 'center', width: '100%', marginTop: spacing.xl }}>
            {mode === null ? null : mode === 'unguided' ? (
              <View style={styles.presetBlock}>
                <Text style={styles.pickerLabel}>Choose a format</Text>
                <View style={styles.presetGrid}>
                  {PRESETS.map(p => {
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setRoundsCount(p.rounds);
                          setRoundLengthMin(p.lengthMin);
                          setBreakSeconds(p.breakSec);
                          // Start session immediately — the preset cell
                          // is the entry point now (no separate play
                          // button). Use setTimeout(0) so the state
                          // updates flush before the phase change.
                          setTimeout(() => startSession(), 0);
                        }}
                        style={({ pressed }) => [
                          styles.presetCell,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.presetCellLabel}>
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
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.presetCellLabel}>
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

function ModePicker({
  mode,
  onChange,
}: {
  mode: Mode | null;
  onChange: (m: Mode) => void;
}) {
  // Two stand-alone cards side by side. They aren't a segmented
  // control anymore (= no pre-selected default) — the user has to
  // actively pick one, and the content area below stays empty until
  // a card is tapped. Tapped card shows an accent border + filled
  // background; other card stays muted.
  const items: { id: Mode; title: string; subtitle: string }[] = [
    {
      id: 'guided',
      title: 'Guided',
      subtitle: 'Audio session paired with QM guidance',
    },
    {
      id: 'unguided',
      title: 'Unguided',
      subtitle: 'Bell-only timer, your own format',
    },
  ];
  return (
    <View style={styles.modePicker}>
      {items.map(it => {
        const active = it.id === mode;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
            style={({ pressed }) => [
              styles.modeCard,
              active && styles.modeCardActive,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={[styles.modeCardTitle, active && styles.modeCardTitleActive]}>
              {it.title}
            </Text>
            <Text style={styles.modeCardSubtitle}>
              {it.subtitle}
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
                    {!unlocked
                      ? 'Listen to the longer version first'
                      : row.track.rounds
                        ? `${row.track.rounds.max} rounds${done ? ' · listened' : ''}`
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

  // Two side-by-side cards. Inactive cards stay muted (subtle border
  // + dim text); active card lights up with the QM teal accent and a
  // faint fill so the user can see which mode is currently revealing
  // content below.
  modePicker: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modeCard: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
  },
  modeCardActive: {
    borderColor: colors.accentAlt,
    backgroundColor: 'rgba(54,160,158,0.12)',
  },
  modeCardTitle: {
    ...type.overline,
    color: colors.textDim,
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: 6,
  },
  modeCardTitleActive: {
    color: colors.accentAlt,
  },
  modeCardSubtitle: {
    ...type.caption,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
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
  // Preset cells are the entry points (no play button — tapping a cell
  // starts the timer). Compact 2-col grid so the 5 presets + Custom
  // fit comfortably on a phone screen without scrolling. Teal identity
  // (border + fill) matches the ProgramHeader pill and the guided rows
  // below, so the unguided / guided modes feel like siblings.
  presetCell: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentAltSoft,
    backgroundColor: 'rgba(54,160,158,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
  presetCellLabel: {
    ...type.h3,
    color: colors.text,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  // The Custom cell stays visually distinct — dashed border + neutral
  // fill — so the eye reads it as "configure" rather than "another
  // preset". Same dimensions / radius for grid harmony.
  customCell: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

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
  // Extra top breathing room when the Skip-break button sits just
  // below the play CircleButton during a break — without it the
  // overline text sat flush against the ring and read as one block.
  skipBtnBreakOffset: { marginTop: spacing.xl },
  skipBtnText: { ...type.overline, fontSize: 11, letterSpacing: 1.4 },

  donePill: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentAlt,
  },
  donePillText: { ...type.overline, fontSize: 11, letterSpacing: 1.6 },

  // Exit affordance — was too dim/small to read as the Close button
  // for the QM session. Now overline-tracked + textMuted (not
  // textDim), with a bit more padding for a comfy tap target.
  exitLink: { marginTop: spacing.xl, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg },
  exitLinkText: { ...type.overline, color: colors.textMuted, fontSize: 12, letterSpacing: 1.8 },
});
