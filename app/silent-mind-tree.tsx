import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

// Animated wrapper around react-native-svg's <Path> so we can drive
// stroke opacity / width from a Reanimated shared value (the tree's
// energy pulse — see SilentMindTreeScreen).
const AnimatedPath = Animated.createAnimatedComponent(Path);

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
  switch (partId) {
    case 'intro': return 'Introduction';
    case 'part1': return 'The Earth';
    case 'part2': return 'The Sky';
    case 'part3': return 'The Space';
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
  const scrollRef = useRef<ScrollView>(null);

  const layers = useMemo(() => buildLayers(), []);

  // Tree-wide energy pulse — a slow sin breath that drives the soft
  // glow on completed nodes. ~5 s cycle is slower than the next-up
  // node's pulse (2.0 s) so the two layers don't compete for the eye.
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
    flowTime.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [flowTime]);

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
  const TOP_PAD = Math.max(60, insets.top + 28);
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

  // Per-part accent colours — replaces the previous "single pale-blue
  // for everything" scheme (too cold) and the rainbow gradient before
  // that. Each part now has its own warm-balanced hue that carries
  // through the dot border, the play triangle, the done-fill, and the
  // glow halo on the trunk segments belonging to that part.
  const partColor = (partId: StageId): string => {
    switch (partId) {
      case 'intro': return '#C9A66B'; // warm dawn gold — first connection
      case 'part1': return '#2E6B47'; // deeper green — Earth
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

  // Initial page = whichever part contains the user's next-up track,
  // falling back to the bottommost page (intro). Computed ONCE at
  // mount via useState lazy init — the value seeds the scrollY shared
  // value and the ScrollView's contentOffset, so the very first frame
  // already shows the correct atmosphere (no "ghost frame" of the
  // top-of-content shader before the post-mount scrollTo lands).
  const initialNextId = useRef(nextId).current;
  const [initialPageIdx] = useState<number>(() => {
    if (initialNextId) {
      const layer = layers.find(
        l =>
          (l.kind === 'sm-row' || l.kind === 'qm-branch') &&
          l.track.id === initialNextId,
      );
      if (layer && (layer.kind === 'sm-row' || layer.kind === 'qm-branch')) {
        const idx = pageOrder.indexOf(layer.partId);
        if (idx >= 0) return idx;
      }
    }
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
  const setScrollLocked = (locked: boolean) => {
    try {
      // setNativeProps is the cheapest way to toggle scrollEnabled on
      // a live ScrollView ref without re-rendering the whole subtree.
      (scrollRef.current as any)?.setNativeProps?.({ scrollEnabled: !locked });
    } catch {
      /* native may not expose the prop — animation still runs */
    }
  };
  const onScrollNative = (e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    scrollY.value = y;
    if (isSnapping.current) return;
    const settledY = settledPage.current * pageH;
    const delta = y - settledY;
    if (Math.abs(delta) <= 6) return; // ignore micro-jitter
    const direction = Math.sign(delta);
    const targetPage = Math.max(
      0,
      Math.min(pageOrder.length - 1, settledPage.current + direction),
    );
    isSnapping.current = true;
    settledPage.current = targetPage;
    setCurrentPageIdx(targetPage);
    setScrollLocked(true);
    const targetY = targetPage * pageH;
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
    setTimeout(() => {
      // Hard-clamp to the target page on lock release. Some scroll
      // sources on web (mouse wheel, trackpad) keep firing events
      // even with scrollEnabled=false — without this, a second wheel
      // tick during the animation would land us mid-way to the
      // PAGE-AFTER-TARGET, and the next onScroll tick would advance
      // again ("two pages at once"). Forcing the position back here
      // means one gesture = one page, full stop.
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
      isSnapping.current = false;
      setScrollLocked(false);
    }, 480);
  };

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
      settledPage.current = targetPage;
      setCurrentPageIdx(targetPage);
      scrollRef.current?.scrollTo({ y: targetPage * pageH, animated: true });
      setTimeout(() => { isSnapping.current = false; }, 700);
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
        onScroll={onScrollNative}
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
            {buildPathSegments(layers, rowYs, SM_X, QM_X, CENTER_X, NODE_R, listened, flowTime, totalH, partColor)}
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
  return (
    <Animated.View style={[styles.footerLabelLayer, animStyle]}>
      <View style={styles.partTag}>
        <Text style={styles.partName} numberOfLines={1}>
          {partLabel(partId)}
        </Text>
        {description ? (
          <Text style={styles.partDescription} numberOfLines={3}>
            {noOrphan(description)}
          </Text>
        ) : null}
      </View>
    </Animated.View>
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
  const breath = useSharedValue(0); // 0..1 sin, 2.0 s — scale
  const sway   = useSharedValue(0); // -1..+1 sin, 7 s — slow Y drift
  const ripple = useSharedValue(0); // 0..1 ramp,  1.6 s — expanding ring
  useEffect(() => {
    if (isNext) {
      breath.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
      // Sway starts at -1 so the bounce stays symmetric (otherwise the
      // first cycle's range was 0 → +1 → -1 → +1 — visibly faster than
      // later cycles). Same fix as CircleButton.tsx.
      sway.value = -1;
      sway.value = withRepeat(
        withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
      // Ripple is a one-way 0→1 ramp on each cycle — the outer ring
      // expands and fades, then snaps back to 0 to start over.
      ripple.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        -1, false,
      );
    } else {
      breath.value = withTiming(0, { duration: 240 });
      sway.value = withTiming(0, { duration: 240 });
      ripple.value = withTiming(0, { duration: 240 });
    }
  }, [isNext]);
  // Composite animation:
  //   • Up-next node: scale breath + slow Y sway + ripple ring +
  //     halo opacity that follows the tree-wide `energyPulse` (so the
  //     up-next glow pulses IN PHASE with every done node).
  //   • Done node: subtle scale (1 → 1.03) + halo opacity, both keyed
  //     off the same `energyPulse` — every lit dot breathes together.
  //   • Other states: static, no glow.
  const animStyle = useAnimatedStyle(() => {
    if (isNext) {
      return {
        transform: [
          { translateY: sway.value * 1.5 },
          // Boosted from 1.06 → 1.10 so the up-next dot visibly
          // breathes — the previous range was easy to miss against
          // the surrounding still dots.
          { scale: 1 + 0.10 * breath.value },
        ],
        // Halo on up-next is wider (shadowRadius 22 in the View
        // style) AND brighter (0.55..1.0 vs 0.25..0.80 on done) so
        // the active CTA still stands out from the ambient glow.
        shadowOpacity: 0.55 + 0.45 * energyPulse.value,
      };
    }
    if (done) {
      return {
        transform: [
          { translateY: 0 },
          { scale: 1 + 0.03 * energyPulse.value },
        ],
        shadowOpacity: 0.25 + 0.55 * energyPulse.value,
      };
    }
    return { transform: [{ translateY: 0 }, { scale: 1 }], shadowOpacity: 0 };
  });
  // Outer ripple ring — bigger (scale 1 → 2.0) and brighter (0.75 →
  // 0) than the previous version so the up-next dot reads as actively
  // emitting energy. Only renders while isNext (gated below).
  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 1.0 * ripple.value }],
    opacity: isNext ? Math.max(0, 0.75 * (1 - ripple.value)) : 0,
  }));

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
      {/* Ripple ring — only really visible on the up-next node (the
          rippleStyle pins opacity to 0 elsewhere). Sits BEHIND the
          main dot, expanding outward each cycle so the dot looks like
          it's emitting energy rings. Border-only, no fill, so the
          connector path passing through the centre stays visible. */}
      {isNext ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: D,
              height: D,
              borderRadius: radius,
              borderWidth: 2.5,
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
            // Soft accent halo on lit nodes (up-next + already-done).
            // Its opacity is animated by `animStyle` above; this just
            // declares the shadow colour / radius. Untraversed (locked
            // / soon / available-but-not-next) nodes keep
            // shadowOpacity 0 so the rest of the chain stays clean.
            ...(isNext || done
              ? {
                  shadowColor: accent,
                  // Up-next halo is much wider (22 vs 10) so the
                  // active CTA reads above the ambient done-node
                  // glow — both pulse IN PHASE via energyPulse, but
                  // amplitude is what separates "next" from
                  // "already-walked".
                  shadowRadius: isNext ? 22 : 10,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: isNext ? 14 : 6,
                }
              : null),
          },
          animStyle,
        ]}
      >
        {done ? (
          <Text style={{ color: '#fff', fontSize: radius * 0.85, fontWeight: '700' }}>✓</Text>
        ) : playable ? (
          // Play triangle for tappable tracks — slight right offset so
          // the visual centre of the triangle lands on the dot's centre.
          <Text
            style={{
              color: accent,
              fontSize: radius * 0.95,
              lineHeight: radius * 0.95,
              marginLeft: radius * 0.2,
              fontWeight: '700',
            }}
          >
            ▶
          </Text>
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
    const lowerLayer = layers[lowerIdx];
    if (lowerLayer.kind !== 'sm-row') continue;
    const yUpper = rowYs[upperIdx];
    const yLower = rowYs[lowerIdx];
    // Segment lights up as soon as the LOWER endpoint (= the SM you
    // just finished going up) is listened.
    const traversed = !!listened[lowerLayer.track.id];
    const stroke = traversed ? litStroke : dimStroke;
    const strokeWidth = traversed ? 2.5 : 2;
    const accent = partColor(lowerLayer.partId);
    const ty1 = yUpper + nodeR;
    const ty2 = yLower - nodeR;
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
    const cornerR = 22; // radius of the rounded turn — bigger = softer bend
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
    letterSpacing: 2.8,
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
  // Full-width banner running edge-to-edge across the screen. We
  // dropped the solid bgTab fill so the per-part background (esp.
  // the Earth video) can reach all the way to the bottom of the
  // viewport without an opaque strip covering the last 40 px. A
  // very-soft dark overlay (rgba 0,0,0,0.30) keeps the part name
  // readable against bright frames of the video. The textShadow on
  // typo.overline does the rest of the lifting.
  partTag: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.30)',
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
    // Full-width so the absolutely-positioned crossfade layers inside
    // (left:0 / right:0) actually have a non-zero width to stretch
    // into.
    width: '100%',
    // Bumped to hold the title (37 px) + the description block
    // (up to 3 lines × 16 lineHeight + 6 marginTop ≈ 54 px) + a
    // bit of vertical padding. Half-overlap onto the dashed line
    // so the tag's background cuts it cleanly.
    height: 100,
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
});
