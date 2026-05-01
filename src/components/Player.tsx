import { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, PanResponder, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Asset } from 'expo-asset';
import { useRouter } from 'expo-router';
import { useLayout, CONTENT_MAX_WIDTH as PLAYER_CONTENT_MAX_WIDTH } from '../hooks/useLayout';
import { usePlayerStore } from '../player/store';
import { useProgress } from '../player/progressStore';
import { loadTranscript } from '../content/loadTranscript';
import { findCueIndex, TranscriptCue } from '../content/transcript';
import { trackProgram, trackLocation } from '../content/catalog';
import { resolveAudioSource, prefetchAudio } from '../content/audioResolver';
import { getAudioSource, getInterSource, getTranscriptSource, getInterTranscriptSource } from '../content/audioRegistry';
import { WAVEFORMS } from '../content/waveforms.generated';
import { colors, radius, spacing, type } from '../theme';
import { noOrphan } from '../utils/noOrphan';
import { CircleButton } from './CircleButton';
import { WaveformProgress } from './WaveformProgress';

/**
 * Normalize a filename stem into the same key used by scripts/gen-waveforms.mjs.
 * Keeping the transform in sync matters: the script writes keys like
 * "one_minute_meditation" and the Player must produce the same for lookup.
 */
function waveformKey(name: string): string {
  return name
    // Strip any trailing audio extension — on web Asset.name includes
    // ".mp3" whereas native gives just the stem, and our generated keys
    // are always extensionless.
    .replace(/\.(mp3|wav|m4a|ogg)$/i, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Look up the precomputed peaks array for a given `require()`'d mp3 source.
 * Tries `Asset.name` first (stem without extension), falls back to parsing
 * the asset uri — which is what web/dev serves when Asset.name isn't
 * populated synchronously. Returns undefined on any miss; the player falls
 * back to the thin progress bar.
 */
function peaksForSource(source: any): number[] | undefined {
  if (source == null) return undefined;
  let stem: string | undefined;
  try {
    if (typeof source === 'string') {
      // Remote URL — derive stem from the last path segment.
      const last = source.split('?')[0].split('/').pop() || '';
      stem = decodeURIComponent(last).replace(/\.(mp3|wav|m4a|ogg)$/i, '');
    } else {
      const asset: any = Asset.fromModule(source);
      stem = asset?.name;
      if (!stem && typeof asset?.uri === 'string') {
        const last = asset.uri.split('?')[0].split('/').pop() || '';
        stem = decodeURIComponent(last)
          .replace(/\.[a-f0-9]{6,}\.(mp3|wav|m4a|ogg)$/i, '')
          .replace(/\.(mp3|wav|m4a|ogg)$/i, '');
      }
    }
    if (!stem) return undefined;
    const key = waveformKey(stem);
    const hit = WAVEFORMS[key];
    if (!hit && typeof console !== 'undefined') {
      if (!(globalThis as any).__wfMiss) (globalThis as any).__wfMiss = new Set<string>();
      const miss = (globalThis as any).__wfMiss as Set<string>;
      if (!miss.has(key)) { miss.add(key); console.warn('[waveforms] miss for key:', key, '(stem:', stem, ')'); }
    }
    return hit;
  } catch {
    return undefined;
  }
}

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
      entering={FadeIn.duration(320)}
      exiting={FadeOut.duration(260)}
      style={styles.overlay}
    >
      <PlayerInner />
    </Animated.View>
  );
}

