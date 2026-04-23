import { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, PanResponder, Platform } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useRouter } from 'expo-router';
import { useLayout, CONTENT_MAX_WIDTH as PLAYER_CONTENT_MAX_WIDTH } from '../hooks/useLayout';
import { usePlayerStore } from '../player/store';
import { useProgress } from '../player/progressStore';
import { loadTranscript } from '../content/loadTranscript';
import { findCueIndex, TranscriptCue } from '../content/transcript';
import { trackProgram } from '../content/catalog';
import { colors, radius, spacing, type } from '../theme';
import { CircleButton } from './CircleButton';
import { AnimatedGradient, GRADIENT_SM, GRADIENT_QM } from './AnimatedGradient';

const DEFAULT_ARTWORK = require('../../assets/images/lounge-2.jpg');
const DEFAULT_DESCRIPTION = 'Take a moment to arrive. When you are ready, begin.';
const QM_DESCRIPTION = 'A Quantified Meditation session: short rounds with brief breaks in between.';

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// (default circle size — actual value computed from useLayout inside the component)
const DEFAULT_CIRCLE_SIZE = 108;

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

function useSmoothTime(
  statusTime: number | undefined,
  playing: boolean | undefined,
  resetKey: string | number,
) {
  const [t, setT] = useState(0);
  const sync = useRef({ t: 0, at: 0 });
  const lastT = useRef(0);
  const now0 = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // Hard reset when the audio source changes, so stale time from the previous
  // round/inter does not bleed into the new one before its first status tick.
  useEffect(() => {
    sync.current = { t: 0, at: now0() };
    lastT.current = 0;
    setT(0);
  }, [resetKey]);
  useEffect(() => {
    // expo-audio reports currentTime with some jitter / lag; accept the status
    // time only when it's forward of (or reasonably close to) the extrapolated
    // time. If status reports a time significantly lower than where we are, it
    // probably lags the actual playback — ignoring it prevents t from jumping
    // backwards, which would otherwise make the karaoke scroll jump up mid-play.
    const st = statusTime ?? 0;
    // Allow "real" backwards moves (>1.5s) to pass through (e.g. explicit seek)
    if (st + 1.5 < lastT.current) {
      sync.current = { t: st, at: now0() };
      lastT.current = st;
    } else if (st >= lastT.current) {
      sync.current = { t: st, at: now0() };
      lastT.current = st;
    }
    // else: small backward jitter — keep extrapolating from the last known sync
  }, [statusTime]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = now0();
      const dt = (now - sync.current.at) / 1000;
      const next = sync.current.t + (playing ? dt : 0);
      // Never emit a value that goes backwards (unless it's a big jump, handled above)
      const monotonic = playing ? Math.max(next, lastT.current) : next;
      lastT.current = monotonic;
      setT(monotonic);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return t;
}

function PlayerInner() {
  const router = useRouter();
  const { isTablet } = useLayout();
  // Bigger central play button on tablet — 160 instead of 108.
  const circleSize = isTablet ? 160 : 108;
  const { track, close, playlist, index, playNext, playPrev } = usePlayerStore();
  const hasNext = index >= 0 && index < playlist.length - 1;
  const hasPrev = index > 0;
  const markListened = useProgress(s => s.markListened);

  const [selectedRounds, setSelectedRounds] = useState(track?.rounds?.max ?? 1);
  const [includeIntro, setIncludeIntro] = useState(!!track?.rounds?.introSource);
  const [currentRound, setCurrentRound] = useState(1);
  const [hasStarted, setHasStarted] = useState(false);
  const [inBreak, setInBreak] = useState(false);
  const [finished, setFinished] = useState(false);
  const endedHandled = useRef(false);
  const roundChangedAt = useRef(0);

  const roundSource = (() => {
    if (!track) return undefined;
    const r = track.rounds;
    if (inBreak) return r?.roundInters?.[currentRound - 1] ?? undefined;
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
  const nextScrollAnimated = useRef(false);

  // Reset smooth time whenever the audio source identity changes (new track, round, or break)
  const sourceKey = `${track?.id ?? 'none'}|${inBreak ? 'b' : 'r'}|${currentRound}`;
  const liveT = useSmoothTime(status.currentTime, status.playing, sourceKey);
  const t = scrubbing ? scrubValue.current : liveT;
  const duration = status.duration ?? 0;
  const durationRef = useRef(0);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    // Call sites can ask the player to bypass the pre-play screen (big
    // play button on Start, etc.). Consume the one-shot flag once per
    // track swap so it doesn't re-fire on future round changes.
    const auto = usePlayerStore.getState().consumeAutoStart();
    const startAtIntro = !!(auto && track?.rounds?.introSource);
    setHasStarted(!!auto);
    setCurrentRound(auto ? (startAtIntro ? 0 : 1) : 1);
    setSelectedRounds(track?.rounds?.max ?? 1);
    setIncludeIntro(!!track?.rounds?.introSource);
    setInBreak(false);
    setFinished(false);
    endedHandled.current = false;
    roundChangedAt.current = 0;
    return () => { try { player.pause(); } catch {} };
  }, [track?.id]);

  useEffect(() => {
    // Prefer round-specific transcript when playing a segmented round / inter
    const roundTranscript = (() => {
      const r = track?.rounds;
      if (!r) return undefined;
      if (inBreak) return r.roundInterTranscripts?.[currentRound - 1] ?? undefined;
      if (currentRound === 0) return r.introTranscript;
      return r.roundTranscripts?.[currentRound - 1];
    })();
    const tr = roundTranscript ?? track?.transcript;
    // Reset scroll to top for every new audio (new track or new round)
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    expectedScrollY.current = 0;
    userScrollingUntil.current = 0;
    nextScrollAnimated.current = false;
    // Clear previous layout measurements so the new cues are scrolled correctly from the top
    cueLayouts.current = {};
    if (tr) {
      loadTranscript(tr).then((c) => {
        setCues(c);
        // Ensure scroll is parked at the top once the new cues have rendered
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: 0, animated: false });
          expectedScrollY.current = 0;
        });
      }).catch(() => setCues([]));
    } else {
      setCues([]);
    }
  }, [track?.id, currentRound, inBreak]);

  useEffect(() => {
    if (!track || duration <= 0) return;
    if (t >= duration * 0.8) markListened(track.id);
  }, [t, duration, track?.id]);

  useEffect(() => {
    if (!hasStarted || finished) return;
    if (duration <= 0) return;
    if (Date.now() - roundChangedAt.current < 800) return;
    const didFinish = (status as any).didJustFinish || (t > 2 && t >= duration - 0.15 && t < duration + 1 && !status.playing);
    if (didFinish && !endedHandled.current) {
      endedHandled.current = true;
      if (inBreak) {
        // Inter ended → advance to next round
        endBreak();
      } else {
        handleRoundEnd();
      }
    }
  }, [t, duration, status.playing, hasStarted, inBreak, finished]);

  const handleRoundEnd = () => {
    // Stop the current audio immediately so it doesn't bleed into the transition.
    try { player.pause(); } catch {}
    // After intro (round 0), go straight to round 1 with no break
    if (currentRound === 0) {
      setCurrentRound(1);
      endedHandled.current = false;
      roundChangedAt.current = Date.now();
      return;
    }
    const hasMore = track?.rounds && currentRound < selectedRounds;
    if (!hasMore) {
      // No end-of-audio splash — the "AUDIO ENDED" panel added little
      // value and interrupted the after-practice settle. Just dismiss
      // the player; the user lands back wherever they opened it from.
      try { player.pause(); } catch {}
      close();
      return;
    }
    const hasInter = !!track?.rounds?.roundInters?.[currentRound - 1];
    if (hasInter) {
      setInBreak(true);
      roundChangedAt.current = Date.now();
      endedHandled.current = false;
    } else {
      setCurrentRound(r => r + 1);
    }
  };

  const endBreak = () => {
    try { player.pause(); } catch {}
    setInBreak(false);
    setCurrentRound(r => r + 1);
    endedHandled.current = false;
    roundChangedAt.current = Date.now();
  };

  // When the audio source changes (round change or entering/leaving break), start playback.
  useEffect(() => {
    if (!hasStarted || finished) return;
    roundChangedAt.current = Date.now();
    endedHandled.current = false;
    try { player.seekTo(0); player.play(); } catch {}
    const t1 = setTimeout(() => { try { player.play(); } catch {} }, 400);
    return () => clearTimeout(t1);
  }, [currentRound, inBreak, player, hasStarted]);

  useEffect(() => {
    if (finished) { try { player.pause(); } catch {} }
  }, [finished]);

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
    const targetY = Math.max(0, y - 140);
    expectedScrollY.current = targetY;
    const animated = nextScrollAnimated.current;
    nextScrollAnimated.current = false;
    scrollRef.current?.scrollTo({ y: targetY, animated });
  }, [currentCueIdx, t, hasStarted, inBreak]);

  const markUserScrolling = () => {
    userScrollingUntil.current = Date.now() + 5000;
    // Next time the auto-scroll resumes, animate the catch-up
    nextScrollAnimated.current = true;
  };
  const handleUserScroll = (e: any) => {
    const offset = e?.nativeEvent?.contentOffset?.y ?? 0;
    if (Math.abs(offset - expectedScrollY.current) > 30) markUserScrolling();
  };
  const handleScrollBegin = () => markUserScrolling();

  // The RN PanResponder used to drive this scrubber was flaky on Chrome
  // Android — touch events did not consistently register as a responder
  // grant on web. Web now uses raw DOM pointer / touch / mouse listeners
  // attached to the bar element; native keeps PanResponder.
  const progressEl = useRef<View>(null);

  const commitSeek = () => {
    const target = scrubValue.current;
    if (Number.isFinite(target) && target >= 0) {
      try { Promise.resolve(player.seekTo(target)).catch(() => {}); } catch {}
    }
    setScrubbing(false);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: any = progressEl.current;
    const el: HTMLElement | null = node?._nativeRef?._node ?? node ?? null;
    if (!el) return;

    let dragging = false;
    const applyClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      barWidth.current = rect.width;
      seekFromX(x, barWidth, durationRef, scrubValue);
    };

    const onDown = (clientX: number) => {
      dragging = true;
      setScrubbing(true);
      applyClientX(clientX);
    };
    const onMove = (clientX: number) => {
      if (!dragging) return;
      applyClientX(clientX);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      commitSeek();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) onDown(e.touches[0].clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        e.preventDefault(); // prevent page scroll while scrubbing
        onMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => onUp();

    const onMouseDown = (e: MouseEvent) => { onDown(e.clientX); };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const onMouseUp = () => onUp();

    // Touch stays on the element so we can preventDefault. Mouse moves /
    // ups go on the window so a drag that leaves the bar still updates.
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [player]);

  // Native-only PanResponder fallback. On web we ignore these and drive
  // everything through the effect above.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Platform.OS !== 'web',
      onMoveShouldSetPanResponder: () => Platform.OS !== 'web',
      onPanResponderGrant: (e) => {
        setScrubbing(true);
        seekFromX(e.nativeEvent.locationX, barWidth, durationRef, scrubValue);
      },
      onPanResponderMove: (e) => {
        seekFromX(e.nativeEvent.locationX, barWidth, durationRef, scrubValue);
      },
      onPanResponderRelease: commitSeek,
      onPanResponderTerminate: () => setScrubbing(false),
    }),
  ).current;

  if (!track) return null;
  const progress = duration > 0 ? t / duration : 0;
  const playing = status.playing;
  // The expo-audio status reports duration only once the asset is decoded.
  // On slower networks / iOS Safari that can take a moment; guard the UI so
  // the user sees a clear loading state instead of an apparently-broken
  // controls row.
  const isLoading = hasStarted && !finished && (!Number.isFinite(duration) || duration <= 0);
  const canSeek = duration > 0;
  const artwork = track.artwork ?? DEFAULT_ARTWORK;
  const description = track.description ?? (track.rounds ? QM_DESCRIPTION : DEFAULT_DESCRIPTION);
  const rounds = track.rounds;
  // QM tracks (anything with a rounds config) carry the QM tab accent so the
  // player feels visually consistent with where the user opened it from.
  const accent = rounds ? colors.accentAlt : colors.accent;
  const accentBg = rounds ? colors.accentAltSoft : colors.accentSoft;

  // Progress-driven background gradient: the bright spot starts near
  // the bottom at 0s and climbs to the top as the audio plays. The
  // gradient's internal withTiming (~800ms) absorbs scrubs so ±15s
  // jumps ease rather than snap.
  const progressRatio = canSeek && duration > 0
    ? Math.max(0, Math.min(1, t / duration))
    : 0;
  const playerCenterY = 0.80 - progressRatio * 0.65;
  // Palette follows the same SM / QM split as `accent`.
  const gradientPalette = rounds ? GRADIENT_QM : GRADIENT_SM;

  return (
    <View style={styles.root}>
      <AnimatedGradient
        centerY={playerCenterY}
        palette={gradientPalette}
      />
      <View style={styles.header}>
        {!finished ? (
          <Pressable
            onPress={() => { try { player.pause(); } catch {} close(); }}
            hitSlop={12}
          >
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
        <View style={styles.titleRow}>
          {/* Hide the track-switch chevrons on QM sessions — users kept reading
              them as 'next round' and were surprised when the whole audio
              skipped. QM rounds are already navigated from inside the player
              via 'End this round →' / 'Skip to round N+1 →'. */}
          {rounds ? null : (
            <Pressable
              onPress={playPrev}
              disabled={!hasPrev}
              hitSlop={10}
              style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}
            >
              <Text style={[styles.navBtnText, { color: accent }, !hasPrev && styles.navBtnTextDisabled]}>‹</Text>
            </Pressable>
          )}
          <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
          {rounds ? null : (
            <Pressable
              onPress={playNext}
              disabled={!hasNext}
              hitSlop={10}
              style={[styles.navBtn, !hasNext && styles.navBtnDisabled]}
            >
              <Text style={[styles.navBtnText, { color: accent }, !hasNext && styles.navBtnTextDisabled]}>›</Text>
            </Pressable>
          )}
        </View>
        {rounds ? (
          <View style={styles.roundBar}>
            {hasStarted ? (
              <>
                <Text style={[styles.roundBarText, { color: accent }, inBreak && styles.roundBarBreak]}>
                  {currentRound === 0
                    ? 'INTRO'
                    : inBreak
                      ? `· BREAK · between round ${currentRound} and ${currentRound + 1} ·`
                      : `ROUND ${currentRound} / ${selectedRounds}`}
                </Text>
                <View style={styles.dotsRow}>
                  {Array.from({ length: selectedRounds }, (_, i) => {
                    const state = i + 1 < currentRound ? 'done' : i + 1 === currentRound ? 'current' : 'upcoming';
                    return (
                      <View key={i} style={[
                        styles.dot,
                        state === 'done' && styles.dotDone,
                        state === 'current' && [styles.dotCurrent, { backgroundColor: accent }],
                      ]} />
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={[styles.roundBarText, { color: accent }]}>
                QM{rounds.roundLengthMinutes} · {rounds.roundLengthMinutes}-MIN ROUNDS · UP TO {rounds.max}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {/* Middle content area */}
      <View style={styles.middle}>
        {!hasStarted ? (
          <>{/* preplay content below */}
            {Array.isArray(description) ? (
              <View style={styles.descriptionBlock}>
                {description.map((line, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.description,
                      line.style === 'bold' && styles.descriptionBold,
                      line.style === 'italic' && styles.descriptionItalic,
                    ]}
                  >
                    {line.text}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.description}>{description}</Text>
            )}
            {rounds ? (
              <View style={styles.paramsCard}>
                <View style={styles.sliderHeader}>
                  {rounds.introSource ? (
                    <View style={styles.introToggleRow}>
                      <Pressable onPress={() => setIncludeIntro(s => !s)} style={styles.introToggle}>
                        <View style={[styles.switch, includeIntro && [styles.switchOn, { backgroundColor: accent }]]}>
                          <View style={[styles.switchKnob, includeIntro && styles.switchKnobOn]} />
                        </View>
                        <Text style={styles.introToggleText}>Intro</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <Text style={[styles.sliderLabel, { color: accent }]}>ROUNDS</Text>
                  <Text style={styles.sliderValue}>{selectedRounds}<Text style={styles.sliderMax}>/{rounds.max}</Text></Text>
                </View>
                <RoundsSlider max={rounds.max} value={selectedRounds} onChange={setSelectedRounds} accent={accent} />
              </View>
            ) : null}
          </>
        ) : finished ? (
          <View style={styles.finishedBlock}>
            <Text style={[styles.breakLabel, { color: accent }]}>AUDIO ENDED</Text>
            {(() => {
              const prog = track ? trackProgram(track.id) : null;
              if (!prog) return null;
              const href = prog === 'qm' ? '/qm' : '/silent-mind';
              // Labels reuse the tab names verbatim so nothing new has to be
              // validated — users already see 'Silent Mind' / 'QM Format' in
              // the bottom tab bar.
              const label = prog === 'qm' ? 'QM Format →' : 'Silent Mind →';
              return (
                <Pressable
                  // replace so returning from the tab (back button) pops up
                  // to the previous origin instead of stacking detail
                  // pages on top of each other.
                  onPress={() => { close(); router.replace(href); }}
                  style={({ pressed }) => [
                    styles.goTabBtn,
                    { borderColor: accent },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.goTabText, { color: accent }]}>{label}</Text>
                </Pressable>
              );
            })()}
            <Pressable onPress={close} style={[styles.pillPrimary, { backgroundColor: accent }]}>
              <Text style={styles.pillPrimaryText}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.transcriptFrame, inBreak && styles.transcriptFrameBreak]}>
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
                  <CueLine key={i} cue={cue} time={t} onLayout={(y) => { cueLayouts.current[i] = y; }} />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noTranscript}>
                <Text style={styles.noTranscriptText}>
                  {track.transcript ? 'Loading transcript…' : (inBreak ? 'Interlude…' : 'No transcript for this audio.')}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Bottom area — fixed structure so the CircleButton anchors at the same Y across states */}
      <View style={styles.bottomArea}>
        <View style={styles.circleRow}>
          {hasStarted && !finished && canSeek ? (
            <Pressable onPress={() => player.seekTo(Math.max(0, t - 15))} style={styles.sideBtn}>
              <Text style={styles.sideBtnText}>-15s</Text>
            </Pressable>
          ) : <View style={styles.sideBtnPlaceholder} />}

          {finished ? (
            <View style={{ width: circleSize, height: circleSize }} />
          ) : isLoading ? (
            <View style={[styles.loadingCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}>
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : !hasStarted ? (
            <CircleButton
              size={circleSize}
              mode="pre"
              accent={accent}
              onPress={() => {
                const startAtIntro = rounds?.introSource && includeIntro;
                setHasStarted(true);
                setCurrentRound(startAtIntro ? 0 : 1);
                endedHandled.current = false;
                // Do NOT call player.play() here — the current `player` may still
                // be loaded with the previous round's source. The source-change
                // useEffect below owns playback start once the new source is live.
              }}
            />
          ) : (
            <CircleButton size={circleSize} mode={playing ? 'playing' : 'paused'} accent={accent} onPress={() => { playing ? player.pause() : player.play(); }} />
          )}

          {hasStarted && !finished && canSeek ? (
            <Pressable onPress={() => player.seekTo(Math.min(duration, t + 15))} style={styles.sideBtn}>
              <Text style={styles.sideBtnText}>+15s</Text>
            </Pressable>
          ) : <View style={styles.sideBtnPlaceholder} />}
        </View>

        <View style={styles.aboveCircle}>
          {hasStarted && !finished ? (
            <View style={styles.progressWrap}>
              <View
                ref={progressEl}
                style={styles.progressHit}
                onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
                {...pan.panHandlers}
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: accent }]} />
                  <View style={[styles.progressThumb, { left: `${Math.min(100, progress * 100)}%`, backgroundColor: accent }]} />
                </View>
              </View>
              <View style={styles.timesRow}>
                <Text style={styles.time}>{fmt(t)}</Text>
                <Text style={styles.time}>{fmt(duration)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.belowCircle}>
          {!hasStarted ? (
            <Text style={styles.durationHint}>
              {rounds
                ? `${selectedRounds} × ${rounds.roundLengthMinutes} min · break 1 min`
                : duration > 0
                  ? `${fmt(duration)} — start when you are ready`
                  : 'Loading…'}
            </Text>
          ) : inBreak ? (
            <Pressable onPress={endBreak} style={styles.nextRoundBtn}>
              <Text style={[styles.nextRoundText, { color: accent }]}>Skip to round {currentRound + 1} →</Text>
            </Pressable>
          ) : finished ? null : rounds ? (
            <Pressable onPress={handleRoundEnd} style={styles.nextRoundBtn}>
              <Text style={[styles.nextRoundText, { color: accent }]}>
                {currentRound === 0 ? 'Skip intro →' : 'End this round →'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      </View>
    </View>
  );
}

function RoundsSlider({ max, value, onChange, accent = colors.accent }: { max: number; value: number; onChange: (n: number) => void; accent?: string }) {
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
        <View style={[styles.sliderFill, { width: `${frac * 100}%`, backgroundColor: accent }]} />
      </View>
      {Array.from({ length: max }, (_, i) => {
        const f = max > 1 ? i / (max - 1) : 0;
        return (
          <View key={i} style={[
            styles.sliderTick,
            { left: `${f * 100}%` },
            i + 1 <= value && [styles.sliderTickActive, { backgroundColor: accent }],
          ]} />
        );
      })}
      <View style={[styles.sliderThumb, { left: `${frac * 100}%`, backgroundColor: accent }]} />
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
  // Transparent so the absolutely-positioned AnimatedGradient (first
  // child) is visible. The outer `overlay` still carries `colors.bg` as
  // a fallback solid, and the gradient's own edge stops fade to near-
  // black opacity 1 so there's no "see-through" effect.
  root: { flex: 1, backgroundColor: 'transparent', paddingTop: 56 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    width: '100%',
    maxWidth: PLAYER_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  close: { ...type.caption, color: colors.text },
  eyebrow: { ...type.overline, color: colors.textMuted, fontSize: 10 },
  top: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 4 },
  artwork: {
    width: 90, height: 90, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs, overflow: 'hidden',
    borderColor: colors.border, borderWidth: 1,
  },
  artworkLarge: { width: 130, height: 130 },
  artworkImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  artworkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,16,46,0.35)' },
  title: { ...type.h1, color: colors.text, textAlign: 'center', fontSize: 18, flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, width: '100%', paddingHorizontal: spacing.md },
  navBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderColor: colors.border, borderWidth: 1,
    backgroundColor: colors.surface,
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { ...type.display, color: colors.accent, fontSize: 22, lineHeight: 24, marginTop: -2 },
  navBtnTextDisabled: { color: colors.textDim },
  roundBar: { alignItems: 'center', gap: 6, minHeight: 24 },
  roundBarText: { ...type.overline, color: colors.accent, fontSize: 10, textAlign: 'center' },
  roundBarBreak: {
    color: colors.textMuted,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
    letterSpacing: 2,
    overflow: 'hidden',
  },

  preplay: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.sm + 4 },
  preplayLegacy: { display: 'none' },
  description: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 360, fontSize: 13, lineHeight: 20 },
  descriptionBlock: { alignItems: 'center', gap: 6, maxWidth: 380 },
  descriptionBold: { color: colors.text, fontFamily: 'Montserrat_800ExtraBold', fontSize: 15, lineHeight: 22, marginBottom: 6, textAlign: 'center' },
  descriptionItalic: { fontStyle: 'italic' },
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
  finishedBlock: { alignItems: 'center', gap: spacing.md },
  goTabBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  goTabText: { ...type.overline, fontSize: 11, letterSpacing: 1.5 },
  breakButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'center' },

  pill: { paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderColor: colors.border, borderWidth: 1 },
  pillText: { ...type.caption, color: colors.text },
  pillPrimary: { paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.accent },
  pillPrimaryText: { ...type.h3, color: colors.text, fontSize: 14 },

  // Cap the vertical stack of player content (artwork, title, middle
  // transcript/params, bottom controls) at the shared CONTENT_MAX_WIDTH
  // so on tablet the title, transcript frame and controls stop
  // spreading edge-to-edge. Header (Close) and overlay bg stay full-width.
  body: {
    flex: 1,
    flexDirection: 'column',
    width: '100%',
    maxWidth: PLAYER_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm + 2, minHeight: 0 },
  bottomArea: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, alignItems: 'center' },
  aboveCircle: { width: '100%', minHeight: 42, justifyContent: 'center', marginTop: spacing.sm },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    // A pinch taller than the default circle so the row vertically
    // fits both phone (108) and tablet (160) sizes without wrapping.
    minHeight: DEFAULT_CIRCLE_SIZE + 8,
  },
  sideBtnPlaceholder: { width: 0, height: 0 },
  belowCircle: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  roundHeader: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 6 },
  roundText: { ...type.overline, color: colors.accent, fontSize: 11 },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotCurrent: { backgroundColor: colors.accent, width: 20 },
  dotDone: { backgroundColor: colors.text, opacity: 0.7 },

  transcriptFrame: {
    height: 220,
    // Stretch to the parent's content width rather than shrinking to
    // the text inside. The `middle` column uses `alignItems: center`
    // which would otherwise collapse this frame whenever cues are
    // short, making the panel width jump around between tracks.
    alignSelf: 'stretch',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  transcriptFrameBreak: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  transcriptContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  cue: { ...type.body, fontSize: 16, lineHeight: 26, marginBottom: spacing.sm },
  noTranscript: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  noTranscriptText: { ...type.caption, color: colors.textDim, textAlign: 'center' },

  controls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, paddingTop: spacing.xs },
  // Larger vertical hit zone + explicit cursor/touch hint so the bar
  // reliably captures taps & drags. Also prevents the browser from
  // claiming the gesture as a page scroll on Chrome Android.
  // Cap the progress bar width so on tablet / wide viewports the
  // timebar + its times row don't span the full screen.
  progressWrap: {
    width: '100%',
    maxWidth: PLAYER_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  progressHit: {
    paddingVertical: spacing.md,
    justifyContent: 'center',
    ...(typeof document !== 'undefined' ? ({ touchAction: 'none', cursor: 'pointer' } as any) : null),
  },
  progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, position: 'relative' },
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
  loadingCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  loadingText: { ...type.overline, color: colors.textMuted, fontSize: 10 },
});
