import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, Platform, AppState } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedRef,
  scrollTo,
  runOnJS,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

// Animated wrapper around react-native-svg's <Path> so we can drive
// stroke opacity / width from a Reanimated shared value (the tree's
// energy pulse — see SilentMindTreeScreen).
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

import { BackButton } from '../src/components/BackButton';
import { AtmosphereBackground } from '../src/components/AtmosphereBackground';
import { VideoBackground } from '../src/components/VideoBackground';
import { silentMindVolets, introAudios, trackDuration, QM_TO_SM_PAIRING, type AudioTrack } from '../src/content/catalog';
import { TrackInfoSheet } from '../src/components/TrackInfoSheet';
import { useProgress, isTrackUnlocked } from '../src/player/progressStore';
import { usePlayerStore } from '../src/player/store';
import { colors, spacing, type as typo } from '../src/theme';
import { noOrphan } from '../src/utils/noOrphan';

/**
 * Continuous-tree visualisation of the Silent Mind program. Each track
 * is a circular node; the tree climbs bottom-up from "Welcome" at the
 * bottom to the deepest Part 3 practice at the top. SM tracks sit on
 * the left lane, paired QM counterparts on the right when one exists.
 * Each node carries its track title alongside it. Dashed horizontal
 * lines mark the transitions between Parts. Tap a node → opens the
 * Player on that track.
 */

type StageId = 'intro' | 'part1' | 'part2' | 'part3';
type Lane = 'sm' | 'qm';
type NodeState = 'locked' | 'available' | 'done' | 'soon';

// Vertical rhythm — pitch determines "how many stages per screen". At
// ~150 px per row pitch, a typical mobile viewport (~700 usable px)
// fits 4-5 rows + a couple of dashed-divider transitions.
const ROW_PITCH = 150;
const DIVIDER_GAP = 96;     // generous breathing room at part boundaries

// Node size — base radius is enlarged at runtime by the viewport-driven
// scale below so the dots don't read as tiny on phones with bigger
// screens or web previews.
const BASE_NODE_R = 22;

// Maximum width of the whole layout (tree + labels). On narrow phones
// we shrink to fit; on wider previews we cap so labels don't get
// uselessly wide.
const MAX_TOTAL_W = 420;
const TARGET_TREE_W = 180;
const MIN_TREE_W = 110;     // never shrink the tree below this — circles need room
const LABEL_PAD = 8;        // gap between circle edge and label
// Radius of the rounded corner on QM branch paths. MUST match the
// value used inside buildPathSegments — particles travel along the
// same arc so they need the same geometry.
const BRANCH_CORNER_R = 22;

// Layer types — each "row" carries exactly ONE track now (instead of
// the previous SM+QM-paired row). QM tracks are rendered as side
// branches off the trunk between two SM rows, so the trunk never
// splits — it stays as one continuous vertical axis with QM dots
// floating off the side.
type Layer =
  | { kind: 'sm-row'; track: AudioTrack; partId: StageId }
  | { kind: 'qm-branch'; track: AudioTrack; partId: StageId; pairedSmId: string }
  | { kind: 'divider' };

function buildLayers(): Layer[] {
  const layers: Layer[] = [];
  const processPart = (
    partId: StageId,
    sm: AudioTrack[],
    qm: AudioTrack[],
  ) => {
    // Walk the SM tracks in JOURNEY order (catalog order, p1-1 → p1-3)
    // and after each SM insert any QM that pairs with it. The result
    // reads in journey: p1-1 → p1-2 → qm1-2 → p1-3 → qm1-4 → … so the
    // QM branches sit "just after" their unlock SM.
    const journeyOrdered: Layer[] = [];
    for (const t of sm) {
      journeyOrdered.push({ kind: 'sm-row', track: t, partId });
      for (const q of qm) {
        if (q.comingSoon) continue;
        if (QM_TO_SM_PAIRING[q.id] === t.id) {
          journeyOrdered.push({ kind: 'qm-branch', track: q, partId, pairedSmId: t.id });
        }
      }
    }
    // Display order = reverse of journey (top of screen = end of
    // journey). Push to global layers list.
    journeyOrdered.reverse().forEach(l => layers.push(l));
  };

  const part3 = silentMindVolets.find(v => v.id === 'part3')!;
  processPart('part3', part3.tracks, part3.qmTracks ?? []);
  layers.push({ kind: 'divider' });

  const part2 = silentMindVolets.find(v => v.id === 'part2')!;
  processPart('part2', part2.tracks, part2.qmTracks ?? []);
  layers.push({ kind: 'divider' });

  const part1 = silentMindVolets.find(v => v.id === 'part1')!;
  processPart('part1', part1.tracks, part1.qmTracks ?? []);
  layers.push({ kind: 'divider' });

  processPart('intro', introAudios, []);
  return layers;
}

function partDescription(partId: StageId): string | undefined {
  const v = silentMindVolets.find(x => x.id === partId);
  return v?.description;
}

function partLabel(partId: StageId): string {
  // Legacy single-string label, kept for callers that don't need the
  // split rendering. The footer's <FooterPartLabel> uses
  // partLabelParts() below for the stacked "Mind-Body / *The Earth*"
  // layout.
  switch (partId) {
    case 'intro': return 'Introduction';
    case 'part1': return 'Mind-Body';
    case 'part2': return 'Stability & Equanimity';
    case 'part3': return 'Towards Silence';
  }
}

// Footer label split into "title" + optional "tagline", so the
// tagline can render in italic next to a regular-styled title:
//   PART 1 — *The Earth*
// Intro has no tagline (its name is just "Introduction").
function partLabelParts(partId: StageId): { title: string; tagline?: string } {
  // Titles match the catalog's official `subtitle` for each volet:
  // "Part 1 — Mind-Body" on the SM index, etc. The italic tagline
  // (The Earth / Sky / Space) keeps the poetic frame next to the
  // academic name.
  switch (partId) {
    case 'intro': return { title: 'Introduction' };
    case 'part1': return { title: 'Mind-Body', tagline: 'The Earth' };
    case 'part2': return { title: 'Stability & Equanimity', tagline: 'The Sky' };
    case 'part3': return { title: 'Towards Silence', tagline: 'The Space' };
  }
}

function nodeState(t: AudioTrack | null, listened: Record<string, true>): NodeState {
  if (!t) return 'locked';
  if (t.comingSoon) return 'soon';
  if (!isTrackUnlocked(t.id, listened)) return 'locked';
  if (listened[t.id]) return 'done';
  return 'available';
}