// Transcript now reveals progressively: future words stay invisible
// until shortly before they're spoken, then fade in. Already-spoken
// words remain on screen at a muted opacity so the reader keeps
// context, while the word being spoken briefly brightens to peak via
// the existing sweep. The page therefore fills word-by-word as the
// audio plays rather than pre-rendering the whole transcript dim.
//
//   SWEEP_WINDOW    — seconds around the word centre where the
//                     "current" highlight peaks
//   PAST_OPACITY    — resting opacity for words already said (context)
//   PEAK_OPACITY    — opacity at the centre of the current word
//   FADE_IN_LEAD    — seconds before a word's start when it begins to
//                     appear (small, so the word feels like it shows up
//                     just in time, not pre-lit)
const SWEEP_WINDOW = 3;
const PAST_OPACITY = 0.55;
const PEAK_OPACITY = 1;
const FADE_IN_LEAD = 0.4;
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
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Match the Start screen's `playSize` formula exactly so the round
  // CircleButton lands at the same pixel size when the user taps
  // through. Any divergence here breaks the morph illusion.
  const usableH = Math.max(360, winH - insets.top - insets.bottom);
  const circleSize = isTablet
    ? Math.max(180, Math.min(240, Math.round(usableH / 5.0)))
    : Math.max(120, Math.min(160, Math.round(usableH / 5.5)));
  const { track, close, playlist, index, playNext, playPrev } = usePlayerStore();
  const hasNext = index >= 0 && index < playlist.length - 1;
  const hasPrev = index > 0;
  const markListened = useProgress(s => s.markListened);
  // Subscribe to the listened map directly (not the `isListened` getter
  // — Zustand re-runs selectors on every store change, but a function
  // reference doesn't trigger React re-renders) so the "Already
  // listened" pill flips off the moment a fresh track is opened and
  // back on once the current track crosses the 80 % mark.
  const listened = useProgress(s => s.listened);

  const [selectedRounds, setSelectedRounds] = useState(track?.rounds?.max ?? 1);
  const [includeIntro, setIncludeIntro] = useState(!!track?.rounds?.introSource);
  // Lazy init mirrors the [track?.id] effect's branching so the very
  // first render already lands on the right round source + transcript
  // when the Player is opened with autoStart=true. Without this, the
  // initial render briefly used currentRound=1 (or in earlier code,
  // `rounds.max`) which fired off a stale transcript load that could
  // win the race against the intro transcript — the user heard the
  // intro voice but saw a round-1 / round-N transcript on screen.
  const [currentRound, setCurrentRound] = useState<number>(() => {
    if (!track) return 1;
    const auto = usePlayerStore.getState().autoStart;
    if (auto && track.rounds?.introSource) return 0;
    return 1;
  });
  // Same idea for hasStarted: when autoStart is true at mount we want
  // the playback chain to engage immediately, not flash the pre-play
  // screen before flipping to true on next render.
  const [hasStarted, setHasStarted] = useState<boolean>(() =>
    usePlayerStore.getState().autoStart,
  );
  const [inBreak, setInBreak] = useState(false);
  const [finished, setFinished] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const endedHandled = useRef(false);
  const roundChangedAt = useRef(0);

  const roundSource = (() => {
    if (!track) return undefined;
    const r = track.rounds;
    if (inBreak) {
      const interSrc = r?.roundInters?.[currentRound - 1];
      if (interSrc) return interSrc;
      // Remote round-based tracks: derive canonical URL via registry so
      // peaksForSource can extract the filename stem and find the waveform.
      return getInterSource(track.id, currentRound - 1)?.remote ?? undefined;
    }
    if (currentRound === 0) return r?.introSource;
    if (r?.roundSources && r.roundSources[currentRound - 1]) return r.roundSources[currentRound - 1];
    if (track.source) return track.source;
    // Remote audio (cached or streaming): prefer the canonical remote URL
    // for the waveform lookup. resolvedUri rotates between
    //   https://allhere.org/.../1.-Welcome.mp3   (streaming, key matches)
    //   file:///cache/audio_intro_1.mp3          (cached, key DOESN'T match)
    // — so always prefer the registry's remote URL when present.
    const roundIdx = r ? Math.max(0, currentRound - 1) : undefined;
    const remote = getAudioSource(track.id, roundIdx)?.remote;
    return remote ?? resolvedUri ?? undefined;
  })();

  /**
   * Source we'll need NEXT — used to prefetch ahead so the gap between
   * rounds (decode + fetch when the player switches source) is shrunk.
   * Mirrors `roundSource` above:
   *   intro (round 0)  → next is round 1
   *   round N          → next is inter N (if any) else round N+1
   *   inter N          → next is round N+1
   */
  const nextRoundSource = (() => {
    if (!track?.rounds) return undefined;
    const r = track.rounds;
    if (inBreak) return r.roundSources?.[currentRound] ?? undefined;
    if (currentRound === 0) return r.roundSources?.[0];
    const interN = r.roundInters?.[currentRound - 1];
    if (interN) return interN;
    if (currentRound < selectedRounds) return r.roundSources?.[currentRound];
    return undefined;
  })();

  // Only create player once we have a resolved URI
  const player = useAudioPlayer(resolvedUri ?? undefined);
  const status = useAudioPlayerStatus(player);

  const [cues, setCues] = useState<TranscriptCue[]>([]);
  const [scrubbing, setScrubbing] = useState(false);
  // While the player is catching up after a seek, `pendingSeekTo` holds
  // the target position so the timeline keeps showing it instead of
  // snapping back to the stale `status.currentTime`. Cleared by an
  // effect once status.currentTime lands within ~0.4 s of the target,
  // OR after a 600 ms safety timeout in case the seek failed silently.
  const [pendingSeekTo, setPendingSeekTo] = useState<number | null>(null);
  const scrubValue = useRef(0);
  const barWidth = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const cueLayouts = useRef<Record<number, number>>({});
  const userScrollingUntil = useRef(0);
  const expectedScrollY = useRef(0);
  const nextScrollAnimated = useRef(false);

  // Resolve audio source (bundled or remote with download)
  useEffect(() => {
    if (!track?.id) {
      setResolvedUri(null);
      setResolveError(null);
      return;
    }

    // Determine round index for resolution
    let roundIndex: number | undefined;
    if (track.rounds) {
      if (currentRound === 0) {
        roundIndex = undefined; // Intro (no round index)
      } else if (inBreak) {
        roundIndex = currentRound - 1; // Inter is between rounds
      } else {
        roundIndex = currentRound - 1; // Regular round
      }
    }

    const resolve = async () => {
      setIsResolving(true);
      setResolveError(null);
      try {
        const resolved = await resolveAudioSource(
          track.id,
          roundIndex,
          inBreak,
          (bytes, total) => {
            if (total > 0) setDownloadProgress(Math.round((bytes / total) * 100));
          },
        );
        setResolvedUri(resolved.uri);
        setDownloadProgress(0);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to resolve audio';
        setResolveError(msg);
        console.error('Audio resolution error:', err);
      } finally {
        setIsResolving(false);
      }
    };

    resolve();
  }, [track?.id, currentRound, inBreak]);

  // Prefetch next round of the current track AND the next track in the
  // playlist while playback is going so the user gets instant start when
  // they advance — no buffering wait at the segue.
  useEffect(() => {
    if (!status.playing || !track?.id) return;
    prefetchAudio(`${track.id}-next-${currentRound + 1}`).catch(() => {});
    const nextInPlaylist = playlist[index + 1];
    if (nextInPlaylist?.id) {
      prefetchAudio(nextInPlaylist.id).catch(() => {});
    }
  }, [status.playing, track?.id, currentRound, playlist, index]);

  // (Offline download UI moved to ContentCard via TrackCard — see
  // useTrackDownload hook. The Player no longer carries that affordance.)

  // Reset smooth time whenever the audio source identity changes (new track, round, or break)
  const sourceKey = `${track?.id ?? 'none'}|${inBreak ? 'b' : 'r'}|${currentRound}`;

  // ---------------------------------------------------------------
  // Engine state machine — derived from expo-audio's status fields.
  // The Player UI was originally built for fully-bundled audio where
  // duration is known instantly and seek is free; streaming from
  // WordPress added a 'buffering' phase that the old code conflated
  // with 'playing' (status.playing stays true while AVPlayer waits
  // for bytes to arrive). The fix is a single derived state that
  // every UI / timeline rule keys off:
  //
  //   preplay   — user hasn't tapped Begin yet
  //   loading   — initial decode (duration not yet known)
  //   buffering — mid-playback wait for more bytes (post-seek rebuffer)
  //   playing   — actually emitting audio
  //   paused    — user paused; source loaded
  //   ended     — track finished
  //   error     — resolveAudioSource threw
  // ---------------------------------------------------------------
  // Cross-platform buffering detection. iOS sets timeControlStatus to
  // "waiting" while AVPlayer rebuffers. Web HTMLAudioElement sets
  // status.isBuffering. We trust either signal.
  const isBuffering =
    (status as any).timeControlStatus === 'waiting' ||
    (status as any).isBuffering === true ||
    (player as any)?.isBuffering === true;
  // Source has been decoded enough to compute duration / metadata.
  const isDecoded =
    (status as any).isLoaded === true ||
    (Number.isFinite(status.duration) && status.duration > 0);
  // Audio playhead is actually advancing (proof real audio is coming
  // out, not just that the engine accepted a play command). Without
  // this gate, status.playing flipped true the instant we sent
  // player.play() — even if buffering wasn't done — and the play
  // button briefly showed "playing", flickered to "paused" while the
  // browser actually buffered, then back to "playing". Now we stay in
  // 'buffering' until currentTime is past the seek/start position.
  const advancing =
    Number.isFinite(status.currentTime) && status.currentTime > 0.05;
  type EngineState =
    | 'preplay' | 'loading' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';
  const engineState: EngineState = (() => {
    if (resolveError) return 'error';
    if (!hasStarted) return 'preplay';
    if (finished) return 'ended';
    // No metadata AND nothing's playing yet → initial decode in progress
    if (!isDecoded && !advancing) return 'loading';
    // Engine is waiting for bytes (mid-stream rebuffer or, after the
    // user pressed play, still pre-rolling). status.playing is a poor
    // signal here — treat it as buffering until we see currentTime
    // actually move forward.
    if (isBuffering) return 'buffering';
    if (status.playing && !advancing) return 'buffering';
    if (status.playing) return 'playing';
    return 'paused';
  })();
  // Treat ONLY the true-playing state as "audio actually advancing".
  // useSmoothTime extrapolates when its `playing` arg is true; without
  // this gate the timeline kept walking forward during buffering.
  const actuallyPlaying = engineState === 'playing';
  const liveT = useSmoothTime(status.currentTime, actuallyPlaying, sourceKey);
  // Pin `t` to the user's drag while scrubbing, then to the seek
  // target while expo-audio catches up — *only* fall back to the live
  // current-time once the catch-up has converged. This kills the
  // "frame-jumps-back-then-forward" ghost on release: previously the
  // moment we cleared `scrubbing` the UI snapped to whatever
  // `status.currentTime` still reported (the OLD position), then a
  // tick later jumped to the seek target as the player updated.
  const t = scrubbing
    ? scrubValue.current
    : pendingSeekTo != null
      ? pendingSeekTo
      : liveT;
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
    // Don't null resolvedUri here. On web, useAudioPlayer with a null
    // source then a fresh URL sometimes left the AudioPlayer instance
    // in a state where the new source never started — QM Center of
    // Gravity (qm1-4 round 1) was the canary. The cleanup below
    // already pauses the outgoing player; once the resolve effect
    // produces the new URI, expo-audio swaps cleanly.
    setPendingSeekTo(null);
    return () => { try { player.pause(); } catch {} };
  }, [track?.id]);

  useEffect(() => {
    // Prefer round-specific transcript when playing a segmented round / inter.
    // Fallback chain (most-specific first → least):
    //  1. track.rounds.roundTranscripts / .roundInterTranscripts (catalog
    //     hardcoded — rare, used for the home QM3 quick start)
    //  2. track.transcript (single-audio tracks)
    //  3. audioRegistry.getTranscriptSource(track.id, roundIdx, isInter) —
    //     resolves bundled .wjson based on track id + round index, covering
    //     the QM tracks that don't carry transcripts in the catalog directly
    //     (qm1-4, qm2-3, etc. used to render "No transcript for this audio"
    //     even though the .wjson files were bundled).
    const r = track?.rounds;
    let tr: number | string | null | undefined;
    if (r) {
      if (inBreak) {
        tr = r.roundInterTranscripts?.[currentRound - 1] ?? undefined;
        if (tr == null && track?.id) {
          const fb = getInterTranscriptSource(track.id, currentRound - 1);
          tr = fb?.bundled ?? fb?.remote ?? null;
        }
      } else if (currentRound === 0) {
        tr = r.introTranscript;
        if (tr == null && track?.id) {
          const fb = getTranscriptSource(track.id);
          tr = fb?.bundled ?? fb?.remote ?? null;
        }
      } else {
        tr = r.roundTranscripts?.[currentRound - 1];
        if (tr == null && track?.id) {
          const fb = getTranscriptSource(track.id, currentRound - 1);
          tr = fb?.bundled ?? fb?.remote ?? null;
        }
      }
    } else {
      tr = track?.transcript;
      if (tr == null && track?.id) {
        const fb = getTranscriptSource(track.id);
        tr = fb?.bundled ?? fb?.remote ?? null;
      }
    }
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

  // Pre-fetch the upcoming round / inter when the current segment is
  // past 70% of its duration — shrinks the audible gap when expo-audio
  // swaps `roundSource` (decode + fetch are paid in advance). Web-only:
  // on native every asset is bundled at build time so `downloadAsync`
  // is a no-op AND, on Metro dev builds, it triggers an asset HTTP
  // request that Metro currently mis-decodes ("ENOENT .%2Fassets%2F…").
  // On the web side the source is genuinely fetched at use time, so
  // prefetching there is a real round-trip win.
  const preloadFiredFor = useRef<unknown>(undefined);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!nextRoundSource || !duration || duration <= 0) return;
    if (t < duration * 0.7) return;
    if (preloadFiredFor.current === nextRoundSource) return;
    preloadFiredFor.current = nextRoundSource;
    try {
      Asset.fromModule(nextRoundSource).downloadAsync().catch(() => {});
    } catch { /* require() handle invalid for non-asset modules */ }
  }, [t, duration, nextRoundSource]);
  // Reset the prefetched sentinel whenever the playing source changes
  // so the next round prefetches its OWN successor (instead of staying
  // pinned to the previously-prefetched one).
  useEffect(() => { preloadFiredFor.current = undefined; }, [roundSource]);

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

  // When the audio source URL changes (initial resolve, round change,
  // entering/leaving break), kick off playback. Critically depends on
  // `resolvedUri` rather than `player` — useAudioPlayer reuses the
  // same JS object reference across source changes on web, so an
  // effect keyed on `player` never re-fired after the resolve effect
  // populated the URL. QM Center of Gravity (qm1-4) was the canary:
  // mount → effect fires with no source → no-op → resolve completes
  // → useAudioPlayer updates source → player ref unchanged → effect
  // never re-fires → audio never starts. Now the effect fires every
  // time resolvedUri actually changes.
  useEffect(() => {
    if (!resolvedUri || !hasStarted || finished) return;
    roundChangedAt.current = Date.now();
    endedHandled.current = false;
    const kick = () => {
      try {
        player.seekTo(0);
        // expo-audio types play() as void, but on web it actually
        // returns a Promise that can reject (autoplay policy / format
        // errors). Cast through unknown so TS doesn't fight the
        // truthiness check.
        const p = player.play() as unknown as Promise<void> | undefined;
        if (p && typeof p.then === 'function') {
          p.catch((err) =>
            console.warn('[Player] play() rejected:', err),
          );
        }
      } catch (err) {
        console.warn('[Player] play() threw:', err);
      }
    };
    kick();
    const t1 = setTimeout(kick, 400);
    return () => clearTimeout(t1);
  }, [resolvedUri, hasStarted, finished, player]);

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
    // Offset chosen to land the current line near the top third of the
    // 130 px transcript window (≈ 50 px below the top of the visible
    // band, just past the CSS mask fade). The previous 140 px offset
    // was tuned for the old 180 px frame and pushed the current line
    // off the bottom of the now-shorter window — the karaoke felt
    // late vs the voice. Smaller offset = scroll triggers earlier =
    // current word stays visible.
    const targetY = Math.max(0, y - 50);
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

  /**
   * Seek that actually flushes the buffer on streamed remote audio.
   * expo-audio (AVPlayer on iOS) sometimes ignores a bare seekTo while
   * it's still feeding already-buffered bytes — the audio keeps playing
   * from the old position and the UI freezes until status.currentTime
   * crosses the target. Pause → seek → play forces AVPlayer to drop the
   * existing buffer and issue a fresh Range request from the new offset
   * (WP serves 206 Partial Content, so this works against allhere.org).
   * Also pins pendingSeekTo so the timeline holds at the target until
   * the player reports the new currentTime.
   *
   * Guarded against rapid overlapping seeks (multiple ±15 taps, scrub
   * + tap mix): only the latest seek's resume actually fires. Without
   * this we observed a trembling loop where stale resume calls played
   * briefly from the old position before the next seek landed.
   */
  // Intent flag: true when the user was playing right before a seek,
  // meaning "I want playback to resume as soon as the audio at the
  // new offset is ready". The seek-then-play sequence sometimes loses
  // the play() call (engine in a transient state, web's seekTo
  // resolving before the audio is buffered), leaving the user staring
  // at a paused engine even though they never pressed pause. The
  // engineState effect below retries play() until 'playing' lands or
  // the user takes manual control.
  const intentToPlay = useRef(false);
  const seekInFlight = useRef(0);
  const seekAndResume = (target: number) => {
    if (!Number.isFinite(target) || target < 0) return;
    const id = ++seekInFlight.current;
    const wasPlaying = !!status.playing;
    if (wasPlaying) intentToPlay.current = true;
    try { player.pause(); } catch {}
    const resume = () => {
      if (id !== seekInFlight.current) return; // superseded by a newer seek
      if (wasPlaying) { try { player.play(); } catch {} }
    };
    try {
      Promise.resolve(player.seekTo(target)).then(resume).catch(resume);
    } catch {
      resume();
    }
    setPendingSeekTo(target);
  };

  // Retry play() while the user's intent is "should be playing" but
  // the engine settled into 'paused' after a seek/rebuffer cycle.
  // Only kicks during 'paused' state; 'buffering' / 'loading' are
  // transient and don't need a nudge — wait them out.
  useEffect(() => {
    if (!intentToPlay.current) return;
    if (engineState === 'playing') {
      intentToPlay.current = false;
      return;
    }
    if (engineState === 'paused') {
      try { player.play(); } catch {}
    }
  }, [engineState, player]);

  const commitSeek = () => {
    seekAndResume(scrubValue.current);
    setScrubbing(false);
  };

  // Release the post-seek pin only once playback ACTUALLY resumes at
  // the target — i.e. engineState transitioned out of 'buffering' AND
  // currentTime landed near the target. The earlier check (just
  // |currentTime - target| < 0.5) cleared the pin while the engine
  // was still rebuffering, so the timeline briefly snapped back to a
  // stale currentTime before jumping to the new position. Safety
  // timeout 4s for slow networks; the user can scrub again to retry.
  useEffect(() => {
    if (pendingSeekTo == null) return;
    const converged =
      engineState === 'playing' &&
      Math.abs(status.currentTime - pendingSeekTo) < 0.5;
    if (converged) {
      setPendingSeekTo(null);
      return;
    }
    const id = setTimeout(() => setPendingSeekTo(null), 4000);
    return () => clearTimeout(id);
  }, [pendingSeekTo, status.currentTime, engineState]);

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
  //
  // We bounce commitSeek through a ref because PanResponder.create() is
  // captured ONCE in useRef — its handler closures freeze to the first-
  // render values of `player`, `status.playing`, etc. At first render
  // resolvedUri is still null, so `player` is the empty placeholder
  // useAudioPlayer hands out before a source lands. Calling
  // player.seekTo() on that frozen reference would no-op while the
  // real audio (created on the next render once resolvedUri arrives)
  // keeps playing from its old position — the symptom: timeline drag
  // moves the visual but audio stays put. ±15 s buttons sidestep this
  // because their inline onPress closures re-bind every render.
  const commitSeekRef = useRef(commitSeek);
  useEffect(() => { commitSeekRef.current = commitSeek; });
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
      onPanResponderRelease: () => commitSeekRef.current(),
      onPanResponderTerminate: () => setScrubbing(false),
    }),
  ).current;

  if (!track) return null;
  const progress = duration > 0 ? t / duration : 0;
  const playing = status.playing;
  // Mirror playing state into the store so the global RippleField (and
  // any future ambient ui) can react without subscribing to expo-audio.
  useEffect(() => {
    usePlayerStore.getState().setPlaying(!!playing);
    return () => { usePlayerStore.getState().setPlaying(false); };
  }, [playing]);
  // The expo-audio status reports duration only once the asset is decoded.
  // On slower networks / iOS Safari that can take a moment; guard the UI so
  // the user sees a clear loading state instead of an apparently-broken
  // controls row.
  // Loading UI fires for BOTH the initial decode and a mid-playback
  // rebuffer (e.g. after a seek into unbuffered territory) — the
  // engineState machine collapses both into "user pressed play but no
  // audio is coming out yet", which is exactly the state where the
  // spinner belongs.
  const isLoading = engineState === 'loading' || engineState === 'buffering';
  const canSeek = duration > 0;
  const description = track.description ?? (track.rounds ? QM_DESCRIPTION : DEFAULT_DESCRIPTION);
  const rounds = track.rounds;
  // QM tracks (anything with a rounds config) carry the QM tab accent so the
  // player feels visually consistent with where the user opened it from.
  const accent = rounds ? colors.accentAlt : colors.accent;
  const accentBg = rounds ? colors.accentAltSoft : colors.accentSoft;

  // Precomputed waveform peaks for the currently-playing audio source.
  // QM rounds + inters have unique filenames (session-tag prefixed), so
  // every source maps to its own peaks. Falls back to the thin progress
  // bar only when the lookup genuinely misses (new audio not yet in the
  // generated map — rerun `npm run gen:waveforms`).
  const peaks = useMemo(
    () => peaksForSource(roundSource),
    [roundSource],
  );

  // Voice envelope at the current playback time. Peaks are dense
  // (≈20 / s = 50 ms per bucket — see scripts/gen-waveforms.mjs), so a
  // single index lookup already tracks the voice tightly. We average a
  // tiny ±2-bucket window (~250 ms total) to take the edge off
  // single-bucket transients without lagging the syllable.
  const voiceLevel = useMemo(() => {
    if (!peaks || peaks.length === 0) return 0;
    if (!playing || !canSeek || duration <= 0) return 0;
    const frac = Math.max(0, Math.min(1, t / duration));
    const idx = Math.min(peaks.length - 1, Math.floor(frac * peaks.length));
    const lo = Math.max(0, idx - 2);
    const hi = Math.min(peaks.length - 1, idx + 2);
    let sum = 0, n = 0;
    for (let i = lo; i <= hi; i++) { sum += peaks[i] ?? 0; n++; }
    return n > 0 ? sum / n : 0;
  }, [peaks, t, duration, playing, canSeek]);

  return (
    <View style={styles.root}>
      {/* No internal gradient — the root layout already paints the
          shared atmospheric gradient + EnergyColumn behind everything,
          so the Player UI fades in OVER the same backdrop the Start
          screen had. Reads as the same screen morphing rather than a
          modal on top. */}
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
        {/* Track title used to live up here at the top of the window;
            it now sits right above the play circle (mirroring the
            Start screen's stack) so the screen-to-screen morph feels
            continuous. We keep just the round bar at the top — purely
            a "where am I in this session" status row. */}
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
      {/* Flex spacer pushing the circle down so it lands at roughly
          the same Y as the Start screen's round CTA — the morph
          illusion only works if both buttons share the same screen
          position. Below the circle, the transcript (also flex 1)
          fills the remaining mid-section, with the timer + waveform
          docked at the bottom. */}
      <View style={styles.flexSpacer} />

      {/* Pre-circle stack — mirrors the Start screen's text block
          ("INTRODUCTION · 1 / 3" eyebrow + track title + chevrons)
          so when Start fades into Player the eye doesn't have to
          re-find the title. The eyebrow used to be on Start and is
          now here only; the title used to be at the very top of the
          Player window and now sits at this Start-matching Y. */}
      {(() => {
        const loc = trackLocation(track.id);
        const alreadyListened = !!listened[track.id];
        return (
          <View style={styles.preCircle}>
            {loc ? (
              <Text style={styles.preCircleEyebrow} numberOfLines={1}>
                {loc.label.toUpperCase()} · {loc.position} / {loc.total}
              </Text>
            ) : null}
            {/* Tiny "you've heard this one" tag, rendered between the
                location eyebrow and the title. Surfaces the per-track
                progress mark (set once playback crosses 80 %) so the
                user knows whether they're revisiting or hearing it for
                the first time. Hidden once they hit play and the track
                advances — at that point the play state is its own cue. */}
            {alreadyListened && !hasStarted ? (
              <Text style={styles.preCircleListenedTag} numberOfLines={1}>
                ✓ Already listened
              </Text>
            ) : null}
            <View style={styles.titleRow}>
              {/* Track-switch chevrons: hidden on QM sessions — users
                  kept reading them as 'next round' and were surprised
                  when the whole audio skipped. QM rounds are navigated
                  from inside the player via 'End this round →'. */}
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
              <Text style={styles.title} numberOfLines={2}>{noOrphan(track.title)}</Text>
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
          </View>
        );
      })()}

      <View style={styles.circleRow}>
        {hasStarted && !finished && canSeek ? (
          <Pressable onPress={() => seekAndResume(Math.max(0, t - 15))} style={styles.sideBtn}>
            <Text style={styles.sideBtnText}>-15s</Text>
          </Pressable>
        ) : <View style={styles.sideBtnPlaceholder} />}

        {finished ? (
          <View style={{ width: circleSize, height: circleSize }} />
        ) : isLoading ? (
          <View style={[styles.loadingCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}>
            <ActivityIndicator size="large" color={accent} style={{ marginBottom: spacing.xs }} />
            <Text style={styles.loadingText}>
              {engineState === 'loading' ? 'Loading…' : 'Buffering…'}
            </Text>
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
            }}
          />
        ) : (
          <CircleButton
            size={circleSize}
            mode={playing ? 'playing' : 'paused'}
            accent={accent}
            // `voice` deliberately omitted — the audio-reactive scale +
            // glow boost on the play button felt twitchy on long form
            // meditation tracks. The mode-driven breath alone is plenty
            // of "the button is alive" cue without chasing every peak.
            onPress={() => {
              // Manual toggle takes priority over the post-seek
              // auto-resume — clearing the intent ref stops the
              // engineState effect from immediately re-firing play()
              // after the user just pressed pause.
              intentToPlay.current = !playing;
              playing ? player.pause() : player.play();
            }}
          />
        )}

        {hasStarted && !finished && canSeek ? (
          <Pressable onPress={() => seekAndResume(Math.min(duration, t + 15))} style={styles.sideBtn}>
            <Text style={styles.sideBtnText}>+15s</Text>
          </Pressable>
        ) : <View style={styles.sideBtnPlaceholder} />}
      </View>

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
              <Text style={styles.description}>{noOrphan(description)}</Text>
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
              // validated — users already see 'Silent Mind' / 'QM Training' in
              // the bottom tab bar.
              const label = prog === 'qm' ? 'QM Training →' : 'Silent Mind →';
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
          <View style={[styles.transcriptFrame, styles.transcriptMask, inBreak && styles.transcriptFrameBreak]}>
            {(() => {
              const inner = cues.length > 0 ? (
                <ScrollView
                  ref={scrollRef}
                  contentContainerStyle={styles.transcriptContent}
                  onScroll={handleUserScroll}
                  onScrollBeginDrag={handleScrollBegin}
                  onTouchStart={handleScrollBegin}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
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
              );
              // Native parity for the CSS `maskImage` fade applied via
              // styles.transcriptMask: wrap in <MaskedView> on iOS /
              // Android so cues fade in at the top and out at the bottom
              // of the frame instead of clipping on a hard edge.
              if (Platform.OS === 'web') return inner;
              // Native parity: wrap in MaskedView for the same
              // top/bottom fade. Crucially the MaskedView gets an
              // explicit `height: 130` here (matching the parent's
              // `maxHeight`) — `flex: 1` collapses to 0 on iOS / Android
              // because `transcriptFrame` only declares `maxHeight`,
              // not `height`. Without this the transcript was
              // invisible on the phone (zero-height container, content
              // clipped by overflow:hidden).
              return (
                <MaskedView
                  style={{ height: 130, alignSelf: 'stretch' }}
                  maskElement={
                    <LinearGradient
                      colors={['transparent', 'black', 'black', 'transparent']}
                      locations={[0, 0.18, 0.82, 1]}
                      style={{ flex: 1 }}
                    />
                  }
                >
                  {inner}
                </MaskedView>
              );
            })()}
          </View>
        )}
      </View>

      {/* Bottom area — now hosts the time + waveform pair (with the
          digits read ABOVE the waveform per the latest design) and
          the contextual below-circle hint. The CircleButton itself
          moved up earlier in the body. */}
      <View style={styles.bottomArea}>
        <View style={styles.aboveCircle}>
          {hasStarted && !finished ? (
            <View style={styles.progressWrap}>
              <View style={styles.timesRow}>
                <Text style={styles.time}>{fmt(t)}</Text>
                <Text style={styles.time}>{fmt(duration)}</Text>
              </View>
              <View
                ref={progressEl}
                style={styles.progressHit}
                onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
                {...pan.panHandlers}
              >
                {peaks ? (
                  <WaveformProgress peaks={peaks} progress={progress} accent={accent} height={36} />
                ) : (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: accent }]} />
                    <View style={[styles.progressThumb, { left: `${Math.min(100, progress * 100)}%`, backgroundColor: accent }]} />
                  </View>
                )}
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
        // Reveal gate: 0 until `FADE_IN_LEAD` seconds before the word
        // starts, ramping to 1 by the moment the word starts. Once a
        // word has appeared it never disappears (past words stay
        // visible as context).
        const revealed = Math.max(
          0,
          Math.min(1, (time - (w.start - FADE_IN_LEAD)) / FADE_IN_LEAD),
        );
        // Emphasis sweep: peaks at the centre of the word currently
        // being spoken, falls off to zero outside SWEEP_WINDOW seconds.
        const wCenter = (w.start + w.end) / 2;
        const dist = Math.abs(time - wCenter);
        const closeness = easeCos(dist / SWEEP_WINDOW);
        // Rest state = PAST_OPACITY, lerped toward PEAK_OPACITY at the
        // highlight centre, then gated by the reveal so future words
        // remain invisible.
        const opacity =
          revealed * (PAST_OPACITY + (PEAK_OPACITY - PAST_OPACITY) * closeness);
        return <Text key={i} style={{ opacity }}>{spaced}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Overlay is fully transparent — the seamless transition relies on
  // the root layout's gradient + EnergyColumn showing through. The
  // Player only paints its own UI on top of that shared backdrop.
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', zIndex: 80 },
  // Transparent so the absolutely-positioned AnimatedGradient (first
  // child) is visible. The outer `overlay` still carries `colors.bg` as
  // a fallback solid, and the gradient's own edge stops fade to near-
  // black opacity 1 so there's no "see-through" effect.
  // paddingTop bumped 56 → 72 so the Close button sits visually below
  // the iPhone's notch / Dynamic Island area, not flush against it.
  root: { flex: 1, backgroundColor: 'transparent', paddingTop: 72 },
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
  // Pre-circle stack — eyebrow + title + chevrons sit just above the
  // round CTA, mirroring the Start screen's layout so the morph is
  // continuous. Tight bottom padding so the title hugs the circle.
  preCircle: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 4 },
  preCircleEyebrow: {
    ...type.overline,
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  // Quiet "checked off" pill. Same caps + tracking grammar as the
  // location eyebrow above so the two stack as a single typographic
  // beat, but tinted with the brand accent so the cue catches the eye
  // without shouting.
  preCircleListenedTag: {
    ...type.overline,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 1.4,
    textAlign: 'center',
    opacity: 0.75,
  },
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
  // Italic was doing visual noise work on description lines; the bold tier and
  // line-break rhythm carry enough emphasis on their own.
  descriptionItalic: {},
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
  // Flex spacer used between the top title block and the CircleButton.
  // Calibrated empirically (≈0.78) so the button lands at the same
  // Y as the Start screen's CTA once the eyebrow + title + meta
  // block above it on Start are taken into account. The Y match is
  // what makes the cross-fade morph read as a single button rather
  // than two buttons jumping.
  flexSpacer: { flex: 0.78 },
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
  // marginTop pulled negative so the duration hint sits closer to the
  // play circle (was floating ~10 px below — felt detached). minHeight
  // kept so the slot doesn't collapse + jump when the hint flips to
  // the round-end button mid-session.
  belowCircle: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: -spacing.sm },
  roundHeader: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 6 },
  roundText: { ...type.overline, color: colors.accent, fontSize: 11 },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotCurrent: { backgroundColor: colors.accent, width: 20 },
  dotDone: { backgroundColor: colors.text, opacity: 0.7 },

  // Transcript area — no framed card anymore. The bordered surface
  // panel created a heavy empty box during the first seconds of
  // playback (words reveal progressively, so very few are visible at
  // t≈0) and visually competed with the gradient. We now let the
  // transcript text float directly on the player's gradient like a
  // continuation of the title block. The container still flexes to
  // the parent's content width so the column doesn't reflow between
  // tracks, but it has no background, no border, no fixed height —
  // the surrounding spacing carries the rhythm.
  transcriptFrame: {
    // ~5 lines of cue text at fontSize 15 / lineHeight 24 + the
    // top/bottom mask fade (18% / 18%) — caps the transcript so it
    // takes minimal vertical real estate and the play button + the
    // waveform breathe around it.
    maxHeight: 130,
    alignSelf: 'stretch',
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  // Break interludes get a barely-there hairline divider top + bottom
  // instead of a dashed bordered card, so the break still reads as a
  // distinct beat without dropping a heavy frame on top of the gradient.
  transcriptFrameBreak: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  transcriptContent: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  // Top + bottom fade. We use a CSS `mask-image` on web so the text
  // dissolves directly into whatever the Player's gradient happens to
  // be at that vertical position — no painted overlay rectangle that
  // doesn't match the moving background. Native ignores these
  // properties (no-op until we add a MaskedView fallback if it ever
  // ships on iOS / Android).
  transcriptMask: Platform.OS === 'web'
    ? ({
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
      } as any)
    : {},
  // Slightly smaller and centred — text reads as floating prose, not a
  // left-aligned reading column. Tighter line-height keeps the reveal
  // sweep coherent now that the panel is shorter.
  cue: { ...type.body, fontSize: 15, lineHeight: 24, marginBottom: spacing.xs, textAlign: 'center' },
  // No padding/flex — a single quiet line near the top of the area
  // rather than a big centered empty view. The transcript is meant to
  // fill in word-by-word as the audio progresses; on the first seconds
  // it's normal to see almost nothing, so we don't dramatize it.
  noTranscript: { alignItems: 'center', paddingTop: spacing.md },
  noTranscriptText: { ...type.caption, color: colors.textDim, textAlign: 'center', fontSize: 12 },

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
    // Smaller top padding so the waveform sits right under the
    // timestamps; bottom padding kept generous so the touch target
    // remains comfortable for scrubbing.
    paddingTop: 4,
    paddingBottom: spacing.md,
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
  // Times row sits ABOVE the waveform — tight `marginBottom: 0` so
  // the digits hug the bar (the user wanted the waveform pulled up
  // closer to the temporal info). Justified to the bar's edges so
  // the timestamps frame the bar.
  timesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 0 },
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
