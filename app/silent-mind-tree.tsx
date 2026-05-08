import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackButton } from '../src/components/BackButton';
import { AtmosphereBackground } from '../src/components/AtmosphereBackground';
import { silentMindVolets, introAudios, trackDuration, QM_TO_SM_PAIRING, type AudioTrack } from '../src/content/catalog';
import { useProgress, isTrackUnlocked } from '../src/player/progressStore';
import { usePlayerStore } from '../src/player/store';
import { colors, spacing, type as typo } from '../src/theme';

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

type Layer =
  | { kind: 'row'; smTrack: AudioTrack | null; qmTrack: AudioTrack | null; partId: StageId }
  | { kind: 'divider' };

function buildLayers(): Layer[] {
  const layers: Layer[] = [];
  const processPart = (
    partId: StageId,
    sm: AudioTrack[],
    qm: AudioTrack[],
  ) => {
    const used = new Set<string>();
    const rows: { smTrack: AudioTrack | null; qmTrack: AudioTrack | null }[] = [];
    for (const t of sm) {
      const paired = qm.find(q => QM_TO_SM_PAIRING[q.id] === t.id) ?? null;
      if (paired) used.add(paired.id);
      rows.push({ smTrack: t, qmTrack: paired });
    }
    for (const q of qm) {
      if (!used.has(q.id)) rows.push({ smTrack: null, qmTrack: q });
    }
    // Reverse so the entry track ends up at the bottom of this part's
    // section when the tree is rendered top-down.
    rows.reverse().forEach(r =>
      layers.push({ kind: 'row', smTrack: r.smTrack, qmTrack: r.qmTrack, partId }),
    );
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

  // Responsive layout sizing. We clamp the total to the viewport, then
  // scale the tree column down (within bounds) so the labels keep at
  // least some breathing room on narrow phones.
  const totalW = Math.min(MAX_TOTAL_W, Math.max(220, winW - 16));
  const treeW = Math.max(MIN_TREE_W, Math.min(TARGET_TREE_W, totalW * 0.45));
  const sideW = (totalW - treeW) / 2;
  const SM_X = sideW + treeW * 0.3;
  const QM_X = sideW + treeW * 0.7;
  const CENTER_X = sideW + treeW / 2;
  // Node radius — gently scales up on wider viewports so the dots don't
  // read as a faint ring on big phones / desktop preview.
  const NODE_R = Math.min(30, Math.max(BASE_NODE_R, BASE_NODE_R + (winW - 360) * 0.03));

  // Snap-per-part page layout — each part fills exactly one viewport
  // height, the user snaps from one part to the next while scrolling.
  // Padding inside each page leaves room for the safe-area top, the
  // floating BackButton, and the dashed section header at the bottom.
  const pageH = winH;
  const TOP_PAD = Math.max(60, insets.top + 28);
  const BOTTOM_PAD = Math.max(56, insets.bottom + 32);
  const DIVIDER_OFFSET = 28; // distance from page bottom to the dashed line

  // Order in which parts appear top-down in display (one page each).
  const pageOrder = useMemo(() => {
    const seen: StageId[] = [];
    for (const l of layers) {
      if (l.kind === 'row' && !seen.includes(l.partId)) seen.push(l.partId);
    }
    return seen;
  }, [layers]);

  // Per-layer Y positions. Tracks of each part are evenly distributed
  // within that part's page; dividers sit near the bottom of the part
  // they belong to (the part DIRECTLY ABOVE in display order).
  const rowYs = useMemo(() => {
    const ys: number[] = new Array(layers.length).fill(0);
    // Group row layer indices by part, in display order.
    const partRows: Partial<Record<StageId, number[]>> = {};
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (l.kind !== 'row') continue;
      (partRows[l.partId] ??= []).push(i);
    }
    // Place rows page-by-page, evenly spread between top/bottom pad.
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
    // Dividers: position each near the bottom of the page belonging
    // to the part they label (= the part DIRECTLY ABOVE in display).
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].kind !== 'divider') continue;
      let partAbove: StageId | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const r = layers[j];
        if (r.kind === 'row') { partAbove = r.partId; break; }
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
        if (prev.kind === 'row') {
          out.push({ idx: i, partId: prev.partId });
          break;
        }
      }
    }
    return out;
  }, [layers]);

  // The bottommost part (Introduction) has no divider below it, so we
  // render its label as a footer just below the last row, completing
  // the same "label-then-section going up" rhythm.
  const bottomPartId: StageId | null = useMemo(() => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.kind === 'row') return l.partId;
    }
    return null;
  }, [layers]);

  // The "next" track to listen to (drives the pulse animation on its
  // CircleNode). Re-evaluated each render, picking up live state.
  const nextTrackIdFn = useProgress(s => s.nextTrackId);
  const nextId = nextTrackIdFn();

  // Rainbow positions: walking BOTTOM-UP through the layers, the first
  // row encountered is position 0 (red), each subsequent row higher in
  // the journey gets a hue closer to violet. SM and QM tracks on the
  // same row share a position (= same hue), since they're at the same
  // beat in the journey.
  const { trackHues, tracksTotal } = useMemo(() => {
    const hues: Record<string, number> = {};
    let pos = 0;
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.kind !== 'row') continue;
      if (l.smTrack) hues[l.smTrack.id] = pos;
      if (l.qmTrack) hues[l.qmTrack.id] = pos;
      pos++;
    }
    return { trackHues: hues, tracksTotal: pos };
  }, [layers]);

  const trackColor = (id: string): string => {
    const pos = trackHues[id];
    if (pos === undefined) return colors.accent;
    const denom = Math.max(1, tracksTotal - 1);
    const hue = (pos / denom) * 282; // red 0° → violet ~282°
    return `hsl(${hue}, 70%, 62%)`;
  };

  // Scroll-driven background fades. lake (Intro + P1) ↔ sky (P2) ↔
  // space (P3) crossfades happen across the inter-part dividers, with
  // a fade window centred on each boundary's Y in scroll content.
  const scrollY = useSharedValue(0);

  // Hard snap-per-page: as soon as the scroll position drifts more
  // than a few px from the current settled page, we IMMEDIATELY commit
  // to the next page in the drag direction — no debounce, no waiting
  // for the gesture to settle. The scroll is also locked
  // (scrollEnabled=false) for the duration of the smooth scrollTo so
  // continued user input doesn't drag the position past the target.
  // Result: one continuous motion that lands on the next page centre.
  const settledPage = useRef(0);
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
  const { yP2P3, yP1P2 } = useMemo(() => {
    const idxP3 = pageOrder.indexOf('part3');
    const idxP2 = pageOrder.indexOf('part2');
    return {
      yP2P3: idxP3 >= 0 ? (idxP3 + 1) * pageH : 0,
      yP1P2: idxP2 >= 0 ? (idxP2 + 1) * pageH : 0,
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

  // Web only: intercept wheel/trackpad events directly so we can
  // call preventDefault() and stop the browser's native scroll-with-
  // momentum from running multiple pages of distance during one
  // gesture. The earlier onScroll-based lock couldn't keep up with
  // Chrome's scroll inertia (events kept arriving for 400–600 ms after
  // a single trackpad swipe and slipped past our 480 ms lock).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cooldownUntil = 0;
    const handleWheel = (e: WheelEvent) => {
      // The listener is mounted only while this screen is in the tree
      // — useEffect cleanup tears it down on navigation away — so we
      // can react to all wheel events here without filtering targets.
      e.preventDefault();
      const now = Date.now();
      if (now < cooldownUntil) return;
      if (Math.abs(e.deltaY) < 4) return;
      const direction = Math.sign(e.deltaY);
      const targetPage = Math.max(
        0,
        Math.min(pageOrder.length - 1, settledPage.current + direction),
      );
      if (targetPage === settledPage.current) return;
      cooldownUntil = now + 700;
      isSnapping.current = true;
      settledPage.current = targetPage;
      scrollRef.current?.scrollTo({ y: targetPage * pageH, animated: true });
      setTimeout(() => { isSnapping.current = false; }, 700);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [pageH, pageOrder.length]);

  // Land the user on the page that contains the next track they have
  // to listen to — bottom (Welcome's page) for a first connection,
  // P1 once the intro is finished, etc. nextId is read at mount time
  // only so the screen doesn't restlessly scroll on every state change.
  const initialNextId = useRef(nextId).current;
  useEffect(() => {
    const id = setTimeout(() => {
      let pageIdx = pageOrder.length - 1; // default = bottommost page
      if (initialNextId) {
        const layer = layers.find(
          l =>
            l.kind === 'row' &&
            ((l.smTrack && l.smTrack.id === initialNextId) ||
              (l.qmTrack && l.qmTrack.id === initialNextId)),
        );
        if (layer && layer.kind === 'row') {
          const idx = pageOrder.indexOf(layer.partId);
          if (idx >= 0) pageIdx = idx;
        }
      }
      // Brief snapping-flag so the initial scroll doesn't get
      // intercepted by the scroll-driven snap logic.
      isSnapping.current = true;
      settledPage.current = pageIdx;
      scrollRef.current?.scrollTo({ y: pageIdx * pageH, animated: false });
      setTimeout(() => { isSnapping.current = false; }, 200);
    }, 50);
    return () => clearTimeout(id);
  }, [pageH, pageOrder, layers, initialNextId]);

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
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={StyleSheet.absoluteFill}>
          <AtmosphereBackground theme="lake" />
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, skyAnimStyle]}>
          <AtmosphereBackground theme="sky" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, spaceAnimStyle]}>
          <AtmosphereBackground theme="space" />
        </Animated.View>
      </View>

      <BackButton />

      <Animated.ScrollView
        ref={scrollRef as never}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScrollNative}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        <View style={[styles.tree, { width: totalW, height: totalH }]}>
          <Svg
            width={totalW}
            height={totalH}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {buildPathSegments(layers, rowYs, SM_X, QM_X, CENTER_X, NODE_R, listened)}
          </Svg>

          {/* Section headers used to live inside the scroll content;
              they're now rendered as a FIXED footer below (outside
              this scrollable container) so they don't move while the
              user scrolls — instead the part name crossfades from one
              to the next. */}

          {layers.map((l, i) => {
            if (l.kind !== 'row') return null;
            const y = rowYs[i];
            const branched = l.smTrack !== null && l.qmTrack !== null;
            const smCx = branched ? SM_X : CENTER_X;
            const qmCx = branched ? QM_X : CENTER_X; // unused when no QM
            const smState = nodeState(l.smTrack, listened);
            const qmState = nodeState(l.qmTrack, listened);

            // Label x ranges: branched = label sits in the side gutter,
            // single-lane = label sits to the right of the centred node.
            const smLabel = l.smTrack ? (
              branched ? (
                <Label
                  key={`sm-${i}`}
                  text={l.smTrack.title}
                  meta={trackDuration(l.smTrack)}
                  state={smState}
                  accent={trackColor(l.smTrack.id)}
                  align="right"
                  cy={y}
                  left={0}
                  width={smCx - NODE_R - LABEL_PAD}
                />
              ) : (
                <Label
                  key={`sm-${i}`}
                  text={l.smTrack.title}
                  meta={trackDuration(l.smTrack)}
                  state={smState}
                  accent={trackColor(l.smTrack.id)}
                  align="left"
                  cy={y}
                  left={smCx + NODE_R + LABEL_PAD}
                  width={totalW - (smCx + NODE_R + LABEL_PAD) - LABEL_PAD}
                />
              )
            ) : null;

            const qmLabel = l.qmTrack && branched ? (
              <Label
                key={`qm-${i}`}
                text={l.qmTrack.title}
                meta={trackDuration(l.qmTrack)}
                state={qmState}
                accent={trackColor(l.qmTrack.id)}
                align="left"
                cy={y}
                left={qmCx + NODE_R + LABEL_PAD}
                width={totalW - (qmCx + NODE_R + LABEL_PAD) - LABEL_PAD}
              />
            ) : null;

            return (
              <View key={`row-${i}`} pointerEvents="box-none">
                {l.smTrack ? (
                  <CircleNode
                    cx={smCx}
                    cy={y}
                    radius={NODE_R}
                    accent={trackColor(l.smTrack.id)}
                    state={smState}
                    isNext={l.smTrack.id === nextId}
                    onPress={() => playTrack('sm', l.partId, l.smTrack!)}
                  />
                ) : null}
                {l.qmTrack ? (
                  <CircleNode
                    cx={qmCx}
                    cy={y}
                    radius={NODE_R}
                    accent={trackColor(l.qmTrack.id)}
                    state={qmState}
                    isNext={l.qmTrack.id === nextId}
                    onPress={() => playTrack('qm', l.partId, l.qmTrack!)}
                  />
                ) : null}
                {smLabel}
                {qmLabel}
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
  return (
    <Animated.View style={[styles.footerLabelLayer, animStyle]}>
      <View style={styles.partTag}>
        <Text style={styles.partName} numberOfLines={1}>
          {partLabel(partId)}
        </Text>
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
  onPress,
}: {
  cx: number;
  cy: number;
  radius: number;
  accent: string;
  state: NodeState;
  isNext: boolean;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const soon = state === 'soon';
  const done = state === 'done';
  const dimmed = locked || soon;
  const playable = !dimmed && !done;
  const D = radius * 2;
  const HIT = D + 16;

  // Slow, sin-eased breath on the next-up node. Tiny scale change
  // paired with a halo opacity ripple so the motion reads as gentle
  // breathing rather than a bouncing dot. Loop only runs while
  // isNext stays true.
  const pulse = useSharedValue(1);
  const haloOpacity = useSharedValue(0.5);
  useEffect(() => {
    if (isNext) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
      haloOpacity.value = withRepeat(
        withSequence(
          withTiming(0.95, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.45, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 240 });
      haloOpacity.value = withTiming(0, { duration: 240 });
    }
  }, [isNext]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowOpacity: isNext ? haloOpacity.value : 0,
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
            // Soft accent halo on the up-next node — its opacity is
            // animated by the breath loop above; this just declares the
            // colour and radius. shadowOpacity defaults to 0 when not
            // next so the rest of the chain stays clean.
            ...(isNext
              ? {
                  shadowColor: accent,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 10,
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
  meta,
  state,
  accent,
  align,
  cy,
  left,
  width,
}: {
  text: string;
  meta?: string;
  state: NodeState;
  accent: string;
  align: 'left' | 'right';
  cy: number;
  left: number;
  width: number;
}) {
  const locked = state === 'locked';
  const soon = state === 'soon';
  const done = state === 'done';
  const dimmed = locked || soon;
  // Estimated label vertical footprint — used to centre vertically on
  // the node without measuring at runtime. Up to 2 lines title + meta.
  const ESTIMATED_H = 60;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top: cy - ESTIMATED_H / 2,
        width,
        height: ESTIMATED_H,
        justifyContent: 'center',
        alignItems: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <Text
        numberOfLines={2}
        style={{
          ...typo.h3,
          fontSize: 13,
          lineHeight: 17,
          color: dimmed ? colors.textDim : (done ? accent : colors.text),
          textAlign: align,
        }}
      >
        {text}
      </Text>
      {meta || soon || locked ? (
        <Text
          numberOfLines={1}
          style={{
            ...typo.caption,
            fontSize: 10,
            color: dimmed ? colors.textDim : colors.textMuted,
            marginTop: 2,
            textAlign: align,
          }}
        >
          {soon ? 'SOON' : locked ? 'LOCKED' : meta}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

function buildPathSegments(
  layers: Layer[],
  rowYs: number[],
  SM_X: number,
  QM_X: number,
  CENTER_X: number,
  nodeR: number,
  listened: Record<string, true>,
) {
  const elements: React.ReactNode[] = [];
  let prevRowIdx: number | null = null;

  // Helper: a row is "completed" when at least one of its tracks has
  // been listened. Drives the traversed/remaining colour split below.
  const rowDone = (l: Layer): boolean => {
    if (l.kind !== 'row') return false;
    return Boolean(
      (l.smTrack && listened[l.smTrack.id]) ||
      (l.qmTrack && listened[l.qmTrack.id]),
    );
  };

  layers.forEach((layer, i) => {
    if (layer.kind !== 'row') return;
    if (prevRowIdx === null) {
      prevRowIdx = i;
      return;
    }
    const prev = layers[prevRowIdx];
    if (prev.kind !== 'row') {
      prevRowIdx = i;
      return;
    }
    const yPrev = rowYs[prevRowIdx];
    const yCur = rowYs[i];

    // Segment lights up as soon as the LOWER endpoint (= entry going
    // up) is listened — that way, completing a track immediately
    // illuminates the trail leaving it and the user feels their
    // progress carrying upward into the unlistened section above.
    // (`layer` is the lower endpoint here because we're walking
    // top-down through layers and `prev` is the row ABOVE in display.)
    const traversed = rowDone(layer);

    const prevBranched = prev.smTrack !== null && prev.qmTrack !== null;
    const curBranched = layer.smTrack !== null && layer.qmTrack !== null;
    const prevAnchorX = prevBranched ? null : CENTER_X;
    const curAnchorX = curBranched ? null : CENTER_X;

    type Seg = { x1: number; y1: number; x2: number; y2: number };
    const segs: Seg[] = [];
    if (prevAnchorX !== null && curAnchorX !== null) {
      segs.push({ x1: prevAnchorX, y1: yPrev, x2: curAnchorX, y2: yCur });
    } else if (prevAnchorX !== null && curAnchorX === null) {
      segs.push({ x1: prevAnchorX, y1: yPrev, x2: SM_X, y2: yCur });
      segs.push({ x1: prevAnchorX, y1: yPrev, x2: QM_X, y2: yCur });
    } else if (prevAnchorX === null && curAnchorX !== null) {
      segs.push({ x1: SM_X, y1: yPrev, x2: curAnchorX, y2: yCur });
      segs.push({ x1: QM_X, y1: yPrev, x2: curAnchorX, y2: yCur });
    } else {
      segs.push({ x1: SM_X, y1: yPrev, x2: SM_X, y2: yCur });
      segs.push({ x1: QM_X, y1: yPrev, x2: QM_X, y2: yCur });
    }

    const stroke = traversed ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.18)';
    const strokeWidth = traversed ? 2.5 : 2;

    segs.forEach((s, j) => {
      // Trim each end by nodeR so the path stops at the circle border
      // rather than crossing through it.
      const ty1 = s.y1 + nodeR;
      const ty2 = s.y2 - nodeR;
      const isDiagonal = s.x1 !== s.x2;
      const d = isDiagonal
        ? `M ${s.x1} ${ty1} C ${s.x1} ${(ty1 + ty2) / 2}, ${s.x2} ${(ty1 + ty2) / 2}, ${s.x2} ${ty2}`
        : `M ${s.x1} ${ty1} L ${s.x2} ${ty2}`;
      elements.push(
        <Path
          key={`p-${i}-${j}`}
          d={d}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
        />,
      );
    });

    prevRowIdx = i;
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
  partName: {
    ...typo.overline,
    color: colors.text,
    fontSize: 11,
    letterSpacing: 2.4,
  },
  partTag: {
    backgroundColor: colors.bgTab,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
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
    height: 24,
    marginTop: -12, // overlap the dashed line so the partTag bg cuts it
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabelLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