export default function SilentMindTreeScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const listened = useProgress(s => s.listened);
  const openPlayer = usePlayerStore(s => s.open);
  // useAnimatedRef so the worklet-side scroll handler can drive the
  // ScrollView directly via reanimated's scrollTo() helper (UI thread,
  // zero bridge crossing). JS-side code can still call
  // `scrollRef.current?.scrollTo(...)` exactly like before.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const layers = useMemo(() => buildLayers(), []);

  // Tree-wide energy pulse — slow sin breath that drives the halo
  // opacity on every lit node (up-next + done + playable). ~5 s
  // full cycle (2.5 s up + 2.5 s down). withSequence with two
  // withTimings — Easing.inOut(Easing.sin) on both legs makes the
  // crest and trough match velocity (= 0), so the sequence
  // boundary is smooth.
  const energyPulse = useSharedValue(0);
  useEffect(() => {
    energyPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [energyPulse]);

  // Upward-flowing energy along the white vertical axis. Counts 0 → 1
  // forever on a 4 s loop; in `EnergyPath` this drives a sin-shaped
  // brightness wave whose phase is offset by the segment's Y position
  // — bright peaks therefore travel UP the tree, like sap rising
  // through the trunk. Linear easing because the wave needs constant
  // speed; sin shaping happens per-segment from the phase offset.
  const flowTime = useSharedValue(0);
  useEffect(() => {
    // Same monotonic-clock pattern as the particle clocks: avoid the
    // withRepeat boundary that snapped the value 1 → 0 and produced
    // a visible jump in the trunk's brightness wave. EnergyPath uses
    // `% 1` to wrap.
    const CYCLES_AHEAD = 10000;
    flowTime.value = withTiming(CYCLES_AHEAD, {
      duration: 4000 * CYCLES_AHEAD,
      easing: Easing.linear,
    });
  }, [flowTime]);

  // Shared clocks for the rising particle field — one clock per kind
  // (trunk = long slow drift, branch = shorter cycle on the QM
  // side-branches). Each particle reads `(clock + phase) % 1`, so
  // distributing distinct phase offsets across the particles instantly
  // populates the trunk on first frame (= prewarm — no fill-up delay
  // when the user lands on the screen).
  const trunkClock = useSharedValue(0);
  const branchClock = useSharedValue(0);
  // Single bob shared value driving BOTH the up and the down
  // ScrollHints — passed down as a prop so the two chevrons (when
  // both visible) read the same phase and bob in perfect sync.
  // Mounting one later than the other doesn't desync them; the
  // shared value has been ramping the whole time.
  const scrollHintBob = useSharedValue(0);
  useEffect(() => {
    scrollHintBob.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [scrollHintBob]);
  useEffect(() => {
    // Particle "frame rate": each clock tick advances the particles
    // by 1 / PARTICLE_FPS of a second. Each AnimatedEllipse worklet
    // still evaluates at the native 60 Hz, but it reads the same
    // clock value for 3 frames in a row → reanimated emits only one
    // native style commit per 3 frames per ellipse, cutting SVG
    // GPU work by ~3× on the ~240 trunk+halo ellipses without any
    // visible difference (particles drift < 1 px per tick).
    //
    // Previously we drove these with two long withTiming() chains on
    // the UI thread (200000 × 10000 ms for the trunk, 50000 × 10000
    // for the branch). The new path uses a JS-side setInterval which
    // costs one shared-value write per 50 ms — negligible — and lets
    // us throttle the visible cadence with a single constant.
    const PARTICLE_FPS = 20;
    const STEP_MS = 1000 / PARTICLE_FPS;
    // Original cycle durations (kept identical so motion speed is
    // unchanged): trunk = 200 s / cycle, branch = 50 s / cycle.
    const TRUNK_CYCLE_MS = 200_000;
    const BRANCH_CYCLE_MS = 50_000;
    const start = Date.now();
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const elapsed = Date.now() - start;
      trunkClock.value = elapsed / TRUNK_CYCLE_MS;
      branchClock.value = elapsed / BRANCH_CYCLE_MS;
    };
    const startTicker = () => {
      if (id) return;
      tick(); // prime so the very first frame already has phase coverage
      id = setInterval(tick, STEP_MS);
    };
    const stopTicker = () => {
      if (id) { clearInterval(id); id = undefined; }
    };
    // Pause the 20 Hz particle ticker while the app is backgrounded.
    // The SM tree screen stays mounted in the navigation stack while
    // the user plays an audio (Player overlay), so this setInterval
    // would otherwise keep firing — and writing shared values that
    // reanimated tries to commit on the UI thread — even with the
    // screen locked. Burning CPU in background past iOS's 48 s /
    // 60 s watchdog triggers `memorystatus: killing due to cpulimit
    // violation` and kills our audio playback at ~45 s.
    if (AppState.currentState === 'active') startTicker();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') startTicker();
      else stopTicker();
    });
    return () => {
      stopTicker();
      sub.remove();
    };
  }, [trunkClock, branchClock]);

  // Responsive layout sizing.
  const totalW = Math.min(MAX_TOTAL_W, Math.max(220, winW - 16));
  // Tree recentred — SM trunk sits a bit left of the column centre so
  // the QM side branch has room to extend to the right. Labels live
  // on the wider side per track type: SM titles (the long ones) go on
  // the LEFT of the trunk (~155 px), QM titles on the RIGHT of their
  // branch dot (~135 px with the shorter branch arm below). Full
  // description opens in a bottom sheet on tap (see TrackInfoSheet).
  const CENTER_X = Math.round(totalW * 0.50);
  const SM_X = CENTER_X; // kept for buildPathSegments compatibility
  // Slightly shorter branch arm to give the QM label a bit more
  // right-side room without losing the visual side-branch read.
  const QM_X = CENTER_X + 48;
  // Node radius — gently scales up on wider viewports so the dots don't
  // read as a faint ring on big phones / desktop preview.
  const NODE_R = Math.min(30, Math.max(BASE_NODE_R, BASE_NODE_R + (winW - 360) * 0.03));

  // Snap-per-part page layout — each part fills exactly one viewport
  // height, the user snaps from one part to the next while scrolling.
  // Padding inside each page leaves room for the safe-area top, the
  // floating BackButton, and the dashed section header at the bottom.
  const pageH = winH;
  // Extra breathing room at the top of each page so the topmost row
  // doesn't sit right against the tagline / scroll hint. Same value
  // applied to every part page so the vertical rhythm stays even.
  const TOP_PAD = Math.max(120, insets.top + 96);
  // Bottom pad has to clear the fixed footer (≈ 100 px tag area +
  // dashed line + paddingBottom of insets.bottom + 12) AND leave
  // breathing room above it so the last track's label (which extends
  // ~45 px below the dot's centre Y) doesn't graze the dashed line.
  // Same `BOTTOM_PAD` is used for every part page (intro / earth /
  // sky / space) so they all get the same lift.
  const BOTTOM_PAD = Math.max(180, insets.bottom + 160);
  const DIVIDER_OFFSET = 28; // distance from page bottom to the dashed line

  // Order in which parts appear top-down in display (one page each).
  const pageOrder = useMemo(() => {
    const seen: StageId[] = [];
    for (const l of layers) {
      if ((l.kind === 'sm-row' || l.kind === 'qm-branch') && !seen.includes(l.partId)) {
        seen.push(l.partId);
      }
    }
    return seen;
  }, [layers]);

  // Per-layer Y positions. Track rows (SM + QM) of each part are
  // evenly distributed within that part's page; dividers sit near
  // the bottom of the page belonging to the part DIRECTLY ABOVE in
  // display order.
  const rowYs = useMemo(() => {
    const ys: number[] = new Array(layers.length).fill(0);
    const partRows: Partial<Record<StageId, number[]>> = {};
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (l.kind !== 'sm-row' && l.kind !== 'qm-branch') continue;
      (partRows[l.partId] ??= []).push(i);
    }
    pageOrder.forEach((partId, pageIdx) => {
      const indices = partRows[partId] ?? [];
      const n = indices.length;
      if (n === 0) return;
      const pageStartY = pageIdx * pageH;
      const trackArea = pageH - TOP_PAD - BOTTOM_PAD;
      const trackPitch = trackArea / n;
      indices.forEach((layerIdx, trackIdxInPage) => {
        ys[layerIdx] = pageStartY + TOP_PAD + (trackIdxInPage + 0.5) * trackPitch;
      });
    });
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].kind !== 'divider') continue;
      let partAbove: StageId | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const r = layers[j];
        if (r.kind === 'sm-row' || r.kind === 'qm-branch') { partAbove = r.partId; break; }
      }
      if (!partAbove) continue;
      const pageIdx = pageOrder.indexOf(partAbove);
      ys[i] = pageIdx * pageH + pageH - DIVIDER_OFFSET;
    }
    return ys;
  }, [layers, pageH, pageOrder, TOP_PAD, BOTTOM_PAD]);

  const totalH = useMemo(() => pageOrder.length * pageH, [pageOrder.length, pageH]);

  // For each divider, label the part DIRECTLY ABOVE it in display
  // order. Reading goes bottom-up (Welcome at the bottom is what the
  // user sees first), so the label sitting on a divider should label
  // the section you're about to enter going UP — i.e. the part whose
  // tracks sit ABOVE the divider in display.
  const dividerLabels = useMemo(() => {
    const out: { idx: number; partId: StageId }[] = [];
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].kind !== 'divider') continue;
      for (let j = i - 1; j >= 0; j--) {
        const prev = layers[j];
        if (prev.kind === 'sm-row' || prev.kind === 'qm-branch') {
          out.push({ idx: i, partId: prev.partId });
          break;
        }
      }
    }
    return out;
  }, [layers]);

  const bottomPartId: StageId | null = useMemo(() => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.kind === 'sm-row' || l.kind === 'qm-branch') return l.partId;
    }
    return null;
  }, [layers]);

  // The "next" track to listen to (drives the pulse animation on its
  // CircleNode). Re-evaluated each render, picking up live state.
  const nextTrackIdFn = useProgress(s => s.nextTrackId);
  const nextId = nextTrackIdFn();

  // Journey-position bounds derived from progress:
  //   • lastListenedY    = Y of the deepest-in-journey track that's
  //     been listened (= smallest Y across all listened layers).
  //     Drives the trunk's "lit/dim" boundary.
  //   • nextUpY / nextUpSmId = the SM immediately AFTER the last-
  //     listened SM in catalog journey order. Drives the trunk
  //     particle flow's top end. We compute this LOCALLY rather than
  //     reading useProgress().nextTrackId() because that store-level
  //     "next" is "first unlistened in the whole list" — a user who
  //     skipped intros and went straight to p1-1/p1-2 would have
  //     `nextId = intro-1`, which would point the particles back
  //     toward the bottom of the tree instead of toward the genuine
  //     next journey step (= Center of Gravity). The tree's mental
  //     model is "what's the next SM after the one I just finished?"
  //   • lastListenedSmId = id of the deepest-in-journey SM that's
  //     been listened. Branch particles run on its paired QM (the
  //     "you've just unlocked this" cue) until that QM is also done.
  const journeyBounds = useMemo(() => {
    // Walk the SM tracks in catalog journey order across all volets
    // (intro → part1 → part2 → part3, SM-only — QM tracks pair with
    // SM via QM_TO_SM_PAIRING and aren't part of the trunk).
    const smJourney: { id: string; layerIdx: number }[] = [];
    for (const v of silentMindVolets) {
      for (const t of v.tracks) {
        if (t.comingSoon) continue;
        const layerIdx = layers.findIndex(
          l => l.kind === 'sm-row' && l.track.id === t.id,
        );
        if (layerIdx >= 0) smJourney.push({ id: t.id, layerIdx });
      }
    }
    // Find the last-listened SM in journey order.
    let lastListenedSmJourneyIdx = -1;
    for (let i = 0; i < smJourney.length; i++) {
      if (listened[smJourney[i].id]) lastListenedSmJourneyIdx = i;
    }
    const lastListenedSmEntry =
      lastListenedSmJourneyIdx >= 0 ? smJourney[lastListenedSmJourneyIdx] : null;
    const nextSmEntry =
      lastListenedSmJourneyIdx + 1 < smJourney.length
        ? smJourney[lastListenedSmJourneyIdx + 1]
        : null;
    const lastListenedSmId = lastListenedSmEntry?.id ?? null;
    const lastListenedSmY =
      lastListenedSmEntry !== null ? rowYs[lastListenedSmEntry.layerIdx] : null;
    const nextUpSmId = nextSmEntry?.id ?? null;
    const nextUpY = nextSmEntry !== null ? rowYs[nextSmEntry.layerIdx] : null;
    // lastListenedY: smallest Y among ALL listened layers (SM + QM).
    // Kept around because the segment-lighting logic in
    // buildPathSegments treats QM-listened state as not contributing
    // to trunk lighting (QMs sit on side branches) — but the field
    // is still useful elsewhere.
    let lastListenedY: number | null = null;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (l.kind !== 'sm-row' && l.kind !== 'qm-branch') continue;
      if (listened[l.track.id]) {
        if (lastListenedY === null || rowYs[i] < lastListenedY) {
          lastListenedY = rowYs[i];
        }
      }
    }
    return {
      lastListenedY,
      lastListenedSmY,
      lastListenedSmId,
      nextUpY,
      nextUpSmId,
    };
  }, [layers, rowYs, listened]);

  // Per-part accent colours — replaces the previous "single pale-blue
  // for everything" scheme (too cold) and the rainbow gradient before
  // that. Each part now has its own warm-balanced hue that carries
  // through the dot border, the play triangle, the done-fill, and the
  // glow halo on the trunk segments belonging to that part.
  const partColor = (partId: StageId): string => {
    switch (partId) {
      case 'intro': return '#C9A66B'; // warm dawn gold — first connection
      case 'part1': return '#3D8E5E'; // vivid forest green — Earth
      case 'part2': return '#3D6BBA'; // dark blue — Sky
      case 'part3': return '#9B6FDD'; // purple — Space
    }
  };
  // Lookup: trackId → its part's accent. SM tracks live in their part's
  // `tracks`; QM tracks live in `qmTracks`. Intro tracks come from
  // `introAudios`.
  const trackPartIndex = useMemo(() => {
    const map: Record<string, StageId> = {};
    for (const t of introAudios) map[t.id] = 'intro';
    for (const v of silentMindVolets) {
      for (const t of v.tracks) map[t.id] = v.id as StageId;
      for (const t of (v.qmTracks ?? [])) map[t.id] = v.id as StageId;
    }
    return map;
  }, []);
  const trackColor = (id: string): string => {
    const partId = trackPartIndex[id];
    return partId ? partColor(partId) : '#E55050';
  };

  // Initial page = the HIGHEST-in-display part that has at least one
  // unlocked track (= the most advanced part the user can currently
  // reach). For a fresh user that's intro (only Welcome unlocked);
  // after Welcome → intro-2/4 → p1-1 unlocks → opens at part1; and
  // so on. Lands the user on "next step in the journey" rather than
  // always at the journey's start.
  //
  // Computed ONCE at mount via useState lazy init — the value seeds
  // the scrollY shared value and the ScrollView's contentOffset, so
  // the very first frame already shows the correct atmosphere.
  const [initialPageIdx] = useState<number>(() => {
    // Walk every PLAYABLE SM/QM layer and find the unlocked one with
    // the SMALLEST Y (= topmost on screen = most advanced in journey).
    // Coming-soon rows fall through isTrackUnlocked's "unknown id →
    // permissive" branch and would otherwise pull the initial page
    // up to part3 (where most coming-soon tracks live).
    let topMostUnlockedY: number | null = null;
    let topMostUnlockedPartId: StageId | null = null;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (l.kind !== 'sm-row' && l.kind !== 'qm-branch') continue;
      if (l.track.comingSoon) continue;
      if (!isTrackUnlocked(l.track.id, listened)) continue;
      if (topMostUnlockedY === null || rowYs[i] < topMostUnlockedY) {
        topMostUnlockedY = rowYs[i];
        topMostUnlockedPartId = l.partId;
      }
    }
    if (topMostUnlockedPartId !== null) {
      const idx = pageOrder.indexOf(topMostUnlockedPartId);
      if (idx >= 0) return idx;
    }
    // Fallback (no unlocked layers — shouldn't happen since Welcome
    // is always unlocked) → land on the bottommost page (intro).
    return Math.max(0, pageOrder.length - 1);
  });

  // Scroll-driven background fades. lake (Intro + P1) ↔ sky (P2) ↔
  // space (P3) crossfades happen across the inter-part dividers, with
  // a fade window centred on each boundary's Y in scroll content.
  const scrollY = useSharedValue(initialPageIdx * pageH);

  // Mirror of the discrete page index in React state — used to pause
  // background shaders/video that aren't currently visible. Updated by
  // the snap handlers below; initial value matches `initialPageIdx`
  // so the right backdrop is the only one running on first frame.
  const [currentPageIdx, setCurrentPageIdx] = useState<number>(initialPageIdx);

  // Track currently shown in the bottom-sheet details panel. Tapping
  // a title opens the sheet on that track; the dot itself still
  // launches the Player directly (two distinct affordances).
  const [sheetTrack, setSheetTrack] = useState<AudioTrack | null>(null);

  // Hard snap-per-page: as soon as the scroll position drifts more
  // than a few px from the current settled page, we IMMEDIATELY commit
  // to the next page in the drag direction — no debounce, no waiting
  // for the gesture to settle. The scroll is also locked
  // (scrollEnabled=false) for the duration of the smooth scrollTo so
  // continued user input doesn't drag the position past the target.
  // Result: one continuous motion that lands on the next page centre.
  const settledPage = useRef(initialPageIdx);
  const isSnapping = useRef(false);
  // UI-thread mirrors of the two JS refs above. The scroll worklet
  // (useAnimatedScrollHandler) reads these on the UI thread — it can't
  // touch the refs — and JS-side snap entry points keep them in sync
  // when they fire (goToPage, web wheel handler, settle timeout).
  const settledPageSV = useSharedValue(initialPageIdx);
  const isSnappingSV = useSharedValue(0);
  const setScrollLocked = (locked: boolean) => {
    try {
      // setNativeProps is the cheapest way to toggle scrollEnabled on
      // a live ScrollView ref without re-rendering the whole subtree.
      (scrollRef.current as any)?.setNativeProps?.({ scrollEnabled: !locked });
    } catch {
      /* native may not expose the prop — animation still runs */
    }
  };
  // Programmatic page jump — used by the scroll-hint chevrons when
  // they're tapped as buttons. Reuses the same snap-then-clamp dance
  // as the scroll-driven path so chevron taps and gestures land in
  // the same end state (one stable target Y, no double-advance).
  const goToPage = (targetPage: number) => {
    if (targetPage < 0 || targetPage >= pageOrder.length) return;
    if (targetPage === settledPage.current) return;
    isSnapping.current = true;
    isSnappingSV.value = 1;
    settledPage.current = targetPage;
    settledPageSV.value = targetPage;
    setScrollLocked(true);
    const targetY = targetPage * pageH;
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
    // Defer the React state update one frame so the native scroll
    // animation gets to start before we reconcile this ~2200-line
    // component (dozens of useAnimatedStyle hooks). Without the
    // defer, Android visibly stutters at the start of each snap.
    requestAnimationFrame(() => setCurrentPageIdx(targetPage));
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
      isSnapping.current = false;
      isSnappingSV.value = 0;
      setScrollLocked(false);
    }, 480);
  };

  // JS-side bookkeeping after the worklet has already detected a snap
  // and dispatched the native scrollTo. We only get here once per page
  // change (vs the old JS-thread onScroll which fired 60×/sec just to
  // update scrollY.value), so the heavy React reconciliation is paid
  // exactly once per page transition instead of every animation frame.
  const onSnapStarted = (targetPage: number) => {
    isSnapping.current = true;
    settledPage.current = targetPage;
    setScrollLocked(true);
    const targetY = targetPage * pageH;
    requestAnimationFrame(() => setCurrentPageIdx(targetPage));
    setTimeout(() => {
      // Hard-clamp to the target page on lock release — see comment
      // history; some scroll sources (web wheel) emit events even with
      // scrollEnabled=false and a stale tick can land mid-page.
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
      isSnapping.current = false;
      isSnappingSV.value = 0;
      setScrollLocked(false);
    }, 480);
  };

  // Worklet-side scroll handler — runs on the UI thread directly, no
  // bridge crossing per scroll event. Writes scrollY.value (drives the
  // background-crossfade + footer-label worklets), detects snap
  // conditions, and dispatches the native scroll + a one-shot
  // runOnJS to the JS-side bookkeeping above. On Android this is the
  // difference between smooth and stutter when the JS thread is busy
  // reconciling.
  const pageOrderLength = pageOrder.length;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      const y = e.contentOffset.y;
      scrollY.value = y;
      if (isSnappingSV.value) return;
      const settledY = settledPageSV.value * pageH;
      const delta = y - settledY;
      if (Math.abs(delta) <= 6) return; // ignore micro-jitter
      const direction = delta > 0 ? 1 : -1;
      let target = settledPageSV.value + direction;
      if (target < 0) target = 0;
      if (target > pageOrderLength - 1) target = pageOrderLength - 1;
      isSnappingSV.value = 1;
      settledPageSV.value = target;
      // Animated scroll on the UI thread.
      scrollTo(scrollRef, 0, target * pageH, true);
      runOnJS(onSnapStarted)(target);
    },
  });

  // Page boundaries (= page index × pageH) drive the shader crossfade
  // worklets. The boundary between P3 and P2 sits at the bottom of P3's
  // page; same for P2 ↔ P1.
  const { yP2P3, yP1P2, yPart1Top, yPart1Bottom, idxPart1Page, idxPart2Page, idxPart3Page } = useMemo(() => {
    const idxP3 = pageOrder.indexOf('part3');
    const idxP2 = pageOrder.indexOf('part2');
    const idxP1 = pageOrder.indexOf('part1');
    return {
      yP2P3: idxP3 >= 0 ? (idxP3 + 1) * pageH : 0,
      yP1P2: idxP2 >= 0 ? (idxP2 + 1) * pageH : 0,
      yPart1Top: idxP1 >= 0 ? idxP1 * pageH : 0,
      yPart1Bottom: idxP1 >= 0 ? (idxP1 + 1) * pageH : 0,
      // Page indexes (display top-down) — used to pause inactive
      // backgrounds. -1 means "this part has no page", so the
      // `paused` predicate below never matches and the layer stays
      // paused (= correct, since it's not in the journey).
      idxPart1Page: idxP1,
      idxPart2Page: idxP2,
      idxPart3Page: idxP3,
    };
  }, [pageOrder, pageH]);

  const FADE_PX = 220;
  const skyAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value + winH / 2;
    const t = Math.max(0, Math.min(1, (yP1P2 + FADE_PX - y) / (2 * FADE_PX)));
    return { opacity: t };
  });
  const spaceAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value + winH / 2;
    const t = Math.max(0, Math.min(1, (yP2P3 + FADE_PX - y) / (2 * FADE_PX)));
    return { opacity: t };
  });
  // Earth (Part 1) gets the video bg on top of lake. Visible only
  // when the viewport centre is on the part1 page; fades at BOTH
  // edges (up-toward part2 = yPart1Top, down-toward intro =
  // yPart1Bottom). The intro page falls back to the lake shader
  // alone (intro/earth swap from the previous iteration).
  const earthVideoStyle = useAnimatedStyle(() => {
    const y = scrollY.value + winH / 2;
    const fadeIn  = Math.max(0, Math.min(1, (y - yPart1Top + FADE_PX) / (2 * FADE_PX)));
    const fadeOut = Math.max(0, Math.min(1, (yPart1Bottom + FADE_PX - y) / (2 * FADE_PX)));
    return { opacity: Math.min(fadeIn, fadeOut) };
  });

  // Web only: intercept wheel/trackpad events directly so we can
  // call preventDefault() and stop the browser's native scroll-with-
  // momentum from running multiple pages of distance during one
  // gesture. A fixed cooldown (700 ms) wasn't enough — macOS
  // trackpad sends inertia wheel events for 1–2 s after a flick,
  // and any event landing after the cooldown expired would trigger
  // another snap → one gesture = 2-3 page jumps. Instead we use a
  // "quiet-time" lock: each wheel event extends a 150 ms idle
  // timer; the lock only releases once the user has stopped
  // generating wheel events for that long. One gesture = one snap.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let locked = false;
    let momentumTimer: ReturnType<typeof setTimeout> | null = null;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 4) return;
      // Reset the idle timer on every wheel event — the lock stays
      // engaged as long as events keep arriving.
      if (momentumTimer) clearTimeout(momentumTimer);
      momentumTimer = setTimeout(() => {
        locked = false;
        momentumTimer = null;
      }, 150);
      if (locked) return;
      const direction = Math.sign(e.deltaY);
      const targetPage = Math.max(
        0,
        Math.min(pageOrder.length - 1, settledPage.current + direction),
      );
      if (targetPage === settledPage.current) return;
      locked = true;
      isSnapping.current = true;
      isSnappingSV.value = 1;
      settledPage.current = targetPage;
      settledPageSV.value = targetPage;
      setCurrentPageIdx(targetPage);
      scrollRef.current?.scrollTo({ y: targetPage * pageH, animated: true });
      setTimeout(() => {
        isSnapping.current = false;
        isSnappingSV.value = 0;
      }, 700);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (momentumTimer) clearTimeout(momentumTimer);
    };
  }, [pageH, pageOrder.length]);

  // Land the user on the page that contains the next track they have
  // to listen to — bottom (Welcome's page) for a first connection,
  // P1 once the intro is finished, etc. The shared `scrollY` was
  // already seeded with `initialPageIdx * pageH` above, so the bg
  // layers compute the right opacity from frame 1; this scrollTo
  // brings the actual ScrollView position to match.
  useEffect(() => {
    const id = setTimeout(() => {
      isSnapping.current = true;
      scrollRef.current?.scrollTo({ y: initialPageIdx * pageH, animated: false });
      setTimeout(() => { isSnapping.current = false; }, 200);
    }, 50);
    return () => clearTimeout(id);
  }, [initialPageIdx, pageH]);

  const playTrack = (lane: Lane, partId: StageId, t: AudioTrack) => {
    if (t.comingSoon || !isTrackUnlocked(t.id, listened)) return;
    let playlist: AudioTrack[] = [];
    if (partId === 'intro') {
      playlist = introAudios.filter(x => !x.comingSoon);
    } else {
      const v = silentMindVolets.find(s => s.id === partId);
      if (v) {
        const list = lane === 'sm' ? v.tracks : (v.qmTracks ?? []);
        playlist = list.filter(x => !x.comingSoon);
      }
    }
    // Pass the dot's rainbow colour to the Player so its play button
    // and accent UI inherit the journey-stage hue.
    openPlayer(t, playlist, { autoStart: true, accent: trackColor(t.id) });
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: '' }} />

      {/* Layered shader backgrounds — lake at the bottom (always full
          opacity, covers Intro + P1), sky on top fading in across the
          P1↔P2 boundary, space on top of sky fading in across the
          P2↔P3 boundary. The result: smooth crossfade between three
          atmospheres as the user scrolls through the journey. */}
      {/* Background stack — `paused` is gated by `currentPageIdx`
          so the GL/video for layers that aren't visible on the
          settled page stop computing frames. Lake stays running as
          a cheap baseline (it's also the intro page bg). With
          snap-per-page, transitions are short enough that we only
          run the layer the user is parked on, no adjacent-warm-up. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={StyleSheet.absoluteFill}>
          <AtmosphereBackground theme="lake" />
        </View>
        {/* Earth (Part 1) gets the "shadow wall" video on top of the
            lake — the video matches the Earth atmosphere on the Start
            tab. Fades in/out at both edges of the part1 page. Intro
            stays on the calmer lake shader alone (no video) for a
            quieter "first connection" atmosphere. */}
        <Animated.View style={[StyleSheet.absoluteFill, earthVideoStyle]}>
          <VideoBackground paused={currentPageIdx !== idxPart1Page} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, skyAnimStyle]}>
          <AtmosphereBackground theme="sky" paused={currentPageIdx !== idxPart2Page} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, spaceAnimStyle]}>
          <AtmosphereBackground theme="space" paused={currentPageIdx !== idxPart3Page} />
        </Animated.View>
      </View>

      <Animated.ScrollView
        ref={scrollRef as never}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        decelerationRate="fast"
        // Lock the scroll past intro (the last page). Without these,
        // pulling beyond the bottom revealed empty space below the
        // tree content where the bg shaders had nothing to paint.
        // bounces={false} for iOS, overScrollMode for Android,
        // overscrollBehavior:contain (CSS, web) — they all do the
        // same thing: hard-clamp at the content edge, no rubber-band.
        bounces={false}
        overScrollMode="never"
        style={{ overscrollBehavior: 'contain' } as any}
      >
        <View style={[styles.tree, { width: totalW, height: totalH }]}>
          <Svg
            width={totalW}
            height={totalH}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {buildPathSegments(layers, rowYs, SM_X, QM_X, CENTER_X, NODE_R, listened, flowTime, totalH, partColor, journeyBounds.lastListenedSmY, pageOrder, pageH)}
            {(() => {
              // Trunk + branch particle field. Always renders as long
              // as there's a next-up to flow toward; when the user has
              // no progress, yBottom falls back to the Welcome row
              // (bottommost layer) and the flow heads to the topmost
              // unlocked SM (intro destinations are unlocked from the
              // first launch, so something is always reachable).
              const nextUpY = journeyBounds.nextUpY;
              if (nextUpY === null) return null;
              // Bottom anchor = Welcome (bottom-most accessible row).
              // Particles ascend through the entire accessible journey
              // — the lit section AND the unlit "next up" gap —
              // instead of starting at lastListenedY. Keeps the tree
              // feeling alive everywhere, not just in the small band
              // between the most recent track and the up-next one.
              let yBottom: number | null = null;
              for (let i = layers.length - 1; i >= 0; i--) {
                const l = layers[i];
                if (l.kind === 'sm-row' || l.kind === 'qm-branch') {
                  yBottom = rowYs[i];
                  break;
                }
              }
              if (yBottom === null) return null;
              // When the fallback collapses (yBottom === nextUpY, which
              // happens on a fresh user since nextId IS Welcome), aim
              // the flow at the topmost unlocked layer so there's
              // always a visible ascending stream from day 1.
              let topY = nextUpY;
              if (topY >= yBottom) {
                // Fresh-user case: nextUp IS Welcome (the bottom-most
                // layer), so the range collapses. Aim instead at the
                // layer with the LARGEST Y strictly above Welcome —
                // gives particles somewhere to flow from day 1, and
                // matches "next SM in journey after Welcome" for the
                // standard catalog (= intro-2).
                let nearest: number | null = null;
                for (let i = 0; i < layers.length; i++) {
                  const l = layers[i];
                  if (l.kind !== 'sm-row' && l.kind !== 'qm-branch') continue;
                  if (rowYs[i] >= yBottom) continue; // skip Welcome itself
                  if (nearest === null || rowYs[i] > nearest) nearest = rowYs[i];
                }
                if (nearest === null) return null;
                topY = nearest;
              }
              // Pull the upper end DOWN so the particle's full ellipse
              // stays below the next-up node — without this, the
              // streak's top edge (cy − ry ≈ cy − 11 px) punches
              // through the node when cy reaches nextUpY. NODE_R + a
              // small buffer is enough to keep the visual contained.
              const PARTICLE_TOP_PAD = NODE_R + 6;
              const topYClamped = Math.min(topY + PARTICLE_TOP_PAD, yBottom - 8);
              const yRange = yBottom - topYClamped;
              if (yRange <= 0) return null;
              // 1 particle / 12 px — each particle renders as core
              // + halo (2 ellipses), so we cap at 60 (= 120 ellipses
              // on the trunk). Was 120 / 6 px / 240 ellipses, which
              // ran the phone warm; at the density we use the trunk
              // still reads as a continuous stream of mist.
              const PARTICLE_COUNT = Math.max(20, Math.min(60, Math.round(yRange / 12)));
              const trunkParticles = Array.from({ length: PARTICLE_COUNT }, (_, k) => {
                const phase = k / PARTICLE_COUNT;
                // Three independent deterministic seeds — opacity/size,
                // speed, and an INDEPENDENT vertical-stretch ratio so
                // some particles read as short dots and others as
                // elongated streaks (no shared aspect ratio across the
                // field).
                const sScale = ((k * 1664525 + 1013904223) % 233280) / 233280;
                const sSpeed = ((k * 2654435761 + 374761393) % 233280) / 233280;
                const sLength = ((k * 1103515245 + 12345) % 233280) / 233280;
                const opacityScale = 0.6 + sScale * 0.4;
                const sizeScale = 0.7 + sScale * 0.3;
                // 0.5..1.9 → 3.8× spread in vertical length. Short
                // particles stay near a dot shape, long ones look like
                // brief comet trails.
                const lengthScale = 0.5 + sLength * 1.4;
                const speedMul = 0.55 + sSpeed * 0.9;
                return (
                  <TrunkParticle
                    key={`particle-${k}`}
                    cx={CENTER_X}
                    yTop={topYClamped}
                    yBottom={yBottom!}
                    clock={trunkClock}
                    phase={phase}
                    speedMul={speedMul}
                    color="rgba(255, 255, 255, 1)"
                    opacityScale={opacityScale}
                    sizeScale={sizeScale}
                    lengthScale={lengthScale}
                  />
                );
              });
              // QM branch particles — on each QM whose paired SM is
              // EITHER the last-listened SM (just-unlocked alternative)
              // OR the next-up SM (upcoming preview).
              const smYById = new Map<string, number>();
              for (let i = 0; i < layers.length; i++) {
                const l = layers[i];
                if (l.kind === 'sm-row') smYById.set(l.track.id, rowYs[i]);
              }
              const branchParticles: React.ReactNode[] = [];
              const BRANCH_PER_BRANCH = 6;
              layers.forEach((l, i) => {
                if (l.kind !== 'qm-branch') return;
                // Branch particles render only on QMs the user has
                // ACTUALLY UNLOCKED — paired SM must be listened
                // AND the QM itself not done yet. Anything farther
                // ahead in the journey (paired SM still locked) stays
                // particle-free; without this gate, every QM branch
                // would glow from day 1 even when the user is several
                // SMs away from being able to play them.
                if (!listened[l.pairedSmId]) return;
                if (listened[l.track.id]) return;
                const smY = smYById.get(l.pairedSmId);
                if (smY === undefined) return;
                const qmY = rowYs[i];
                for (let k = 0; k < BRANCH_PER_BRANCH; k++) {
                  const phase = k / BRANCH_PER_BRANCH;
                  const sScale = ((k * 1664525 + i * 1013904223) % 233280) / 233280;
                  const sSpeed = ((k * 2654435761 + i * 374761393) % 233280) / 233280;
                  const sLength = ((k * 1103515245 + i * 12345 + 7) % 233280) / 233280;
                  branchParticles.push(
                    <BranchParticle
                      key={`branch-${i}-${k}`}
                      trunkX={CENTER_X}
                      cornerX={QM_X}
                      smY={smY}
                      qmY={qmY}
                      nodeR={NODE_R}
                      clock={branchClock}
                      phase={phase}
                      speedMul={0.55 + sSpeed * 0.9}
                      color="rgba(255, 255, 255, 1)"
                      opacityScale={0.6 + sScale * 0.4}
                      sizeScale={0.7 + sScale * 0.3}
                      lengthScale={0.5 + sLength * 1.4}
                    />,
                  );
                }
              });
              return [...trunkParticles, ...branchParticles];
            })()}
          </Svg>

          {/* Section headers used to live inside the scroll content;
              they're now rendered as a FIXED footer below (outside
              this scrollable container) so they don't move while the
              user scrolls — instead the part name crossfades from one
              to the next. */}

          {layers.map((l, i) => {
            if (l.kind === 'divider') return null;
            const y = rowYs[i];
            const state = nodeState(l.track, listened);
            const isSm = l.kind === 'sm-row';
            const cx = isSm ? CENTER_X : QM_X;
            // SM titles (the longer ones in the catalog) sit on the
            // LEFT of the trunk dot — wider left gutter on a centred
            // tree, so 36-char titles like "Self-Observation and
            // Breath Following" wrap to 2 lines without truncation.
            // QM titles (shorter — "QM3 — Breathing Body") sit on
            // the RIGHT of their branch dot.
            const labelOnLeft = isSm;
            const labelLeft = labelOnLeft
              ? LABEL_PAD
              : cx + NODE_R + LABEL_PAD;
            const labelWidth = labelOnLeft
              ? cx - NODE_R - LABEL_PAD - LABEL_PAD
              : totalW - labelLeft - LABEL_PAD;
            const duration = trackDuration(l.track) ?? undefined;
            return (
              <View key={`row-${i}`} pointerEvents="box-none">
                <CircleNode
                  cx={cx}
                  cy={y}
                  radius={NODE_R}
                  accent={trackColor(l.track.id)}
                  state={state}
                  isNext={l.track.id === nextId}
                  energyPulse={energyPulse}
                  onPress={() => playTrack(isSm ? 'sm' : 'qm', l.partId, l.track)}
                />
                <Label
                  key={`label-${i}`}
                  text={l.track.title}
                  duration={duration}
                  state={state}
                  align={labelOnLeft ? 'right' : 'left'}
                  onPress={() => setSheetTrack(l.track)}
                  cy={y}
                  left={labelLeft}
                  width={labelWidth}
                />
              </View>
            );
          })}
        </View>
      </Animated.ScrollView>

      {/* Tree edge fades — semi-opaque navy → transparent gradients
          covering the top + bottom of the scroll content so the tree
          doesn't overlap the part tagline (top) or the part-name
          banner (bottom). Also gives the scroll-hint chevrons a clean
          dim band to render against. Drawn AFTER the ScrollView so
          they sit on top, but BEFORE the chevrons + tagline + footer
          so those still render above the fade. */}
      <View
        pointerEvents="none"
        style={[styles.treeEdgeTop, { top: 0, height: insets.top + 150 }]}
      >
        <LinearGradient
          colors={['rgba(0,16,46,0.92)', 'rgba(0,16,46,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.treeEdgeBottom, { bottom: 0, height: insets.bottom + 210 }]}
      >
        <LinearGradient
          colors={['rgba(0,16,46,0)', 'rgba(0,16,46,0.92)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* The italic tagline "The Earth / Sky / Space" used to live up
          here, but on iPhones with a notch it landed right over the
          speaker/Dynamic Island. Moved back into the footer banner,
          between the part title and description. */}

      {/* Scroll affordances — small pulsing chevrons hinting at the
          adjacent pages. The up chevron vanishes when the user is on
          page 0; the down chevron vanishes on the last page. Sits
          inside the safe area below the header and above the footer
          banner so it never overlaps the dashed line. */}
      {/* Up chevron — mounts only when there's a page above the
          current one. `box-none` on the wrap so taps anywhere in the
          banded area pass through except on the Pressable itself. */}
      {currentPageIdx > 0 ? (
        <View
          pointerEvents="box-none"
          // top offset reduced by 3 px (vs original 24) to compensate
          // for the larger glyph: lineHeight 22 vs 16 shifts the visual
          // centre down by (22-16)/2 = 3 px. Keeps the chevron at the
          // exact same screen Y as before the visibility boost.
          style={[styles.scrollHintTopWrap, { top: insets.top + 21 }]}
        >
          <ScrollHint
            direction="up"
            bob={scrollHintBob}
            onPress={() => goToPage(currentPageIdx - 1)}
          />
        </View>
      ) : null}
      {/* Down chevron — mounts only when there's a page below. Intro
          is the journey's first step (bottom of scroll), so we also
          explicitly suppress the chevron there even if the index
          math would have allowed it (defensive — the previous
          opacity-fade approach left ghost taps visible on intro). */}
      {currentPageIdx < pageOrder.length - 1 &&
      pageOrder[currentPageIdx] !== 'intro' ? (
        <View
          pointerEvents="box-none"
          // bottom offset reduced by 3 px (vs original 168) — same
          // compensation as the top wrap, but mirrored: anchored by
          // `bottom`, the larger glyph's centre sits 3 px farther
          // from the bottom edge, so we drop the wrap to bring it
          // back to the original screen Y.
          style={[styles.scrollHintBottomWrap, { bottom: insets.bottom + 165 }]}
        >
          <ScrollHint
            direction="down"
            bob={scrollHintBob}
            onPress={() => goToPage(currentPageIdx + 1)}
          />
        </View>
      ) : null}

      {/* Fixed footer — section header for the part the user is
          currently looking at. Crossfades smoothly between part names
          as the user scrolls between snap-pages. The dashed line stays
          put; only the label inside it changes. */}
      <View
        pointerEvents="none"
        style={[styles.fixedFooter, { paddingBottom: insets.bottom + 12 }]}
      >
        <View style={[styles.fixedFooterDashedLine, { width: '100%' }]} />
        <View style={styles.fixedFooterLabelArea}>
          {pageOrder.map((partId, idx) => (
            <FooterPartLabel
              key={partId}
              partId={partId}
              pageIdx={idx}
              scrollY={scrollY}
              pageH={pageH}
            />
          ))}
        </View>
      </View>

      {/* Back button rendered LAST so it sits on top of everything
          (ScrollView, footer, bg layers). Previously placed before
          the ScrollView, which on react-native-web paints over an
          absolute-positioned sibling even with a zIndex — moving it
          to the end fixes the unreachable tap target. */}
      <BackButton />

      {/* Track-detail bottom sheet — opened by tapping a label.
          Tapping the dot still launches the Player directly; the
          sheet has its own Play CTA for the in-sheet flow. */}
      <TrackInfoSheet
        visible={sheetTrack !== null}
        track={sheetTrack}
        accent={sheetTrack ? trackColor(sheetTrack.id) : colors.accent}
        locked={sheetTrack ? !isTrackUnlocked(sheetTrack.id, listened) : false}
        description={
          sheetTrack
            ? typeof sheetTrack.description === 'string'
              ? sheetTrack.description
              : Array.isArray(sheetTrack.description)
                ? sheetTrack.description.map(d => d.text).join(' ')
                : undefined
            : undefined
        }
        onClose={() => setSheetTrack(null)}
        onPlay={() => {
          if (!sheetTrack) return;
          const partId = trackPartIndex[sheetTrack.id];
          const isQm = sheetTrack.id.startsWith('qm');
          if (partId) playTrack(isQm ? 'qm' : 'sm', partId, sheetTrack);
          setSheetTrack(null);
        }}
      />
    </View>
  );
}

function FooterPartLabel({
  partId,
  pageIdx,
  scrollY,
  pageH,
}: {
  partId: StageId;
  pageIdx: number;
  scrollY: { value: number };
  pageH: number;
}) {
  const animStyle = useAnimatedStyle(() => {
    const t = scrollY.value / pageH;
    // Linear-interpolated opacity: 1 when this page is centred, 0
    // when an adjacent page is centred, smooth in between.
    return { opacity: Math.max(0, 1 - Math.abs(t - pageIdx)) };
  });
  const description = partDescription(partId);
  const labelParts = partLabelParts(partId);
  return (
    <Animated.View style={[styles.footerLabelLayer, animStyle]}>
      <View style={styles.partTag}>
        <Text style={styles.partName} numberOfLines={1}>
          {labelParts.title}
        </Text>
        {labelParts.tagline ? (
          <Text style={styles.partTagline} numberOfLines={1}>
            {labelParts.tagline}
          </Text>
        ) : null}
        {description ? (
          <Text style={styles.partDescription} numberOfLines={3}>
            {noOrphan(description)}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

// Top-of-screen tagline — "The Earth" / "The Sky" / "The Space" in
// italic, sitting just below the safe-area inset. Crossfades between
// part pages the same way FooterPartLabel does. Intro page has no
// tagline (no header label rendered).
function HeaderPartLabel({
  partId,
  pageIdx,
  scrollY,
  pageH,
}: {
  partId: StageId;
  pageIdx: number;
  scrollY: { value: number };
  pageH: number;
}) {
  const animStyle = useAnimatedStyle(() => {
    const t = scrollY.value / pageH;
    return { opacity: Math.max(0, 1 - Math.abs(t - pageIdx)) };
  });
  const labelParts = partLabelParts(partId);
  // Parts 1/2/3 use the italic tagline (The Earth / Sky / Space);
  // the intro page has no tagline, so we surface its `title`
  // ("Introduction") in the same slot with the same style — gives
  // every page a top heading at the same vertical anchor.
  const headerText = labelParts.tagline ?? labelParts.title;
  if (!headerText) return null;
  return (
    <Animated.View style={[styles.headerLabelLayer, animStyle]} pointerEvents="none">
      <Text style={styles.headerTagline} numberOfLines={1}>
        {headerText}
      </Text>
    </Animated.View>
  );
}

// Scroll affordance + button — a small chevron that bobs gently in
// the hint direction AND triggers a page jump on tap. Caller is
// responsible for only mounting it when there's somewhere to go
// (we no longer fade-out via a `visible` prop; conditional render
// means the chevron isn't present at all on the first / last page).
function ScrollHint({
  direction,
  bob,
  onPress,
}: {
  direction: 'up' | 'down';
  /** Shared bob value supplied by the parent so both chevrons
   *  (when both are mounted) read the EXACT same phase and stay
   *  in lockstep. Cadence + amplitude live at the call site. */
  bob: SharedValue<number>;
  onPress: () => void;
}) {
  // Bob is computed in the CHILD's frame (always negative translateY),
  // and the wrapper applies a static 180° rotation for the down
  // chevron. This separation matters:
  //   • mixing { translateY } and { rotate } in a single animated
  //     transform array seems to break the bob on react-native-web
  //     (the up chevron sat still, only the down one moved)
  //   • the parent's static rotation also flips the bob direction
  //     for free — child bobs "up" → screen-down for the rotated
  //     down chevron, screen-up for the up chevron, both correct.
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -bob.value * 10 }],
    // Pulse 0.85 → 1, peak when the chevron is at the top of its arc.
    opacity: 0.85 + bob.value * 0.15,
  }));
  return (
    <Pressable
      onPress={onPress}
      hitSlop={16}
      style={({ pressed }) => [
        direction === 'up' ? styles.scrollHintUp : styles.scrollHintDown,
        { opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View
        style={
          direction === 'down' ? styles.scrollHintRotate : undefined
        }
      >
        <Animated.View style={animStyle}>
          <Text style={styles.scrollHintGlyph}>⌃</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

function CircleNode({
  cx,
  cy,
  radius,
  accent,
  state,
  isNext,
  energyPulse,
  onPress,
}: {
  cx: number;
  cy: number;
  radius: number;
  accent: string;
  state: NodeState;
  isNext: boolean;
  energyPulse: SharedValue<number>;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const soon = state === 'soon';
  const done = state === 'done';
  const dimmed = locked || soon;
  const playable = !dimmed && !done;
  const D = radius * 2;
  const HIT = D + 16;

  // Local animations for the next-up node — breath scale + slow sway +
  // expanding ripple ring. Halo OPACITY is driven by the tree-wide
  // `energyPulse` prop instead of a local shared value, so the
  // up-next glow stays in phase with the done-node glow (the user
  // pinned this — having every glow on a different period read as
  // visual chaos, not "alive").
  const ripple = useSharedValue(0); // 0..1 ramp, 1.6 s — expanding ring
  // Ripple runs on every tappable-and-unlistened node — the "this
  // is available, tap me" cue the user asked for systematically.
  // No scale breath on the dot itself anymore: the dot stays
  // perfectly still, only the halo and ripple do the animating.
  const wantsRipple = isNext || playable;
  useEffect(() => {
    if (wantsRipple) {
      // Sequence: snap-to-0 (1 ms, invisible reset) → expand 0→1
      // over 2800 ms (the ring grows + fades) → hold at 1 (=
      // ring invisible since opacity = 0) for 2000 ms before the
      // next ring starts. Gives a clear gap between successive
      // emanations instead of a continuous chain.
      ripple.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1 }),
          withTiming(1, { duration: 2800, easing: Easing.out(Easing.quad) }),
          withDelay(2000, withTiming(1, { duration: 1 })),
        ),
        -1, false,
      );
    } else {
      ripple.value = withTiming(0, { duration: 240 });
    }
  }, [wantsRipple]);
  // Composite animation:
  //   • Up-next node: scale breath + slow Y sway + ripple ring +
  //     halo opacity that follows the tree-wide `energyPulse` (so the
  //     up-next glow pulses IN PHASE with every done node).
  //   • Done node: subtle scale (1 → 1.03) + halo opacity, both keyed
  //     off the same `energyPulse` — every lit dot breathes together.
  //   • Other states: static, no glow.
  // No animation on the main dot itself — it stays still. All
  // motion happens in the halo (opacity pulse) and ripple ring
  // (expand & fade) layers behind it.
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 }] }));
  // Outer ripple ring — renders on every tappable + unlistened node.
  // Slightly dialed back: smaller max scale (1 → 1.7 vs 1 → 2.0) and
  // gentler baseline opacity, so the rings read as a quiet pulse
  // rather than dominating the screen.
  const rippleStyle = useAnimatedStyle(() => {
    if (!wantsRipple) return { transform: [{ scale: 1 }], opacity: 0 };
    const baseOpacity = isNext ? 0.85 : 0.70;
    return {
      transform: [{ scale: 1 + 0.7 * ripple.value }],
      opacity: Math.max(0, baseOpacity * (1 - ripple.value)),
    };
  });
  // Standalone halo layer — separate Animated.View positioned BEHIND
  // the main dot, with a static box-shadow and an animated `opacity`.
  // Reanimated reliably animates `opacity` on web (vs `shadowOpacity`
  // which doesn't propagate to react-native-web's box-shadow CSS
  // unless the layer is also re-composited by another animation —
  // why isNext's halo was the only visible one). Driving the WHOLE
  // View's opacity means the shadow it casts fades with it.
  const haloStyle = useAnimatedStyle(() => {
    if (isNext) return { opacity: 0.55 + 0.45 * energyPulse.value };
    if (done) return { opacity: 0.25 + 0.55 * energyPulse.value };
    if (playable) return { opacity: 0.55 + 0.40 * energyPulse.value };
    return { opacity: 0 };
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={dimmed}
      hitSlop={6}
      style={({ pressed }) => [
        {
          position: 'absolute',
          left: cx - HIT / 2,
          top: cy - HIT / 2,
          width: HIT,
          height: HIT,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && !dimmed && { opacity: 0.7 },
      ]}
    >
      {/* Halo layer — static box-shadow on a transparent circle View
          whose OPACITY is animated. Rendered BEHIND the main dot and
          the ripple. Reanimated drives opacity reliably on every
          platform (including web's react-native-web, where box-shadow
          CSS doesn't react to animated shadowOpacity unless the layer
          is re-composited elsewhere). */}
      {(isNext || done || playable) ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: D,
              height: D,
              borderRadius: radius,
              shadowColor: accent,
              shadowRadius: isNext ? 22 : done ? 10 : 18,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1, // static; haloStyle.opacity drives visibility
              elevation: isNext ? 14 : 6,
            },
            haloStyle,
          ]}
        />
      ) : null}
      {/* Ripple ring — every tappable+unlistened node emits one.
          Sits BEHIND the main dot, expanding outward each cycle so
          each available dot looks like it's emitting energy rings.
          Border-only, no fill, so the connector path passing
          through the centre stays visible. */}
      {wantsRipple ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: D,
              height: D,
              borderRadius: radius,
              // Thicker outline (3 vs 2.5) so the ring stays crisp
              // as it expands past the halo's soft bloom.
              borderWidth: 3,
              borderColor: accent,
            },
            rippleStyle,
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          {
            width: D,
            height: D,
            borderRadius: radius,
            borderWidth: 2.5,
            // Border keeps its rainbow hue even when locked/soon, just
            // with the whole node faded so the journey's progressive
            // colour spectrum stays visible from red at the bottom to
            // violet at the top.
            borderColor: accent,
            // Fully opaque fill — hides the connector path passing
            // behind so the "tree behind the dot" never shows through.
            backgroundColor: dimmed
              ? colors.bgTab
              : done
                ? accent
                : colors.bgTab,
            opacity: dimmed ? 0.45 : 1,
            alignItems: 'center',
            justifyContent: 'center',
            // Halo / glow handled by a separate Animated.View
            // rendered behind this dot (see haloStyle above) — the
            // main dot itself stays unshadowed so the layer doesn't
            // need to re-composite for shadow updates.
          },
          animStyle,
        ]}
      >
        {done ? (
          <Text style={{ color: '#fff', fontSize: radius * 0.85, fontWeight: '700' }}>✓</Text>
        ) : playable ? (
          // CSS-triangle pure geometry — the Text-based ▶ glyph
          // carried an inherent baseline / leading offset that left
          // the triangle visually low in the dot. Borders give us
          // exact dimensions and a perfect optical centre.
          // Width = radius * 0.5 for the play arrow's horizontal
          // reach, height = radius * 0.7 (top+bottom borders).
          // marginLeft shifts the triangle right by 1/6 of its width
          // so its centroid (1/3 from the left edge of a triangle)
          // lands on the dot's centre.
          <View
            style={{
              width: 0,
              height: 0,
              borderTopWidth: radius * 0.35,
              borderTopColor: 'transparent',
              borderBottomWidth: radius * 0.35,
              borderBottomColor: 'transparent',
              borderLeftWidth: radius * 0.55,
              borderLeftColor: accent,
              marginLeft: radius * 0.18,
            }}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

function Label({
  text,
  duration,
  state,
  align,
  onPress,
  cy,
  left,
  width,
}: {
  text: string;
  duration?: string;
  state: NodeState;
  /** Text alignment within the label box. SM rows use 'left' (label
   *  to the right of the dot, reading rightward); QM rows use
   *  'right' (label to the left of the dot, reading toward the
   *  dot). Picks whichever side has more horizontal room. */
  align: 'left' | 'right';
  /** Tap handler — opens the bottom sheet for this track. */
  onPress: () => void;
  cy: number;
  left: number;
  width: number;
}) {
  const locked = state === 'locked';
  const soon = state === 'soon';
  const dimmed = locked || soon;
  // Worst-case label height: title fontSize 16 × lineHeight 20 × 3
  // lines = 60 + 2 marginTop + duration ~17 + small slack ≈ 85.
  // overflow:'visible' as well, because react-native-web sets
  // overflow:'hidden' on View by default, which was clipping the
  // duration line on long-titled QM tracks (= the "temps coupé" the
  // user reported).
  const ESTIMATED_H = 90;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          position: 'absolute',
          left,
          top: cy - ESTIMATED_H / 2,
          width,
          height: ESTIMATED_H,
          justifyContent: 'center',
          overflow: 'visible',
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        numberOfLines={3}
        style={{
          ...typo.h3,
          fontSize: 16,
          lineHeight: 20,
          color: dimmed ? colors.textDim : colors.text,
          textAlign: align,
        }}
      >
        {text}
      </Text>
      {duration ? (
        <Text
          numberOfLines={1}
          style={{
            ...typo.caption,
            fontSize: 13,
            color: dimmed ? colors.textDim : colors.textMuted,
            fontVariant: ['tabular-nums'],
            marginTop: 2,
            textAlign: align,
          }}
        >
          {duration}
        </Text>
      ) : null}
      {soon || locked ? (
        <Text
          numberOfLines={1}
          style={{
            ...typo.caption,
            fontSize: 10,
            color: colors.textDim,
            marginTop: 4,
            textAlign: align,
          }}
        >
          {soon ? 'SOON' : 'LOCKED'}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

// Single tree edge — when "traversed" (= the lower endpoint has been
// listened) we render TWO stacked paths: a wide pale-blue glow
// underneath + a white core on top. Both pulse with a sin² wave whose
// phase is offset by the segment's Y position, so a bright peak
// travels UP the trunk on a 4 s loop. The eye reads "energy ascending
// along the white axis".
//
// ---------------------------------------------------------------------------

// A single dot drifting UPWARD along the trunk, from Welcome (the
// bottommost track) to the top of the tree, looping forever. Several
// stacked instances with staggered delays give the trunk a continuous
// "ascending current". Two visual states:
//   • inactive (no track listened anywhere) — small, dim — a subtle
//     hint that the journey moves upward
//   • active (≥ 1 track listened) — bigger, brighter — the tree reads
//     as live / energized
function TrunkParticle({
  cx,
  yTop,
  yBottom,
  clock,
  phase,
  speedMul,
  color,
  opacityScale,
  /** General size multiplier (~0.7..1.0). Applied to both axes —
   *  introduces gentle uniform variation. */
  sizeScale,
  /** Vertical-only stretch (~0.5..1.8). Independent from sizeScale
   *  so the field has mixed long/short streaks instead of every
   *  particle reading at the same aspect ratio. */
  lengthScale,
}: {
  cx: number;
  yTop: number;
  yBottom: number;
  /** Shared 0..1 clock driving every trunk particle. Each particle
   *  reads `(clock * speedMul + phase) % 1` so individual particles
   *  travel at slightly different rates — without this, the field
   *  looks like a single train of evenly-spaced dots. */
  clock: SharedValue<number>;
  phase: number;
  /** Per-particle speed multiplier (~0.55..1.45). Caller seeds it
   *  deterministically so the variation is stable across re-renders. */
  speedMul: number;
  color: string;
  opacityScale: number;
  sizeScale: number;
  lengthScale: number;
}) {
  // Single ambient sizing for every state — the user prefers the
  // small "tree empty" look kept everywhere, instead of bumping size
  // / brightness once the user starts listening. Subtle, always.
  const baseR = 2.4;
  // Animated props for the two stacked ellipses. The halo ellipse
  // reads the same cy + alpha curve as the core, so they move
  // together; only the rx/ry and an opacity multiplier differ. Using
  // two ellipses to fake a Gaussian blur — react-native-svg's filter
  // primitives are inconsistent across platforms, and stacking is
  // cheap.
  const animatedCoreProps = useAnimatedProps(() => {
    const t = (clock.value * speedMul + phase) % 1;
    const cy = yBottom - (yBottom - yTop) * t;
    let alpha = 1;
    if (t < 0.18) alpha = t / 0.18;
    else if (t > 0.82) alpha = (1 - t) / 0.18;
    // Constant low opacity — no "ramp up when listening starts"
    // behaviour. The field reads as ambient, not as a progress
    // indicator.
    const baseOpacity = 0.22;
    return { cy, opacity: baseOpacity * alpha * opacityScale };
  });
  const animatedHaloProps = useAnimatedProps(() => {
    const t = (clock.value * speedMul + phase) % 1;
    const cy = yBottom - (yBottom - yTop) * t;
    let alpha = 1;
    if (t < 0.18) alpha = t / 0.18;
    else if (t > 0.82) alpha = (1 - t) / 0.18;
    // Halo is dimmer + much wider → soft cloud surrounding the core.
    const baseOpacity = 0.10;
    return { cy, opacity: baseOpacity * alpha * opacityScale };
  });
  // Thinner streaks (0.6 → 0.32 rx multiplier) so particles read as
  // strands of mist rather than pellets. Vertical size driven by an
  // independent lengthScale → some are short, some are elongated.
  const coreRx = baseR * sizeScale * 0.32;
  const coreRy = baseR * sizeScale * lengthScale * 1.4;
  const haloRx = coreRx * 3.2;   // wider halo for a softer cloud
  const haloRy = coreRy * 1.7;
  return (
    <>
      <AnimatedEllipse
        cx={cx}
        rx={haloRx}
        ry={haloRy}
        fill={color}
        animatedProps={animatedHaloProps}
      />
      <AnimatedEllipse
        cx={cx}
        rx={coreRx}
        ry={coreRy}
        fill={color}
        animatedProps={animatedCoreProps}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

// A particle that traces a QM branch path — from the paired SM dot's
// right edge → horizontal along smY → quarter-arc corner → vertical
// up to the QM dot's bottom edge. Same path geometry as the segment
// drawn in buildPathSegments. Renders only for unlocked QM branches
// so we don't animate flow into locked sections.
function BranchParticle({
  trunkX,
  cornerX,
  smY,
  qmY,
  nodeR,
  clock,
  phase,
  speedMul,
  color,
  opacityScale,
  sizeScale,
  lengthScale,
}: {
  trunkX: number;
  cornerX: number;
  smY: number;
  qmY: number;
  nodeR: number;
  clock: SharedValue<number>;
  phase: number;
  speedMul: number;
  color: string;
  opacityScale: number;
  sizeScale: number;
  lengthScale: number;
}) {
  const x1 = trunkX + nodeR;
  const x2 = cornerX - BRANCH_CORNER_R;
  const yArcEnd = smY - BRANCH_CORNER_R;
  const yEnd = qmY + nodeR;
  const hLen = Math.max(0, x2 - x1);
  const cLen = (Math.PI * BRANCH_CORNER_R) / 2;
  const vLen = Math.max(0, yArcEnd - yEnd);
  const total = Math.max(1, hLen + cLen + vLen);

  // Animate cx / cy directly (number props) instead of a transform
  // string. The previous transform="translate(x,y) rotate(angle)"
  // route via useAnimatedProps was NOT reliably wiring through
  // react-native-svg — the trunk particles, which animate cy as a
  // plain number prop, render fine; the branch particles using a
  // string transform stayed invisible. Drop the rotation (was
  // aligning the ellipse with motion direction along the path) and
  // use slightly rounder ellipses so orientation doesn't matter
  // visually — the particles read as soft dots flowing along the
  // branch.
  const animatedCoreProps = useAnimatedProps(() => {
    const t = (clock.value * speedMul + phase) % 1;
    const dist = t * total;
    let cx: number, cy: number;
    if (dist <= hLen) {
      cx = x1 + dist;
      cy = smY;
    } else if (dist <= hLen + cLen) {
      const arcProgress = (dist - hLen) / cLen;
      const a = arcProgress * (Math.PI / 2);
      cx = x2 + BRANCH_CORNER_R * Math.sin(a);
      cy = smY - BRANCH_CORNER_R * (1 - Math.cos(a));
    } else {
      cx = cornerX;
      cy = yArcEnd - (dist - hLen - cLen);
    }
    let alpha = 1;
    if (t < 0.18) alpha = t / 0.18;
    else if (t > 0.82) alpha = (1 - t) / 0.18;
    // Constant ambient opacity — matches the trunk's idle level so
    // the field reads as one continuous mist field across trunk and
    // branches.
    const baseOpacity = 0.22;
    return { cx, cy, opacity: baseOpacity * alpha * opacityScale };
  });
  const animatedHaloProps = useAnimatedProps(() => {
    const t = (clock.value * speedMul + phase) % 1;
    const dist = t * total;
    let cx: number, cy: number;
    if (dist <= hLen) {
      cx = x1 + dist;
      cy = smY;
    } else if (dist <= hLen + cLen) {
      const arcProgress = (dist - hLen) / cLen;
      const a = arcProgress * (Math.PI / 2);
      cx = x2 + BRANCH_CORNER_R * Math.sin(a);
      cy = smY - BRANCH_CORNER_R * (1 - Math.cos(a));
    } else {
      cx = cornerX;
      cy = yArcEnd - (dist - hLen - cLen);
    }
    let alpha = 1;
    if (t < 0.18) alpha = t / 0.18;
    else if (t > 0.82) alpha = (1 - t) / 0.18;
    const baseOpacity = 0.10;
    return { cx, cy, opacity: baseOpacity * alpha * opacityScale };
  });
  // Single ambient sizing for every state — the user prefers the
  // small "tree empty" look kept everywhere, instead of bumping size
  // / brightness once the user starts listening. Subtle, always.
  const baseR = 2.4;
  // Rounder geometry than the trunk streaks — without the rotation
  // alignment, vertical streaks would read "sideways" on the
  // horizontal leg of the branch. Keep rx and ry close so the
  // particle looks the same regardless of direction.
  const coreRx = baseR * sizeScale * 0.75;
  const coreRy = baseR * sizeScale * lengthScale * 0.95;
  const haloRx = coreRx * 2.6;
  const haloRy = coreRy * 2.6;
  return (
    <>
      <AnimatedEllipse
        rx={haloRx}
        ry={haloRy}
        fill={color}
        animatedProps={animatedHaloProps}
      />
      <AnimatedEllipse
        rx={coreRx}
        ry={coreRy}
        fill={color}
        animatedProps={animatedCoreProps}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

// Untraversed edges render as a flat dim Path — we don't pay the
// double-AnimatedPath cost on connectors that aren't lit yet.
function EnergyPath({
  d,
  stroke,
  strokeWidth,
  traversed,
  accent,
  yPhase,
  flowTime,
}: {
  d: string;
  stroke: string;
  strokeWidth: number;
  traversed: boolean;
  /** Part-tinted glow colour — applied to the wide outer stroke that
   *  sits behind the white core. Each part carries its own hue
   *  through this halo. */
  accent: string;
  /** 0..1 — segment's centre Y normalised to total tree height. Higher
   *  segments have larger yPhase, which offsets the wave so peaks pass
   *  through them later than peaks at the base. */
  yPhase: number;
  flowTime: SharedValue<number>;
}) {
  // A SINGLE bright peak is visible at a time (cycles = 1.0): one wave
  // crest travels up, fades off the top, restarts at the bottom. With
  // more cycles the effect read as a uniform shimmer rather than an
  // ascending current.
  const CYCLES = 1.0;
  // Core (white) — opacity 0.35 baseline so the path stays visible
  // between peaks; lifts to 1.0 at the wave crest.
  const coreProps = useAnimatedProps(() => {
    const phase = (flowTime.value + yPhase * CYCLES + 1) % 1;
    const wave = Math.sin(phase * Math.PI);
    const sq = wave * wave; // sharper falloff than sin alone
    return { strokeOpacity: 0.35 + 0.65 * sq };
  });
  // Glow (pale blue, wider stroke) — kept VISIBLE at the trough
  // (~0.30) so the eye reads "the trunk is glowing" continuously,
  // with the wave crest punching it brighter (~0.80). Going to 0
  // between peaks made the glow look like it disappeared entirely.
  const glowProps = useAnimatedProps(() => {
    const phase = (flowTime.value + yPhase * CYCLES + 1) % 1;
    const wave = Math.sin(phase * Math.PI);
    const sq = wave * wave;
    return { strokeOpacity: 0.30 + 0.50 * sq };
  });
  if (!traversed) {
    return (
      <Path
        d={d}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={0.6}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return (
    <>
      <AnimatedPath
        d={d}
        stroke={accent}
        strokeWidth={strokeWidth + 5}
        strokeLinecap="round"
        fill="none"
        animatedProps={glowProps}
      />
      <AnimatedPath
        d={d}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        animatedProps={coreProps}
      />
    </>
  );
}

function buildPathSegments(
  layers: Layer[],
  rowYs: number[],
  _SM_X: number,
  QM_X: number,
  CENTER_X: number,
  nodeR: number,
  listened: Record<string, true>,
  flowTime: SharedValue<number>,
  totalH: number,
  partColor: (p: StageId) => string,
  /** Y of the deepest-in-journey listened track. Segments whose
   *  UPPER endpoint Y >= this value are "below the last listened"
   *  and read as the completed journey portion (= lit). null when
   *  nothing's listened yet. */
  lastListenedY: number | null,
  pageOrder: StageId[],
  pageH: number,
) {
  const elements: React.ReactNode[] = [];
  const dimStroke = 'rgba(255,255,255,0.18)';
  const litStroke = 'rgba(255,255,255,0.95)';

  // ---- Trunk: connect consecutive SM rows directly through CENTER_X.
  // We skip QM-branch and divider layers so the trunk stays as one
  // continuous vertical axis (no splitting).
  const smIndices = layers
    .map((l, i) => (l.kind === 'sm-row' ? i : -1))
    .filter(i => i >= 0);
  for (let k = 1; k < smIndices.length; k++) {
    const upperIdx = smIndices[k - 1]; // higher in display = later in journey
    const lowerIdx = smIndices[k];     // lower in display = earlier in journey
    const upperLayer = layers[upperIdx];
    const lowerLayer = layers[lowerIdx];
    if (lowerLayer.kind !== 'sm-row') continue;
    if (upperLayer.kind !== 'sm-row') continue;
    const yUpper = rowYs[upperIdx];
    const yLower = rowYs[lowerIdx];
    const traversed = lastListenedY !== null && yUpper >= lastListenedY;
    const stroke = traversed ? litStroke : dimStroke;
    const strokeWidth = traversed ? 2.5 : 2;
    const ty1 = yUpper + nodeR;
    const ty2 = yLower - nodeR;
    // Cross-part trunk segments are SPLIT at the PAGE BOUNDARY
    // between the two parts (= the snap line between two pages),
    // not at the dashed divider — the divider sits a few px above
    // the page bottom but the user-visible "screen change" line is
    // the page boundary itself. Lower half keeps the lower part's
    // colour, upper half takes the upper part's colour.
    const crossesParts = upperLayer.partId !== lowerLayer.partId;
    let splitY: number | null = null;
    if (crossesParts) {
      // The lower part's page top = upper part's page bottom = the
      // snap line. pageOrder is display top-down, so the page top
      // of the lower part is at idx*pageH.
      const lowerIdx2 = pageOrder.indexOf(lowerLayer.partId);
      if (lowerIdx2 >= 0) splitY = lowerIdx2 * pageH;
    }
    if (crossesParts && splitY !== null && splitY > ty1 && splitY < ty2) {
      // Two paths: ty1 → splitY (upper part colour), splitY → ty2
      // (lower part colour).
      const segs: { dStr: string; accent: string; tag: string }[] = [
        { dStr: `M ${CENTER_X} ${ty1} L ${CENTER_X} ${splitY}`, accent: partColor(upperLayer.partId), tag: 'top' },
        { dStr: `M ${CENTER_X} ${splitY} L ${CENTER_X} ${ty2}`, accent: partColor(lowerLayer.partId), tag: 'bot' },
      ];
      for (const s of segs) {
        const dStart = s.tag === 'top' ? ty1 : splitY;
        const dEnd = s.tag === 'top' ? splitY : ty2;
        const yMidSeg = (dStart + dEnd) / 2;
        const yPhaseSeg = totalH > 0 ? 1 - yMidSeg / totalH : 0;
        elements.push(
          <EnergyPath
            key={`trunk-${upperIdx}-${lowerIdx}-${s.tag}`}
            d={s.dStr}
            stroke={stroke}
            strokeWidth={strokeWidth}
            traversed={traversed}
            accent={s.accent}
            yPhase={yPhaseSeg}
            flowTime={flowTime}
          />,
        );
      }
    } else {
      const accent = partColor(lowerLayer.partId);
      const d = `M ${CENTER_X} ${ty1} L ${CENTER_X} ${ty2}`;
      const yMid = (ty1 + ty2) / 2;
      const yPhase = totalH > 0 ? 1 - yMid / totalH : 0;
      elements.push(
        <EnergyPath
          key={`trunk-${upperIdx}-${lowerIdx}`}
          d={d}
          stroke={stroke}
          strokeWidth={strokeWidth}
          traversed={traversed}
          accent={accent}
          yPhase={yPhase}
          flowTime={flowTime}
        />,
      );
    }
  }

  // ---- QM side branches: emerge from the PAIRED SM dot on the trunk
  // (right edge of the dot at smY), curve out to the right, and rise
  // to the QM dot's Y. Two-segment path:
  //   1. Horizontal: from the SM dot's right edge to (QM_X, smY)
  //   2. Vertical:   from (QM_X, smY) up to the QM dot's bottom edge
  // The corner is rounded with a quadratic Bezier so the bend reads
  // as a graceful turn, not a hard L. Visually the branch clearly
  // ORIGINATES at the SM stage rather than bifurcating mid-trunk —
  // signalling "this QM is the deeper variant of THIS specific SM".
  const smYByTrackId = new Map<string, number>();
  layers.forEach((l, i) => {
    if (l.kind === 'sm-row') smYByTrackId.set(l.track.id, rowYs[i]);
  });
  layers.forEach((layer, i) => {
    if (layer.kind !== 'qm-branch') return;
    const qmY = rowYs[i];
    const smY = smYByTrackId.get(layer.pairedSmId);
    if (smY === undefined) return; // paired SM not in tree (shouldn't happen)
    // QM branch is lit only once the QM TRACK ITSELF has been
    // listened — having the paired SM listened (which unlocks the
    // branch) is not enough. Without this rule the trunk would read
    // as "extending into" an unfinished QM the moment you completed
    // its SM anchor, which is misleading: from the user's POV the
    // QM is "ticked" (done) only when its own dot is filled.
    const traversed = !!listened[layer.track.id];
    const stroke = traversed ? litStroke : dimStroke;
    const strokeWidth = traversed ? 2.5 : 2;
    const accent = partColor(layer.partId);
    // Start: just outside the SM dot's right edge, at the SM's Y.
    const x1 = CENTER_X + nodeR;
    // End: just below the QM dot, at its centre X.
    const yQmEdge = qmY + nodeR; // bottom of QM dot — branch enters from below
    // Corner point: (QM_X, smY) — go horizontally to QM_X first, then
    // turn upward. Quadratic Bezier with control at the corner gives
    // a soft fillet instead of a sharp 90°.
    const cornerX = QM_X;
    const cornerY = smY;
    // M start → L (cornerX - cornerR, smY) → Q cornerX smY, cornerX (smY - cornerR) → L (cornerX, yQmEdge)
    const cornerR = BRANCH_CORNER_R; // shared with BranchParticle
    // Going UP if qmY < smY (typical, since QM sits ABOVE its paired SM
    // in display because we placed QM right after SM in journey order;
    // display is reversed → QM is above-in-display = smaller Y).
    const goingUp = qmY < smY;
    const verticalEnd = goingUp ? yQmEdge : qmY - nodeR;
    const cornerYStart = goingUp ? cornerY - cornerR : cornerY + cornerR;
    const d = `M ${x1} ${smY} L ${cornerX - cornerR} ${smY} Q ${cornerX} ${smY}, ${cornerX} ${cornerYStart} L ${cornerX} ${verticalEnd}`;
    const yMid = (smY + qmY) / 2;
    const yPhase = totalH > 0 ? 1 - yMid / totalH : 0;
    elements.push(
      <EnergyPath
        key={`qm-branch-${i}`}
        d={d}
        stroke={stroke}
        strokeWidth={strokeWidth}
        traversed={traversed}
        accent={accent}
        yPhase={yPhase}
        flowTime={flowTime}
      />,
    );
  });

  return elements;
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typo.display,
    color: colors.text,
    fontSize: 20,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  tree: {
    alignSelf: 'center',
    position: 'relative',
  },
  divider: {
    position: 'absolute',
    height: 0,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.32)',
    borderStyle: 'dashed',
  },
  startCaption: {
    ...typo.overline,
    color: colors.textDim,
    fontSize: 9,
    letterSpacing: 1.6,
    marginTop: spacing.lg,
  },
  // Section footer label — bumped up so the part the user is currently
  // looking at reads at a glance. The crossfade between part names
  // (FooterPartLabel) is preserved; only the per-letter weight grew.
  partName: {
    ...typo.overline,
    color: colors.text,
    fontSize: 14,
    letterSpacing: 2.4,
    textAlign: 'center',
  },
  // The "The Earth" / "The Sky" / "The Space" tagline sits on its own
  // line below the part's official name (Mind-Body, etc.). Italic +
  // mixed case (catalog-defined) makes it read as poetic complement
  // rather than another section title.
  partTagline: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1.2,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
  },
  // Short blurb from the catalog (volet.description) shown under the
  // part name so the user gets the part's intent at a glance without
  // having to open a track. Sentence-case to contrast with the all-
  // caps title above it.
  partDescription: {
    ...typo.caption,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: spacing.sm,
  },
  // Full-width banner. Dark overlay bumped to rgba(0,0,0,0.65) so
  // the lit trunk + particles don't show through behind the part
  // name. expo-blur would be cleaner (real backdrop blur) but isn't
  // installed; a dense semi-opaque fill achieves the same "isolated
  // info strip" feel.
  partTag: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  fixedFooterDashedLine: {
    height: 0,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.32)',
    borderStyle: 'dashed',
  },
  fixedFooterLabelArea: {
    width: '100%',
    // Holds title (≈17 px line) + italic tagline (≈16 px line) +
    // description block (3 lines × 16 lineHeight + 6 marginTop ≈ 54 px)
    // + paddingVertical inside `.partTag` (10 × 2). Half-overlap onto
    // the dashed line so the tag's background cuts it cleanly.
    height: 128,
    marginTop: -19,
    justifyContent: 'flex-start',
  },
  footerLabelLayer: {
    // Full-width so the inner partTag banner stretches edge-to-edge
    // (each crossfading part name is its own absolutely-positioned
    // layer occupying the same horizontal band).
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  // Top-of-screen tagline header. Mirrors `fixedFooter` (absolute,
  // full-width, pointer-events:none) but anchored to the top edge.
  // Each HeaderPartLabel inside is an absolutely-positioned layer
  // crossfading with its siblings on scroll.
  fixedHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
  },
  headerLabelLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Top-screen tagline — promoted to a hero-sized italic so it reads
  // as the section's poetic name on first glance. Lighter colour than
  // colors.text so it still sits "above" the tree without competing
  // with the labels.
  headerTagline: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 1.6,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.85,
  },
  // Scroll-hint chevrons — small text glyphs centred horizontally,
  // wrapped in an absolutely-positioned band so they don't catch
  // taps and don't reflow the layout when they appear / disappear.
  scrollHintTopWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollHintBottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Edge fades — absolutely positioned bands at the top and bottom
  // of the screen, hosting a LinearGradient that obscures the tree's
  // top / bottom rows so they don't collide with the part tagline
  // (top) or the part-name banner (bottom).
  treeEdgeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  treeEdgeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  scrollHintUp: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollHintDown: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollHintGlyph: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    fontWeight: '600',
  },
  // Static 180° rotation for the down chevron — applied on a plain
  // View wrapper so it doesn't conflict with the inner Animated.View's
  // translateY bob.
  scrollHintRotate: {
    transform: [{ rotate: '180deg' }],
  },
});
