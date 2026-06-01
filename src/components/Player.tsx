import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, PanResponder, Platform, useWindowDimensions, ActivityIndicator, AppState } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Asset } from 'expo-asset';
import { useRouter } from 'expo-router';
import { useLayout, CONTENT_MAX_WIDTH as PLAYER_CONTENT_MAX_WIDTH } from '../hooks/useLayout';
import { usePlayerStore } from '../player/store';
import { useProgress, isTrackUnlocked } from '../player/progressStore';
import { themeForJourneyPosition, JOURNEY_ACCENTS } from '../shaders';
import { loadTranscript } from '../content/loadTranscript';
import { findCueIndex, TranscriptCue } from '../content/transcript';
import { trackProgram, trackLocation } from '../content/catalog';
import { AtmosphereBackground } from './AtmosphereBackground';
import { VideoBackground } from './VideoBackground';
import { resolveAudioSource, prefetchAudio } from '../content/audioResolver';
import { track as trackEvent } from '../analytics';
import { getAudioSource, getInterSource, getOutroSource, getTranscriptSource, getInterTranscriptSource } from '../content/audioRegistry';
import { WAVEFORMS } from '../content/waveforms.generated';
import { colors, radius, spacing, type } from '../theme';
import { noOrphan } from '../utils/noOrphan';
import { CircleButton } from './CircleButton';
import { WaveformProgress } from './WaveformProgress';

// Tick used for the pre-roll countdown — same asset QM Training
// uses for its `PRE_ROUND_SECONDS` ticks, so the audible cadence
// matches across both surfaces.
const TICK_SOURCE = require('../../assets/audio/tick.mp3');

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
    // Extract a filename stem from a Metro/web/native URL. Handles three
    // shapes:
    //   1. Plain path:  http://host/path/breath7_round01.mp3
    //   2. Cache hash:  file:///cache/audio_qm1-2.5e7a.mp3
    //   3. Metro web:   http://host/assets/?unstable_path=.%2Fassets%2F…breath7_round01.mp3
    // (3) is the breaker — the filename lives in a query param, not the path.
    const extractStem = (url: string): string => {
      const pathPart = url.includes('?unstable_path=')
        ? decodeURIComponent(url.split('?unstable_path=')[1].split('&')[0])
        : url.split('?')[0];
      const last = pathPart.split('/').pop() || '';
      return decodeURIComponent(last)
        .replace(/\.[a-f0-9]{6,}\.(mp3|wav|m4a|ogg)$/i, '')
        .replace(/\.(mp3|wav|m4a|ogg)$/i, '');
    };
    if (typeof source === 'string') {
      stem = extractStem(source);
    } else {
      const asset: any = Asset.fromModule(source);
      stem = asset?.name;
      if (!stem && typeof asset?.uri === 'string') stem = extractStem(asset.uri);
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
      // Slower exit (260 → 420 ms) so the Player keeps painting the
      // screen until the navigator behind has had time to re-paint.
      // Without this, end-of-audio transitions briefly revealed a
      // light frame between the Player UI fading and the underlying
      // screen catching up.
      exiting={FadeOut.duration(420)}
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
  duration?: number,
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
    const raw = statusTime ?? 0;
    // Hard reject NaN / Infinity / negative / absurdly large values. On
    // Android, expo-audio occasionally reports a non-finite currentTime
    // right after a source swap (briefly, before the first real tick),
    // and that single sample was enough to push lastT.current to
    // Infinity → every transcript word's `revealed` opacity instantly
    // became 1, i.e. the transcript appeared in full instead of being
    // typed in word-by-word.
    if (!Number.isFinite(raw) || raw < 0 || raw > 24 * 3600) return;
    const st = raw;
    // Allow "real" backwards moves (>1.5s) to pass through (e.g. explicit seek)
    if (st + 1.5 < lastT.current) {
      sync.current = { t: st, at: now0() };
      lastT.current = st;
    } else if (st >= lastT.current) {
      // Forward move. Three phantom-update guards on top of the
      // basic "must be ≥ lastT" check:
      //
      //   1) When PAUSED, reject jumps > 1 s. A paused player's
      //      currentTime can't naturally advance.
      //
      //   2) When JUST RESET (lastT < 1 s after a source swap),
      //      reject jumps > 5 s.
      //
      //   3) When the candidate currentTime lands inside the last 5 %
      //      of the track but lastT is still inside the first 50 %,
      //      reject. This catches Android's "phantom = previous
      //      track's duration" misreport regardless of where in
      //      playback the phantom fires (guards #1/#2 only cover the
      //      very early window). A real user-initiated seek to the
      //      end of the track is handled by the outer `pendingSeekTo`
      //      pin in the Player, so liveT lagging behind a far seek
      //      doesn't actually surface in the UI.
      if (!playing && st - lastT.current > 1.0) return;
      if (lastT.current < 1.0 && st - lastT.current > 5.0) return;
      if (
        duration && duration > 0 &&
        st > duration * 0.95 &&
        lastT.current < duration * 0.5
      ) return;
      sync.current = { t: st, at: now0() };
      lastT.current = st;
    }
    // else: small backward jitter — keep extrapolating from the last known sync
  }, [statusTime, playing, duration]);
  useEffect(() => {
    // Re-anchor the extrapolation base on every play / pause transition.
    // Without this, hitting pause snapped the displayed time back to the
    // most-recent `status.currentTime` sync (which lags actual playback
    // by 100–300 ms because expo-audio's status ticks trail the audio
    // clock). Visually that read as a 200 ms backwards jump at the moment
    // of pause. Re-basing `sync` on the current `lastT` snapshot keeps
    // the displayed time continuous across the transition; the same
    // re-base on resume avoids the symmetric forward overshoot before
    // the next status tick arrives.
    sync.current = { t: lastT.current, at: now0() };
    let raf = 0;
    // Cancel the rAF entirely while backgrounded — the previous fix
    // skipped setT() but kept rescheduling requestAnimationFrame
    // 60×/s, which on iOS still wakes the JS thread enough to
    // contribute to the 48-s-CPU-per-60-s background watchdog. The
    // smoothed time is purely a UI concern (karaoke / scrubber), so
    // freezing the whole loop while nothing is visible is harmless.
    const tick = () => {
      const now = now0();
      const dt = (now - sync.current.at) / 1000;
      const next = sync.current.t + (playing ? dt : 0);
      // Never emit a value that goes backwards. The monotonic guard
      // now runs unconditionally — when paused, `next` == sync.t (no
      // dt added) which equals the last-extrapolated `lastT` thanks
      // to the re-anchor above, so the displayed time freezes in
      // place. A real backward seek arrives through the status
      // useEffect's `st + 1.5 < lastT` branch which resets both
      // `sync` and `lastT` to the lower value, so the Math.max
      // doesn't pin us at the stale value.
      const monotonic = Math.max(next, lastT.current);
      lastT.current = monotonic;
      setT(monotonic);
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') start();
      else stop();
    });
    return () => { stop(); sub.remove(); };
  }, [playing]);
  return t;
}

