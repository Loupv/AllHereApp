import { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, PanResponder } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { usePlayerStore } from '../player/store';
import { useProgress } from '../player/progressStore';
import { loadTranscript } from '../content/loadTranscript';
import { findCueIndex, TranscriptCue } from '../content/transcript';
import { colors, radius, spacing, type } from '../theme';
import { CircleButton } from './CircleButton';

const DEFAULT_ARTWORK = require('../../assets/images/lounge-2.jpg');
const DEFAULT_DESCRIPTION = 'Take a moment to arrive. When you are ready, begin.';
const QM_DESCRIPTION = 'A Quantified Meditation session: short rounds with brief breaks in between.';

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const BREAK_OPTIONS = [15, 30, 45, 60, 90];
const breakLabel = (s: number) => s < 60 ? `${s}s` : s === 60 ? '1 min' : `1 min ${s - 60}`;

export function Player() {
  const { track, isOpen } = usePlayerStore();
  if (!track || !isOpen) return null;
  return (
    <Animated.View
      entering={SlideInDown.duration(280)}
      exiting={SlideOutDown.duration(220)}
      style={styles.overlay}
    >
      <PlayerInner />
    </Animated.View>
  );
}

const SWEEP_WINDOW = 3;
const GLOBAL_BASE_OPACITY = 0.15;
const GLOBAL_PEAK_OPACITY = 1;
const easeCos = (x: number) => 0.5 * (1 + Math.cos(Math.PI * Math.min(1, Math.max(0, x))));

function seekFromX(
  x: number,
  barWidth: React.MutableRefObject<number>,
  durationRef: React.MutableRefObject<number>,
  scrubValue: React.MutableRefObject<number>,
) {
  const w = barWidth.current;
  const d = durationRef.current;
  if (!Number.isFinite(w) || !Number.isFinite(d) || w <= 0 || d <= 0) return;
  const frac = Math.max(0, Math.min(1, x / w));
  const target = frac * d;
  if (!Number.isFinite(target)) return;
  scrubValue.current = target;
}

function useSmoothTime(statusTime: number | undefined, playing: boolean | undefined) {
  const [t, setT] = useState(0);
  const sync = useRef({ t: 0, at: 0 });
  useEffect(() => {
    sync.current = { t: statusTime ?? 0, at: (typeof performance !== 'undefined' ? performance.now() : Date.now()) };
  }, [statusTime]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = (now - sync.current.at) / 1000;
      setT(sync.current.t + (playing ? dt : 0));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return t;
}

function PlayerInner() {
  const { track, close } = usePlayerStore();
  const markListened = useProgress(s => s.markListened);

  const [selectedRounds, setSelectedRounds] = useState(track?.rounds?.max ?? 1);
  const [breakSeconds, setBreakSeconds] = useState(track?.rounds?.breakSeconds ?? 60);
  const [includeIntro, setIncludeIntro] = useState(!!track?.rounds?.introSource);
  const [currentRound, setCurrentRound] = useState(1);
  const [hasStarted, setHasStarted] = useState(false);
  const [inBreak, setInBreak] = useState(false);
  const [breakRemaining, setBreakRemaining] = useState(0);
  const [finished, setFinished] = useState(false);
  const endedHandled = useRef(false);

  const roundSource = (() => {
    if (!track) return undefined;
    const r = track.rounds;
    if (currentRound === 0) return r?.introSource;
    if (r?.roundSources && r.roundSources[currentRound - 1]) return r.roundSources[currentRound - 1];
    return track.source;
  })();

  const player = useAudioPlayer(roundSource);
  const status = useAudioPlayerStatus(player);

  const [cues, setCues] = useState<TranscriptCue[]>([]);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubValue = useRef(0);
  const barWidth = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const cueLayouts = useRef<Record<number, number>>({});
  const userScrollingUntil = useRef(0);
  const expectedScrollY = useRef(0);

  const liveT = useSmoothTime(status.currentTime, status.playing);
  const t = scrubbing ? scrubValue.current : liveT;
  const duration = status.duration ?? 0;
  const durationRef = useRef(0);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    setHasStarted(false);
    setCurrentRound(1);
    setSelectedRounds(track?.rounds?.max ?? 1);
    setBreakSeconds(track?.rounds?.breakSeconds ?? 60);
    setIncludeIntro(!!track?.rounds?.introSource);
    setInBreak(false);
    setFinished(false);
    endedHandled.current = false;
    return () => { try { player.pause(); } catch {} };
  }, [track?.id]);

  useEffect(() => {
    if (track?.transcript) {
      loadTranscript(track.transcript).then(setCues).catch(() => setCues([]));
    } else {
      setCues([]);
    }
  }, [track?.id, roundSource]);

  useEffect(() => {
    if (!track || duration <= 0) return;
    if (t >= duration * 0.8) markListened(track.id);
  }, [t, duration, track?.id]);

  useEffect(() => {
    if (!hasStarted || inBreak || finished) return;
    if (duration <= 0) return;
    const didFinish = (status as any).didJustFinish || (t > 0 && t >= duration - 0.15 && !status.playing);
    if (didFinish && !endedHandled.current) {
      endedHandled.current = true;
      handleRoundEnd();
    }
  }, [t, duration, status.playing, hasStarted, inBreak, finished]);

  useEffect(() => {
    if (!inBreak) return;
    if (breakRemaining <= 0) { endBreak(); return; }
    const id = setTimeout(() => setBreakRemaining(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [inBreak, breakRemaining]);

  const handleRoundEnd = () => {
    // After intro (round 0), go straight to round 1 with no break
    if (currentRound === 0) {
      setCurrentRound(1);
      endedHandled.current = false;
      try { player.seekTo(0); player.play(); } catch {}
      return;
    }
    const hasMore = track?.rounds && currentRound < selectedRounds;
    if (hasMore) {
      setInBreak(true);
      setBreakRemaining(breakSeconds);
    } else {
      setFinished(true);
    }
  };

  const endBreak = () => {
    setInBreak(false);
    setCurrentRound(r => r + 1);
    endedHandled.current = false;
    try { player.seekTo(0); player.play(); } catch {}
  };

  const currentCueIdx = useMemo(() => (cues.length ? findCueIndex(cues, t) : -1), [cues, t]);

  useEffect(() => {
    if (!hasStarted || inBreak) return;
    if (currentCueIdx < 0) return;
    if (Date.now() < userScrollingUntil.current) return;
    const cur = cueLayouts.current[currentCueIdx];
    if (cur == null) return;
    const next = cueLayouts.current[currentCueIdx + 1];
    const cue = cues[currentCueIdx];
    const nextCue = cues[currentCueIdx + 1];
    const nextY = next != null ? next : cur + 60;
    const span = Math.max(0.01, (nextCue ? nextCue.start : cue.end) - cue.start);
    const frac = Math.max(0, Math.min(1, (t - cue.start) / span));
    const y = cur + (nextY - cur) * frac;
    const targetY = Math.max(0, y - 180);
    expectedScrollY.current = targetY;
    scrollRef.current?.scrollTo({ y: targetY, animated: false });
  }, [currentCueIdx, t, hasStarted, inBreak]);

  const handleUserScroll = (e: any) => {
    const offset = e?.nativeEvent?.contentOffset?.y ?? 0;
    if (Math.abs(offset - expectedScrollY.current) > 30) {
      userScrollingUntil.current = Date.now() + 5000;
    }
  };
  const handleScrollBegin = () => {
    userScrollingUntil.current = Date.now() + 5000;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setScrubbing(true);
        seekFromX(e.nativeEvent.locationX, barWidth, durationRef, scrubValue);
      },
      onPanResponderMove: (e) => {
        seekFromX(e.nativeEvent.locationX, barWidth, durationRef, scrubValue);
      },
      onPanResponderRelease: () => {
        const target = scrubValue.current;
        if (Number.isFinite(target) && target >= 0) {
          try { Promise.resolve(player.seekTo(target)).catch(() => {}); } catch {}
        }
        setScrubbing(false);
      },
      onPanResponderTerminate: () => setScrubbing(false),
    }),
  ).current;

  if (!track) return null;
  const progress = duration > 0 ? t / duration : 0;
  const playing = status.playing;
  const artwork = track.artwork ?? DEFAULT_ARTWORK;
  const description = track.description ?? (track.rounds ? QM_DESCRIPTION : DEFAULT_DESCRIPTION);
  const rounds = track.rounds;
  const breakProgress = inBreak && breakSeconds > 0 ? (breakSeconds - breakRemaining) / breakSeconds : 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {!finished ? (
          <Pressable onPress={close} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        ) : <View style={{ width: 50 }} />}
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.body}>
      <View style={styles.top}>
        <View style={[styles.artwork, !hasStarted && styles.artworkLarge]}>
          <Image source={artwork} style={styles.artworkImage} resizeMode="cover" />
          <View style={styles.artworkOverlay} />
        </View>
        <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
        {rounds ? (
          <View style={styles.roundBar}>
            {hasStarted ? (
              <>
                <Text style={styles.roundBarText}>
                  {currentRound === 0 ? 'INTRO' : `ROUND ${currentRound} / ${selectedRounds}`}
                </Text>
                <View style={styles.dotsRow}>
                  {Array.from({ length: selectedRounds }, (_, i) => {
                    const state = i + 1 < currentRound ? 'done' : i + 1 === currentRound ? 'current' : 'upcoming';
                    return (
                      <View key={i} style={[
                        styles.dot,
                        state === 'done' && styles.dotDone,
                        state === 'current' && styles.dotCurrent,
                      ]} />
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.roundBarText}>
                QM{rounds.roundLengthMinutes} · {rounds.roundLengthMinutes}-MIN ROUNDS · UP TO {rounds.max}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {!hasStarted ? (
        <View style={styles.preplay}>
          <Text style={styles.description}>{description}</Text>
          {rounds ? (
            <View style={styles.paramsCard}>
              <View style={styles.sliderHeader}>
                {rounds.introSource ? (
                  <View style={styles.introToggleRow}>
                    <Pressable onPress={() => setIncludeIntro(s => !s)} style={styles.introToggle}>
                      <View style={[styles.switch, includeIntro && styles.switchOn]}>
                        <View style={[styles.switchKnob, includeIntro && styles.switchKnobOn]} />
                      </View>
                      <Text style={styles.introToggleText}>Intro</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Text style={styles.sliderLabel}>ROUNDS</Text>
                <Text style={styles.sliderValue}>{selectedRounds}<Text style={styles.sliderMax}>/{rounds.max}</Text></Text>
              </View>
              <RoundsSlider max={rounds.max} value={selectedRounds} onChange={setSelectedRounds} />

              <View style={styles.breakPickerHeader}>
                <Text style={styles.sliderLabel}>BREAK</Text>
              </View>
              <View style={styles.breakRow}>
                {BREAK_OPTIONS.map(opt => {
                  const selected = opt === breakSeconds;
                  return (
                    <Pressable key={opt} onPress={() => setBreakSeconds(opt)} style={styles.breakOption}>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioInner} /> : null}
                      </View>
                      <Text style={[styles.breakOptionText, selected && styles.breakOptionTextSelected]}>
                        {breakLabel(opt)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <CircleButton mode="pre" onPress={() => {
            const startAtIntro = rounds?.introSource && includeIntro;
            setHasStarted(true);
            setCurrentRound(startAtIntro ? 0 : 1);
            endedHandled.current = false;
            player.play();
          }} />
          <Text style={styles.durationHint}>
            {rounds
              ? `${selectedRounds} × ${rounds.roundLengthMinutes} min · break ${breakLabel(breakSeconds)}`
              : duration > 0
                ? `${fmt(duration)} — start when you are ready`
                : 'Loading…'}
          </Text>
        </View>
      ) : inBreak ? (
        <View style={styles.preplay}>
          <Text style={styles.description}>Breathe naturally. Round {currentRound + 1} in a moment.</Text>
          <CircleButton
            mode="break"
            breakProgress={breakProgress}
            breakLabel={fmt(breakRemaining)}
          />
          <View style={styles.breakButtons}>
            <Pressable onPress={() => setBreakRemaining(0)} style={styles.pill}>
              <Text style={styles.pillText}>Skip break</Text>
            </Pressable>
            <Pressable onPress={endBreak} style={styles.pillPrimary}>
              <Text style={styles.pillPrimaryText}>Next round</Text>
            </Pressable>
          </View>
        </View>
      ) : finished ? (
        <View style={styles.preplay}>
          <Text style={styles.breakLabel}>AUDIO ENDED</Text>
          <Pressable onPress={close} style={styles.pillPrimary}>
            <Text style={styles.pillPrimaryText}>Close</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.playView}>
          <View style={styles.transcriptFrame}>
            {cues.length > 0 ? (
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.transcriptContent}
                onScroll={handleUserScroll}
                onScrollBeginDrag={handleScrollBegin}
                onTouchStart={handleScrollBegin}
                scrollEventThrottle={16}
              >
                {cues.map((cue, i) => (
                  <CueLine
                    key={i}
                    cue={cue}
                    time={t}
                    onLayout={(y) => { cueLayouts.current[i] = y; }}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noTranscript}>
                <Text style={styles.noTranscriptText}>
                  {track.transcript ? 'Loading transcript…' : 'No transcript for this audio.'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.controls}>
            <View
              style={styles.progressHit}
              onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
              {...pan.panHandlers}
            >
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
                <View style={[styles.progressThumb, { left: `${Math.min(100, progress * 100)}%` }]} />
              </View>
            </View>
            <View style={styles.timesRow}>
              <Text style={styles.time}>{fmt(t)}</Text>
              <Text style={styles.time}>{fmt(duration)}</Text>
            </View>
            <View style={styles.playControls}>
              <Pressable onPress={() => player.seekTo(Math.max(0, t - 15))} style={styles.sideBtn}>
                <Text style={styles.sideBtnText}>-15s</Text>
              </Pressable>
              <CircleButton
                size={80}
                mode={playing ? 'playing' : 'paused'}
                onPress={() => { playing ? player.pause() : player.play(); }}
              />
              <Pressable onPress={() => player.seekTo(Math.min(duration, t + 15))} style={styles.sideBtn}>
                <Text style={styles.sideBtnText}>+15s</Text>
              </Pressable>
            </View>
            {rounds ? (
              <Pressable onPress={handleRoundEnd} style={styles.nextRoundBtn}>
                <Text style={styles.nextRoundText}>
                  {currentRound === 0 ? 'Skip intro →' : 'End this round →'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      </View>
    </View>
  );
}

function RoundsSlider({ max, value, onChange }: { max: number; value: number; onChange: (n: number) => void }) {
  const width = useRef(0);
  const [, setTick] = useState(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const seekFromX = (x: number) => {
    if (width.current <= 0 || max <= 1) return;
    const frac = Math.max(0, Math.min(1, x / width.current));
    const n = Math.round(1 + frac * (max - 1));
    if (n !== valueRef.current) {
      valueRef.current = n;
      onChange(n);
      setTick(t => t + 1);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => seekFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => seekFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const frac = max > 1 ? (value - 1) / (max - 1) : 0;

  return (
    <View
      style={styles.sliderHit}
      onLayout={(e) => { width.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${frac * 100}%` }]} />
      </View>
      {Array.from({ length: max }, (_, i) => {
        const f = max > 1 ? i / (max - 1) : 0;
        return (
          <View key={i} style={[styles.sliderTick, { left: `${f * 100}%` }, i + 1 <= value && styles.sliderTickActive]} />
        );
      })}
      <View style={[styles.sliderThumb, { left: `${frac * 100}%` }]} />
    </View>
  );
}

function RoundsDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }, (_, i) => {
        const state = i + 1 < current ? 'done' : i + 1 === current ? 'current' : 'upcoming';
        return <View key={i} style={[styles.dot, state === 'done' && styles.dotDone, state === 'current' && styles.dotCurrent]} />;
      })}
    </View>
  );
}

function CueLine({ cue, time, onLayout }: { cue: TranscriptCue; time: number; onLayout: (y: number) => void }) {
  return (
    <Text
      onLayout={(e) => onLayout(e.nativeEvent.layout.y)}
      style={[styles.cue, { color: colors.text }]}
    >
      {cue.words.map((w, i) => {
        const spaced = i === 0 ? w.text : ' ' + w.text;
        const wCenter = (w.start + w.end) / 2;
        const dist = Math.abs(time - wCenter);
        const closeness = easeCos(dist / SWEEP_WINDOW);
        const opacity = GLOBAL_BASE_OPACITY + (GLOBAL_PEAK_OPACITY - GLOBAL_BASE_OPACITY) * closeness;
        return <Text key={i} style={{ opacity }}>{spaced}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, zIndex: 80 },
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  close: { ...type.caption, color: colors.text },
  eyebrow: { ...type.overline, color: colors.textMuted, fontSize: 10 },
  top: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 6 },
  artwork: {
    width: 110, height: 110, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm, overflow: 'hidden',
    borderColor: colors.border, borderWidth: 1,
  },
  artworkLarge: { width: 130, height: 130 },
  artworkImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  artworkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.35)' },
  title: { ...type.h1, color: colors.text, textAlign: 'center', fontSize: 18 },
  roundBar: { alignItems: 'center', gap: 6, minHeight: 24 },
  roundBarText: { ...type.overline, color: colors.accent, fontSize: 10, textAlign: 'center' },

  preplay: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.sm + 4 },
  description: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 360, fontSize: 13, lineHeight: 20 },
  durationHint: { ...type.overline, color: colors.textDim, fontSize: 10, textAlign: 'center' },

  paramsCard: {
    width: '100%', maxWidth: 400, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1,
    gap: spacing.sm,
  },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  introToggleRow: { flexDirection: 'row', alignItems: 'center' },
  introToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switch: {
    width: 34, height: 18, borderRadius: 9,
    backgroundColor: colors.border, padding: 2, justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.accent },
  switchKnob: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.text },
  switchKnobOn: { transform: [{ translateX: 16 }] },
  introToggleText: { ...type.overline, color: colors.text, fontSize: 10 },
  sliderLabel: { ...type.overline, color: colors.accent, fontSize: 10, flex: 1, textAlign: 'center' },
  sliderValue: { ...type.display, color: colors.text, fontSize: 18 },
  sliderMax: { ...type.caption, color: colors.textDim, fontSize: 12 },
  sliderHit: { height: 30, justifyContent: 'center', position: 'relative' },
  sliderTrack: { height: 3, backgroundColor: colors.border, borderRadius: 2 },
  sliderFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  sliderTick: {
    position: 'absolute', top: '50%', width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.border, marginLeft: -3, marginTop: -3,
  },
  sliderTickActive: { backgroundColor: colors.accent },
  sliderThumb: {
    position: 'absolute', top: '50%', width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.accent, marginLeft: -9, marginTop: -9,
    borderColor: colors.text, borderWidth: 2,
  },

  breakPickerHeader: { marginTop: 6 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakOption: { alignItems: 'center', gap: 4, paddingVertical: 2 },
  radio: {
    width: 16, height: 16, borderRadius: 8,
    borderColor: colors.border, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.accent },
  radioInner: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent },
  breakOptionText: { ...type.caption, color: colors.textMuted, fontSize: 10 },
  breakOptionTextSelected: { color: colors.text },

  breakLabel: { ...type.overline, color: colors.accent, fontSize: 13, letterSpacing: 4 },
  breakButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'center' },

  pill: { paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderColor: colors.border, borderWidth: 1 },
  pillText: { ...type.caption, color: colors.text },
  pillPrimary: { paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.accent },
  pillPrimaryText: { ...type.h3, color: colors.text, fontSize: 14 },

  body: { flex: 1, justifyContent: 'center' },
  playView: {},
  roundHeader: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 6 },
  roundText: { ...type.overline, color: colors.accent, fontSize: 11 },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotCurrent: { backgroundColor: colors.accent, width: 20 },
  dotDone: { backgroundColor: colors.text, opacity: 0.7 },

  transcriptFrame: {
    height: 320,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  transcriptContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg },
  cue: { ...type.body, fontSize: 17, lineHeight: 28, marginBottom: spacing.sm + 4 },
  noTranscript: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  noTranscriptText: { ...type.caption, color: colors.textDim, textAlign: 'center' },

  controls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm },
  progressHit: { paddingVertical: spacing.sm + 4 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, position: 'relative' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  progressThumb: {
    position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.accent, marginLeft: -7,
    borderColor: colors.text, borderWidth: 1,
  },
  timesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  time: { ...type.caption, color: colors.textDim },

  playControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  sideBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderColor: colors.border, borderWidth: 1 },
  sideBtnText: { ...type.caption, color: colors.text },

  nextRoundBtn: { alignSelf: 'center', marginTop: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  nextRoundText: { ...type.caption, color: colors.accent },
});