function PlayerInner() {
  const router = useRouter();
  const { isTablet, playSize: circleSize } = useLayout();
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { track, close, playlist, index, playNext, playPrev } = usePlayerStore();
  const markListened = useProgress(s => s.markListened);
  const listened = useProgress(s => s.listened);
  // hasNext also requires the next track to be UNLOCKED — without
  // this, the › button on a SM-tree-launched session would happily
  // jump into a track the user hasn't earned access to yet, bypassing
  // the journey gate that the rest of the UI enforces.
  const hasNext =
    index >= 0 &&
    index < playlist.length - 1 &&
    isTrackUnlocked(playlist[index + 1].id, listened);
  const hasPrev = index > 0;
  // `listened` subscribed earlier (above) — it does double duty: gates
  // hasNext, and drives the "Already listened" pill that flips off the
  // moment a fresh track is opened and back on once the current track
  // crosses the 80 % mark.

  const [selectedRounds, setSelectedRounds] = useState(track?.rounds?.max ?? 1);
  // A track "has an intro" if it either declares an inline introSource
  // (legacy) or sets the hasIntro flag (resolver-based, e.g. QM
  // Unguided). Both paths route through the same Player state — round 0
  // is the intro phase, then round 1 onwards is the meditation.
  const trackHasIntro = !!(track?.rounds?.introSource || track?.rounds?.hasIntro);
  const [includeIntro, setIncludeIntro] = useState(trackHasIntro);
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
    const hasIntroLocal = !!(track.rounds?.introSource || track.rounds?.hasIntro);
    if (auto && hasIntroLocal) return 0;
    return 1;
  });
  // Same idea for hasStarted: when autoStart is true at mount we want
  // the playback chain to engage immediately, not flash the pre-play
  // screen before flipping to true on next render.
  // Pre-roll countdown — when the caller passes `preRollSeconds`, the
  // Player opens, autoStart is implied, but the audio is held back
  // for this many seconds while a settle-in countdown ticks down on
  // the player surface (mirrors the QM Training pre-round countdown).
  // Used for the Start screen's 1 min / 3 min / 3 × 3 min pills.
  // We READ preRollSeconds at mount (no side-effect — calling
  // `set()` from a useState initializer triggers React's
  // "Cannot update a component while rendering a different
  // component" warning). The actual clear happens in a useEffect
  // below, where side effects are allowed.
  const [preRollRemaining, setPreRollRemaining] = useState<number>(() =>
    usePlayerStore.getState().preRollSeconds,
  );
  // hasStarted: false while preRoll is counting down; otherwise honour
  // the autoStart flag.
  const [hasStarted, setHasStarted] = useState<boolean>(() => {
    const s = usePlayerStore.getState();
    if (s.autoStart && s.preRollSeconds > 0) return false;
    return s.autoStart;
  });
  // Clear the store-level preRollSeconds AFTER mount so subsequent
  // round / playlist swaps don't see a stale value. Runs once
  // (empty deps) — local `preRollRemaining` state is already
  // initialised above and carries the ticker forward.
  useEffect(() => {
    if (usePlayerStore.getState().preRollSeconds > 0) {
      usePlayerStore.setState({ preRollSeconds: 0 });
    }
  }, []);
  const [inBreak, setInBreak] = useState(false);
  // `inOutro` is set true after the last round of a rounds-based track
  // when `rounds.outroSource` is defined. While true, the Player plays
  // the outro clip (e.g. a closing bell + "session complete" voice for
  // QM Unguided) instead of closing immediately. When the outro ends,
  // the Player closes the same way a non-outro session would have.
  const [inOutro, setInOutro] = useState(false);
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
    // Outro plays after the last round when rounds.hasOutro is set.
    // Short-circuit before the break / round branches so the outro
    // audio is resolved regardless of currentRound / inBreak state.
    // The actual source is fetched via the registry in the resolve
    // effect below; here we only need a truthy non-string sentinel so
    // dependent prefetch / waveform paths know "something's loading".
    if (inOutro) {
      const outro = track && getOutroSource(track.id);
      return outro?.bundled ?? outro?.remote ?? undefined;
    }
    if (inBreak) {
      const interSrc = r?.roundInters?.[currentRound - 1];
      if (interSrc) return interSrc;
      // Registry first — prefer bundled require (Asset.name = stable
      // stem like "breath7_round01_inter") then remote URL, both of
      // which let peaksForSource resolve a waveform key.
      const interReg = getInterSource(track.id, currentRound - 1);
      return interReg?.bundled ?? interReg?.remote ?? undefined;
    }
    if (currentRound === 0) {
      // hasIntro tracks (QM Unguided) resolve the intro URL via the
      // registry rather than declaring it inline. Fall through to the
      // registry lookup when introSource isn't set but hasIntro is.
      if (r?.introSource) return r.introSource;
      const reg = track ? getAudioSource(track.id, undefined) : null;
      return reg?.bundled ?? reg?.remote ?? undefined;
    }
    if (r?.roundSources && r.roundSources[currentRound - 1]) return r.roundSources[currentRound - 1];
    if (track.source) return track.source;
    // Registry: bundled require (Asset has a stable .name) wins over
    // remote URL, which wins over the cache-rotated resolvedUri (whose
    // file:// path doesn't carry the original stem).
    const roundIdx = r ? Math.max(0, currentRound - 1) : undefined;
    const reg = getAudioSource(track.id, roundIdx);
    return reg?.bundled ?? reg?.remote ?? resolvedUri ?? undefined;
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
  // keepAudioSessionActive: true → expo-audio won't deactivate the
  // AVAudioSession on pause(). We rely on this for lock-screen Now
  // Playing controls: setActiveForLockScreen only publishes its
  // metadata into MPNowPlayingInfoCenter while the session is
  // active, so a defensive pause() during track load (we issue a
  // few in the source-swap chain) would otherwise tear down the
  // session right when the user is about to lock the screen, and
  // the lock-screen card would never appear.
  // updateInterval: 1000 — drop the default 500 ms status polling rate.
  // Each tick reads AVPlayer state + republishes Now Playing metadata
  // on iOS (AudioPlayer.swift::updateStatus auto-fires
  // MediaController.updateNowPlayingInfo when isActiveForLockScreen).
  // 1 s is fine for the scrubber UI and halves the background CPU
  // cost; combined with the redundant-heartbeat removal below, this
  // keeps us comfortably under iOS's 48 s/min watchdog.
  const player = useAudioPlayer(resolvedUri ?? undefined, { keepAudioSessionActive: true, updateInterval: 1000 });
  const status = useAudioPlayerStatus(player);

  // Tick player for the pre-roll countdown — same UX as QM Training,
  // a single audible tick on each second mark before the audio
  // starts. Always-mounted so the first tick on session start is
  // already loaded.
  // keepAudioSessionActive: true on EVERY player in the app — expo-audio
  // deactivates the global AVAudioSession when any non-flagged player
  // pauses or completes (AudioModule.swift::Function("pause") line
  // ~200), which silently kills our long-form background playback after
  // ~45 s when iOS gives up on the suspended session.
  // updateInterval: 5000 — tickPlayer is idle except during pre-roll
  // countdown; no reason to poll status at 2 Hz like the main player.
  // Default 500 ms × every helper × CPU = background watchdog kill.
  const tickPlayer = useAudioPlayer(TICK_SOURCE, { keepAudioSessionActive: true, updateInterval: 5000 });
  const playTick = useCallback(() => {
    try { tickPlayer.seekTo(0); tickPlayer.play(); } catch {}
  }, [tickPlayer]);

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
  // Timestamp of the most recent programmatic auto-scroll. While the
  // smooth scroll is still travelling toward `expectedScrollY`, the
  // intermediate `onScroll` ticks would otherwise look like manual
  // gestures (offset diverges from expected by hundreds of px), and
  // would suspend auto-scroll for 5 s right after every cue change —
  // which is what was causing the transcript to "stop following" and
  // then jump several cues later.
  const autoScrollAt = useRef(0);

  // Lock-screen Now Playing controls. expo-audio exposes
  // setActiveForLockScreen on the player; once active, iOS pipes the
  // metadata into MPNowPlayingInfoCenter and Android into a
  // MediaSession + foreground-service notification, both of which the
  // OS shows on the lock screen / control centre with play/pause.
  //
  // We call setActiveForLockScreen aggressively — every time the
  // track / round / break / status changes — because expo-audio's
  // native side is idempotent (it just resets the active player
  // pointer + republishes the dict each call). Re-publishing on
  // every status tick also ensures the lock-screen elapsed-time
  // bar stays in sync with the actual playback position.
  const lockScreenActive = useRef(false);

  // Resolve the app icon to a local file:// URI once on mount. iOS's
  // MPNowPlayingInfoCenter reads artwork via URLSession.dataTask which
  // accepts file:// URLs, so a bundled require() works as long as
  // Asset has populated its localUri. We hold the URI in state and
  // pass it through lockScreenInfo so every track + round transition
  // re-publishes the same artwork to the lock-screen card.
  const [artworkUri, setArtworkUri] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/icon.png'));
        await asset.downloadAsync();
        if (!cancelled) setArtworkUri(asset.localUri ?? asset.uri);
      } catch (err) {
        console.warn('artwork resolution failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const lockScreenInfo = useMemo(() => {
    if (!track?.id) return null;
    const program = trackProgram(track.id);
    const programLabel =
      program === 'silent-mind' ? 'Silent Mind'
      : program === 'qm'        ? 'QM Training'
      :                            'All Here';
    let title = track.title;
    if (track.rounds && track.rounds.max > 1) {
      const total = track.rounds.max;
      if (currentRound === 0) title = `${track.title} — Intro`;
      else if (inBreak)       title = `${track.title} — Break ${currentRound}/${total}`;
      else                    title = `${track.title} — Round ${currentRound}/${total}`;
    }
    return { title, artist: programLabel, albumTitle: 'All Here', artworkUrl: artworkUri };
  }, [track?.id, track?.title, track?.rounds?.max, currentRound, inBreak, artworkUri]);

  // Activate the lock-screen Now Playing card once per (track, metadata,
  // player) tuple. We DELIBERATELY don't run a periodic heartbeat here:
  // expo-audio's `AudioPlayer.updateStatus` (AudioPlayer.swift line
  // ~127) already re-fires `MediaController.updateNowPlayingInfo` on
  // every status tick while `isActiveForLockScreen` is true — so the
  // card stays fresh automatically. Adding a JS-side `setInterval`
  // republish on top of that doubled the publish rate and contributed
  // to the iOS 48 s/min CPU watchdog killing the app at ~45 s into
  // backgrounded playback.
  useEffect(() => {
    if (!track?.id || !lockScreenInfo) {
      if (lockScreenActive.current) {
        try { player.clearLockScreenControls(); } catch (err) { console.warn('clearLockScreenControls failed:', err); }
        lockScreenActive.current = false;
      }
      return;
    }
    // Wait until the player is ACTUALLY playing before registering with
    // MPNowPlayingInfoCenter. iOS's MRDElectedPlayerController only
    // elects the lock-screen card holder when it sees `selectionReason=
    // is playing` at registration time; calling setActiveForLockScreen
    // a few ms too early (while AVPlayer is still in the buffering /
    // paused state) causes the card to never appear, and subsequent
    // calls are deduped because `canBeNowPlaying` is already YES.
    // Confirmed in Console.app: qmu-5 worked because its registration
    // happened to land during playback; qm1-2 (bundled file, starts
    // instantly) was registering before status.playing flipped to true.
    //
    // Android-only: do NOT gate on status.playing. Android's MediaSession
    // has no equivalent "elect during playback" requirement; gating made
    // setActiveForLockScreen often fire too late (or never, if the user
    // locked the screen during the brief buffering window) and the
    // foreground-service notification that backs the lock-screen card
    // never got started.
    if (Platform.OS === 'ios' && !status.playing) return;
    try {
      player.setActiveForLockScreen(true, lockScreenInfo);
      lockScreenActive.current = true;
    } catch (err) {
      console.warn('setActiveForLockScreen failed:', err);
    }
  }, [track?.id, lockScreenInfo, status.playing, status.duration, player]);

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
        // Outro shortcut: hasOutro flag in catalog → audioRegistry's
        // getOutroSource(trackId) returns either a bundled require() or
        // a remote WP URL. Player resolves both shapes locally here,
        // since resolveAudioSource is shaped around (round, inter)
        // pairs and adding a third axis for outros would bloat it.
        if (inOutro && track.rounds?.hasOutro) {
          const outro = getOutroSource(track.id);
          if (outro?.bundled) {
            const asset = Asset.fromModule(outro.bundled);
            await asset.downloadAsync();
            setResolvedUri(asset.localUri ?? asset.uri);
          } else if (outro?.remote) {
            setResolvedUri(outro.remote);
          } else {
            throw new Error(`No outro source for track "${track.id}"`);
          }
          setDownloadProgress(0);
          return;
        }
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
  }, [track?.id, currentRound, inBreak, inOutro]);

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

  // Activity tracking: play_start once per track + a play_progress
  // heartbeat while playing (server sums duration_s → total listening
  // time). Fire-and-forget; the interval stops on pause / unmount, so
  // listening time only accrues during actual playback.
  const playStartedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!status.playing || !track?.id) return;
    const id = track.id;
    if (playStartedRef.current !== id) {
      playStartedRef.current = id;
      trackEvent('play_start', { audio_id: id });
    }
    const hb = setInterval(() => trackEvent('play_progress', { audio_id: id, duration_s: 15 }), 15000);
    return () => clearInterval(hb);
  }, [status.playing, track?.id]);

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
  const liveT = useSmoothTime(status.currentTime, actuallyPlaying, sourceKey, status.duration);
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

  // Pre-roll ticker. Decrements `preRollRemaining` once per second
  // while > 0; when it lands on 0 we flip `hasStarted` so the audio
  // engine kicks in. The countdown UI lives inside the play-button
  // slot — see the render below. Each visible second mark fires a
  // tick sound to match the QM Training pre-round audible cue.
  const didTickInitial = useRef(false);
  useEffect(() => {
    if (preRollRemaining <= 0) return;
    // Fire a tick on the FIRST render of the countdown too (so the
    // user hears the "5" beat, not just 4/3/2/1).
    if (!didTickInitial.current) {
      didTickInitial.current = true;
      playTick();
    }
    const t = setTimeout(() => {
      setPreRollRemaining(r => {
        const next = r - 1;
        if (next > 0) playTick();
        if (next <= 0) setHasStarted(true);
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [preRollRemaining, playTick]);

  useEffect(() => {
    // Call sites can ask the player to bypass the pre-play screen (big
    // play button on Start, etc.). Consume the one-shot flag once per
    // track swap so it doesn't re-fire on future round changes.
    const auto = usePlayerStore.getState().consumeAutoStart();
    const startAtIntro = !!(auto && (track?.rounds?.introSource || track?.rounds?.hasIntro));
    // Preserve hasStarted across an in-playlist Next/Prev: if the user
    // was already actively playing, the new track should auto-play
    // too instead of dropping back to the pre-play screen. We read the
    // live `playing` flag straight from the store so it's up to date
    // even though this effect is on the new track's render.
    const wasPlaying = usePlayerStore.getState().playing;
    // If we still have pre-roll time on the clock, keep hasStarted
    // false — the pre-roll ticker will flip it to true when the
    // countdown completes. Without this guard the autoStart logic
    // would race ahead of the countdown UI. `preRollRemaining` is
    // local state, so it doesn't bounce back across subsequent
    // track swaps.
    const preRollPending = preRollRemaining > 0;
    setHasStarted(!preRollPending && (!!auto || wasPlaying));
    setCurrentRound(auto ? (startAtIntro ? 0 : 1) : 1);
    setSelectedRounds(track?.rounds?.max ?? 1);
    setIncludeIntro(!!(track?.rounds?.introSource || track?.rounds?.hasIntro));
    setInBreak(false);
    setInOutro(false);
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
    // Pause aggressively on track swap. The bug: clicking Next while
    // the previous track was playing left the old source emitting
    // audio while expo-audio asynchronously decoded the new URI →
    // briefly two audios overlapping. A single pause() doesn't
    // always land before the swap because AVPlayer (iOS) and the
    // web HTMLAudioElement keep feeding already-buffered bytes for a
    // tick. Pausing once synchronously, then again on the next
    // microtask after React commits the new URI, closes the gap
    // without forcing a null-source intermediate (which broke web
    // resume on qm1-4 round 1).
    return () => {
      try { player.pause(); } catch {}
      Promise.resolve().then(() => { try { player.pause(); } catch {} });
      setTimeout(() => { try { player.pause(); } catch {} }, 80);
    };
  }, [track?.id]);


  // (after autoStart or the first user-initiated play), gated by the
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
      if (inOutro) {
        // Outro audio finished — close the Player. No further round /
        // inter / outro state to advance to.
        try { player.pause(); } catch {}
        close();
      } else if (inBreak) {
        // Inter ended → advance to next round
        endBreak();
      } else {
        handleRoundEnd();
      }
    }
  }, [t, duration, status.playing, hasStarted, inBreak, inOutro, finished]);

  // Aggressive pause — used at round / break transitions where the
  // outgoing audio's tail (often a closing bell) was bleeding into the
  // start of the inter audio (which itself opens with a bell). A
  // single `player.pause()` is queued asynchronously by AVPlayer / web
  // audio and lets a few buffered frames out — calling pause three
  // times across sync, microtask and a short timeout closes that gap
  // so only the inter's own bell is heard.
  const pauseHard = () => {
    try { player.pause(); } catch {}
    Promise.resolve().then(() => { try { player.pause(); } catch {} });
    setTimeout(() => { try { player.pause(); } catch {} }, 60);
  };

  const handleRoundEnd = () => {
    // Stop the current audio immediately so it doesn't bleed into the transition.
    pauseHard();
    // After intro (round 0), go straight to round 1 with no break
    if (currentRound === 0) {
      setCurrentRound(1);
      endedHandled.current = false;
      roundChangedAt.current = Date.now();
      return;
    }
    const hasMore = track?.rounds && currentRound < selectedRounds;
    if (!hasMore) {
      // After the last round: if the catalog declares hasOutro (closing
      // bell + "session complete" for QM Unguided), enter the outro
      // phase and let it play through before closing. Otherwise dismiss
      // the player; the user lands back wherever they opened it from.
      // (The "AUDIO ENDED" splash was removed — it added little value
      // and interrupted the after-practice settle.)
      if (track?.rounds?.hasOutro && !inOutro) {
        setInOutro(true);
        roundChangedAt.current = Date.now();
        endedHandled.current = false;
        return;
      }
      pauseHard();
      close();
      return;
    }
    // Inter source can come from the catalog `roundInters` array OR
    // from the registry-driven resolver (catalogs like qm1-2 don't
    // list inters explicitly — they're derived per-round from the
    // bundled / remote pattern). If either resolves, we treat it as
    // a real break and switch the Player into break mode.
    const catalogInter = track?.rounds?.roundInters?.[currentRound - 1];
    const registryInter = track ? getInterSource(track.id, currentRound - 1) : null;
    const hasInter = !!catalogInter || !!registryInter;
    if (hasInter) {
      setInBreak(true);
      roundChangedAt.current = Date.now();
      endedHandled.current = false;
    } else {
      setCurrentRound(r => r + 1);
    }
  };

  const endBreak = () => {
    // Single sync pause — NOT pauseHard. The user-initiated "Skip to
    // round N+1" is fundamentally different from a natural round-end
    // transition: we're interrupting the inter (mostly silence with
    // a bell) on PURPOSE, then immediately playing the next round.
    // pauseHard schedules a 60 ms-late pause to suppress the closing
    // bell of round-end audio; that late pause was firing AFTER the
    // resolve effect had already kicked off play() on the new round
    // (which lands in ~5 ms for bundled audio), re-pausing the next
    // round and leaving the user staring at a stuck player. A single
    // sync pause is enough — useAudioPlayer's source change finishes
    // the cleanup naturally.
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
    // Historically a 400 ms re-kick was queued here to cover a race
    // where the first call fired before the source was loadable
    // (qm1-4 canary). With the effect now keyed on `resolvedUri`
    // rather than `player`, the kick only runs once the URI is
    // present — the race is gone, and the re-kick was double-ringing
    // the audio's opening bell on tracks that begin with one (qm1-2
    // / breath7_round01 was the visible canary). If the original
    // race resurfaces, prefer guarding the re-kick on
    // `!status.playing` so the seekTo(0) doesn't rewind a
    // successfully-started track.
  }, [resolvedUri, hasStarted, finished, player]);

  useEffect(() => {
    if (finished) { try { player.pause(); } catch {} }
  }, [finished]);

  const currentCueIdx = useMemo(() => (cues.length ? findCueIndex(cues, t) : -1), [cues, t]);

  // Auto-scroll interpolates Y continuously based on where `t` sits
  // *within* the current cue. The transcript glides at the pace of
  // the voice instead of snapping line-by-line at each cue boundary.
  //
  //  - cur     = top Y of the currently-spoken cue
  //  - nextY   = top Y of the next cue (or cur + 60 if last cue)
  //  - frac    = 0…1 progress of `t` inside [cue.start, nextCue.start]
  //  - y       = lerp(cur, nextY, frac)
  //  - targetY = y − 50 (lands the current line ~50 px below the top
  //              of the 130 px transcript window, past the mask fade)
  //
  // `animated: false` because the per-tick interpolation IS the
  // animation — letting RN animate each tiny scrollTo would compound
  // its easing on top of ours and stutter. The change-detection
  // (`< 1 px` skip) keeps us from spamming the native scroll when
  // the interpolated Y hasn't moved enough to be visible.
  useEffect(() => {
    if (!hasStarted || inBreak) return;
    if (currentCueIdx < 0) return;
    if (Date.now() < userScrollingUntil.current) return;
    // Don't react to the cue jump that happens *during* a scrub /
    // tap on the waveform — t briefly equals the scrub target, the
    // cue index updates, and we'd scroll. Then on release the seek
    // resolves and t snaps to the same cue → another scroll. The
    // pair was visible as a ghost frame in the transcript. Wait
    // until the scrub gesture is over and the seek has converged.
    if (scrubbing || pendingSeekTo != null) return;
    const cur = cueLayouts.current[currentCueIdx];
    if (cur == null) return;
    const next = cueLayouts.current[currentCueIdx + 1];
    const cue = cues[currentCueIdx];
    const nextCue = cues[currentCueIdx + 1];
    const nextY = next != null ? next : cur + 60;
    const span = Math.max(0.01, (nextCue ? nextCue.start : cue.end) - cue.start);
    const frac = Math.max(0, Math.min(1, (t - cue.start) / span));
    const y = cur + (nextY - cur) * frac;
    const targetY = Math.max(0, y - 50);
    if (Math.abs(targetY - expectedScrollY.current) < 1) return;
    expectedScrollY.current = targetY;
    // First scroll after a user-scroll lock expires is animated as a
    // catch-up; subsequent per-tick updates are unanimated so the
    // continuous interpolation reads as one smooth glide.
    const animated = nextScrollAnimated.current;
    nextScrollAnimated.current = false;
    autoScrollAt.current = Date.now();
    scrollRef.current?.scrollTo({ y: targetY, animated });
  }, [currentCueIdx, t, cues, hasStarted, inBreak, scrubbing, pendingSeekTo]);

  const markUserScrolling = () => {
    userScrollingUntil.current = Date.now() + 5000;
    // Next time the auto-scroll resumes, animate the catch-up
    nextScrollAnimated.current = true;
  };
  const handleUserScroll = (e: any) => {
    // Suppress divergence detection while the smooth auto-scroll is
    // still in motion: during the animation, offset legitimately differs
    // from `expectedScrollY` (it's en-route). 800 ms covers the typical
    // RN smooth-scroll duration with a comfortable margin.
    if (Date.now() - autoScrollAt.current < 800) return;
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
  // Ref-bouncer for commitSeek so handlers captured by long-lived
  // closures (the web useEffect listeners attached at mount) always
  // call the latest version. Without this, the web onUp pointed at
  // a frozen closure where `status.playing` was false (snapshot from
  // when the effect first ran, before the user pressed play), so
  // `seekAndResume` would pause + seek + skip the resume — visible
  // as "tapping the waveform stops the audio".
  const commitSeekRef = useRef(commitSeek);
  useEffect(() => { commitSeekRef.current = commitSeek; });

  // Release the post-seek pin once playback has demonstrably reached
  // the target. Two effects are needed because the old single effect
  // re-ran on every status.currentTime tick and kept resetting the 4s
  // safety timeout — meaning if the convergence check never matched
  // (e.g. with updateInterval: 1000 ms the polled currentTime can
  // jump from the old position past target+0.5s in one go), the pin
  // stayed forever and the displayed time stuck at the seek target
  // while the audio kept playing. Symptom: "tap timeline to 0, audio
  // restarts but time display stays at 00:00."
  const seenNearTargetRef = useRef(false);
  useEffect(() => { seenNearTargetRef.current = false; }, [pendingSeekTo]);
  useEffect(() => {
    if (pendingSeekTo == null) return;
    // Wider threshold to absorb the gap between polled status ticks
    // (updateInterval: 1000 ms) — the engine may report the new
    // position one tick after the seek, by which time currentTime
    // could already be past target + 0.5s on backward seeks.
    if (Math.abs(status.currentTime - pendingSeekTo) < 1.5) {
      seenNearTargetRef.current = true;
    }
    if (seenNearTargetRef.current && engineState === 'playing') {
      setPendingSeekTo(null);
    }
  }, [pendingSeekTo, status.currentTime, engineState]);
  // Safety fallback: clear the pin after 4s no matter what. Runs in
  // its own effect with ONLY [pendingSeekTo] as deps so the timer
  // doesn't get cancelled by every status.currentTime change.
  useEffect(() => {
    if (pendingSeekTo == null) return;
    const id = setTimeout(() => setPendingSeekTo(null), 4000);
    return () => clearTimeout(id);
  }, [pendingSeekTo]);

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
      commitSeekRef.current();
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
  // Cached / bundled audio reads from disk — there's nothing the user
  // can wait for, so suppress the spinner for those even if expo-audio
  // hasn't yet flipped `isLoaded` true. For remote streaming (http(s)
  // URIs) we keep the buffering UI so the user understands the wait.
  const isLocalUri = !!resolvedUri && (resolvedUri.startsWith('file://') || resolvedUri.startsWith('asset://'));
  const isLoading = !isLocalUri && (engineState === 'loading' || engineState === 'buffering');
  const canSeek = duration > 0;
  const description = track.description ?? (track.rounds ? QM_DESCRIPTION : DEFAULT_DESCRIPTION);
  const rounds = track.rounds;
  // Default accent — derive from the track's JOURNEY PART so the
  // Player's button / progress bar take the same colour the SM tree
  // uses for that part. The journey tree's per-dot rainbow override
  // still wins via `accentOverride`. home-* tracks are blue (a
  // fixed identity for the Start tab); fallback for unknown ids is
  // the legacy magenta / teal split.
  const accentOverride = usePlayerStore(s => s.accentOverride);
  const trackId = track?.id ?? '';
  const partAccent = (() => {
    if (trackId.startsWith('intro-')) return JOURNEY_ACCENTS.intro;
    if (trackId.startsWith('p1-') || trackId.startsWith('qm1-')) return JOURNEY_ACCENTS.part1;
    if (trackId.startsWith('p2-') || trackId.startsWith('qm2-')) return JOURNEY_ACCENTS.part2;
    if (trackId.startsWith('p3-') || trackId.startsWith('qm3-')) return JOURNEY_ACCENTS.part3;
    if (trackId.startsWith('home-')) return JOURNEY_ACCENTS.part2; // start blue
    return rounds ? colors.accentAlt : colors.accent;
  })();
  const accent = accentOverride ?? partAccent;
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

  // Player background follows the journey-tree's part palette: lake
  // for intro, earth (= shadow-wall video) for Part 1, sky for Part 2,
  // space for Part 3. Same mapping as the silent-mind tree, so the
  // backdrop you see when a track plays matches the section it lives
  // in. Falls through to lake for any unrecognised id (defensive).
  const partTheme: 'lake' | 'earth' | 'sky' | 'space' = (() => {
    const id = track?.id ?? '';
    if (id.startsWith('intro-')) return 'lake';
    if (id.startsWith('p2-') || id.startsWith('qm2-')) return 'sky';
    if (id.startsWith('p3-') || id.startsWith('qm3-')) return 'space';
    if (id.startsWith('p1-') || id.startsWith('qm1-')) return 'earth';
    // Quick Start-screen meditations (home-1min / home-3min / home-qm3)
    // inherit the user's CURRENT journey atmosphere — same theme the
    // Start tab is showing in the background. A user who has
    // unlocked Space shouldn't snap back to Lake just because they
    // tapped a 3 min quickie; the atmosphere stays continuous.
    if (id.startsWith('home-')) {
      const t = themeForJourneyPosition(listened);
      // The shared shader registry uses 'grass' as a synonym for
      // 'earth' on this code path, but the Player only knows the
      // four canonical themes — fold it back.
      if (t === 'grass' || t === 'default') return 'earth';
      return t;
    }
    return 'lake';
  })();

  return (
    // styles.root carries a hardcoded paddingTop:72 (matches the iOS
    // notch / dynamic-island area we always reserved). The bottom
    // inset is platform-dependent: iOS home-indicator ~34 px, Android
    // gesture-nav 24–34 px, classic Android nav-buttons 48 px+. With
    // app.json edgeToEdgeEnabled:true on Android the gesture bar
    // overlaps content unless we pad explicitly — apply insets.bottom
    // at the root so every bottom-anchored Player control (Skip intro,
    // play/pause, sliders) clears the system nav.
    <View style={[styles.root, { paddingTop: Math.max(insets.top + spacing.md, 56), paddingBottom: insets.bottom }]}>
      {/* Per-part backdrop — lake / earth-video / sky / space, picked
          from the playing track's id. Sits BEHIND the Player UI, so
          the user sees the matching atmosphere even if the screen
          underneath the Player overlay is on a different one. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {partTheme === 'earth'
          ? <VideoBackground />
          : <AtmosphereBackground theme={partTheme} />}
      </View>
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
      {/* Round bar moved into the pre-circle eyebrow slot below for
          QM tracks — keeping it here too would duplicate the round
          count in two places. Non-QM tracks keep an empty top bar
          to preserve safe-area spacing. */}
      <View style={styles.top} />

      {/* Middle content area */}
      {/* Flex spacer pushing the circle down so it lands at roughly
          the same Y as the Start screen's round CTA — the morph
          illusion only works if both buttons share the same screen
          position. Scaled to the viewport: a flat 0.78 was tuned for
          an iPhone-13-ish height and pushed the button way down on
          small phones, so we shrink it on short screens so the circle
          stays closer to Start's effectivePlayCenterY. */}
      <View style={{ flex: winH < 700 ? 0.35 : winH < 780 ? 0.55 : 0.78 }} />

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
            {rounds ? (
              hasStarted ? (
                <View style={styles.roundBar}>
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
                </View>
              ) : (
                <Text style={[styles.preCircleEyebrow, { color: accent }]} numberOfLines={1}>
                  QM{rounds.roundLengthMinutes} · {rounds.max} × {rounds.roundLengthMinutes} MIN
                </Text>
              )
            ) : loc ? (
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
                  onPress={() => { trackEvent('skip', { audio_id: track?.id, payload: { dir: 'prev' } }); playPrev(); }}
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
                  onPress={() => { trackEvent('skip', { audio_id: track?.id, payload: { dir: 'next' } }); playNext(); }}
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
        ) : preRollRemaining > 0 ? (
          // Pre-roll countdown — settle-in moment before the audio
          // starts. Replaces the play button entirely; ticks down to
          // 0, at which point `hasStarted` flips and the audio engine
          // takes over.
          <View
            style={[
              styles.preRollCircle,
              {
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2,
                borderColor: accent,
              },
            ]}
          >
            <Text style={[styles.preRollNumber, { color: accent, fontSize: circleSize * 0.45 }]}>
              {preRollRemaining}
            </Text>
            <Text style={styles.preRollLabel}>get ready…</Text>
          </View>
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
              const startAtIntro = (rounds?.introSource || rounds?.hasIntro) && includeIntro;
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
            {/* Tracks can opt out of the countdown-screen description by
                setting `description: ''` (empty string) in catalog.ts.
                The current home meditations (1 min / 3 min / 3×3) do
                this — they're so short / self-evident that the
                generic fallback ("Take a moment to arrive…") added
                noise. */}
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
            ) : description ? (
              <Text style={styles.description}>{noOrphan(description)}</Text>
            ) : null}
            {/* Hide the entire rounds-count slider when the track
                declares `fixedRounds` (the format is part of the
                track's identity, not a runtime parameter — e.g. the
                Start screen's "3 × 3 min" pill). Plays through
                rounds.max regardless. */}
            {rounds && !rounds.fixedRounds ? (
              <View style={styles.paramsCard}>
                <View style={styles.sliderHeader}>
                  {(rounds.introSource || rounds.hasIntro) ? (
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
          ) : finished ? null : rounds && currentRound === 0 ? (
            <Pressable onPress={handleRoundEnd} style={styles.nextRoundBtn}>
              <Text style={[styles.nextRoundText, { color: accent }]}>Skip intro →</Text>
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
      // textShadow inherited from styles.cue → type.body is nulled out
      // at the parent level on purpose. On Android, the parent <Text>'s
      // shadow is rendered uniformly across every glyph in the run
      // (including the transparent ones we'd otherwise produce for
      // unrevealed words via child <Text style={{ color: rgba(_,_,_,0) }}>),
      // because text-shadow on Android is a TextView property, not a
      // per-character span. Child <Text> overrides for textShadowColor
      // don't propagate. Killing the parent shadow keeps unrevealed
      // words truly invisible. Revealed words still get their own
      // per-word shadow via each child <Text>'s explicit textShadow
      // props — honoured on iOS and web. On Android per-child shadow
      // is ignored, so revealed words read as plain white text on the
      // Player's dark backdrop (still legible).
      style={[
        styles.cue,
        {
          color: colors.text,
          textShadowColor: 'transparent',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 0,
        },
      ]}
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
        // Use a colour-alpha channel instead of `style.opacity` —
        // nested <Text> elements inside a parent <Text> don't honour
        // `style.opacity` reliably on Android (the outer Text wins
        // and every word ends up at full opacity, blowing the
        // word-by-word reveal). Encoding the alpha into the colour
        // works the same way on both iOS and Android.
        //
        // We also have to bleed the alpha into the textShadow:
        // `type.body` (inherited via styles.cue on the parent <Text>)
        // sets `textShadowColor: rgba(0, 0, 0, 0.55)`. On Android and
        // web, the shadow keeps rendering on transparent glyphs — so
        // unrevealed words showed as solid black outlines. iOS short-
        // circuits shadow drawing when the glyph is fully transparent
        // so iOS never had the bug. Scaling the shadow alpha to match
        // the text alpha fixes Android + web without affecting iOS.
        //
        // Pass `textShadowOffset` and `textShadowRadius` alongside the
        // colour even though they're already inherited from the parent:
        // RN-Web's `createTextShadowValue` short-circuits and emits NO
        // `text-shadow` CSS at all if offset.width / offset.height /
        // radius are all zero on a given style object. Without the
        // explicit values, the child <span>'s alpha override gets
        // swallowed and CSS inheritance falls through to the parent's
        // black shadow — exactly the bug.
        //
        // colors.text is #E8EAF0 → rgb(232, 234, 240).
        return (
          <Text
            key={i}
            style={{
              color: `rgba(232, 234, 240, ${opacity})`,
              textShadowColor: `rgba(0, 0, 0, ${opacity * 0.55})`,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {spaced}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Overlay is fully transparent — the seamless transition relies on
  // the root layout's gradient + EnergyColumn showing through. The
  // Player only paints its own UI on top of that shared backdrop.
  // Slight navy tint on the overlay backdrop — when the Player
  // fades out at the end of an audio, this ensures the see-through
  // gap during the cross-fade reads as DARK NAVY (matches the app
  // bg), never as a transient near-white frame that the underlying
  // screen / shader transition can briefly expose. Low alpha so it
  // doesn't visibly dim the Player UI during normal playback.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,16,46,0.35)',
    zIndex: 80,
  },
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
  // Pre-roll countdown circle — accent border (no fill) + big number
  // + small overline label. Sits in the same circle slot as the play
  // button so the visual anchor is identical.
  preRollCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  preRollNumber: {
    ...type.display,
    fontVariant: ['tabular-nums'],
    lineHeight: undefined,
    fontWeight: '700',
  },
  preRollLabel: {
    ...type.overline,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
});
