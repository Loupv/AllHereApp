import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
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

// Node size — bigger now that each carries a label.
const NODE_R = 16;

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

  // Per-layer Y positions (centre of each row's node, or the dashed
  // line for divider layers).
  const rowYs = useMemo(() => {
    const ys: number[] = [];
    let y = ROW_PITCH / 2;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (l.kind === 'row') {
        ys.push(y);
        y += ROW_PITCH;
      } else {
        ys.push(y - ROW_PITCH / 2 + DIVIDER_GAP / 2); // sit between the rows
        y += DIVIDER_GAP;
      }
    }
    return ys;
  }, [layers]);

  const totalH = useMemo(() => {
    let y = ROW_PITCH / 2;
    for (const l of layers) y += l.kind === 'row' ? ROW_PITCH : DIVIDER_GAP;
    return y + ROW_PITCH / 2;
  }, [layers]);

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

  // Scroll-driven background fades. lake (Intro + P1) ↔ sky (P2) ↔
  // space (P3) crossfades happen across the inter-part dividers, with
  // a fade window centred on each boundary's Y in scroll content.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  // Y positions of the P2↔P3 and P1↔P2 boundaries within scroll
  // content. Used by the opacity worklets below; recomputed when the
  // layer layout changes.
  const { yP2P3, yP1P2 } = useMemo(() => {
    let yP2P3 = 0;
    let yP1P2 = 0;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (l.kind !== 'divider') continue;
      // The divider sits between two parts; find both neighbour rows.
      let above: StageId | null = null;
      let below: StageId | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const r = layers[j];
        if (r.kind === 'row') { above = r.partId; break; }
      }
      for (let j = i + 1; j < layers.length; j++) {
        const r = layers[j];
        if (r.kind === 'row') { below = r.partId; break; }
      }
      if (above === 'part3' && below === 'part2') yP2P3 = rowYs[i];
      else if (above === 'part2' && below === 'part1') yP1P2 = rowYs[i];
    }
    return { yP2P3, yP1P2 };
  }, [layers, rowYs]);

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

  // Land the user on the bottom of the tree (Welcome) at first mount.
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => clearTimeout(id);
  }, [totalH]);

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
    openPlayer(t, playlist, { autoStart: true });
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
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>Your Journey</Text>

        <View style={[styles.tree, { width: totalW, height: totalH }]}>
          <Svg
            width={totalW}
            height={totalH}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {buildPathSegments(layers, rowYs, SM_X, QM_X, CENTER_X, listened)}
          </Svg>

          {/* Dashed dividers spanning the tree width — drawn first so
              the part-name label below sits on top with a dark mask. */}
          {layers.map((l, i) => {
            if (l.kind !== 'divider') return null;
            const y = rowYs[i];
            return (
              <View
                key={`div-${i}`}
                style={[
                  styles.divider,
                  { top: y - 0.5, width: totalW + 24, left: -12 },
                ]}
                pointerEvents="none"
              />
            );
          })}

          {/* Part-name labels at each divider — section header for the
              part you're ENTERING going up. The opaque pill cuts the
              dashed line, making the boundary feel like a clear "you
              are now in EARTH" beat. */}
          {dividerLabels.map(({ idx, partId }) => {
            const y = rowYs[idx];
            return (
              <View
                key={`pl-${idx}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: y - 14,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <View style={styles.partTag}>
                  <Text style={styles.partName} numberOfLines={1}>
                    {partLabel(partId)}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Bottommost part has no divider below it — render its label
              as a footer just below the last row (with the same dashed
              section-break treatment as the inter-part dividers, so
              reading bottom-up the user sees the part name BEFORE its
              first track). */}
          {bottomPartId ? (
            <>
              <View
                style={[
                  styles.divider,
                  { bottom: 18, width: totalW + 24, left: -12 },
                ]}
                pointerEvents="none"
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: 6,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <View style={styles.partTag}>
                  <Text style={styles.partName} numberOfLines={1}>
                    {partLabel(bottomPartId)}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

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
                  accent={colors.accent}
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
                  accent={colors.accent}
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
                accent={colors.accentAlt}
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
                    accent={colors.accent}
                    state={smState}
                    isNext={l.smTrack.id === nextId}
                    onPress={() => playTrack('sm', l.partId, l.smTrack!)}
                  />
                ) : null}
                {l.qmTrack ? (
                  <CircleNode
                    cx={qmCx}
                    cy={y}
                    accent={colors.accentAlt}
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

        <Text style={styles.startCaption}>Welcome — your starting point</Text>
      </Animated.ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------

function CircleNode({
  cx,
  cy,
  accent,
  state,
  isNext,
  onPress,
}: {
  cx: number;
  cy: number;
  accent: string;
  state: NodeState;
  isNext: boolean;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const soon = state === 'soon';
  const done = state === 'done';
  const dimmed = locked || soon;
  const D = NODE_R * 2;
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
            borderRadius: NODE_R,
            borderWidth: 2.5,
            borderColor: dimmed ? 'rgba(255,255,255,0.30)' : accent,
            // Fully opaque fill — hides the connector path passing
            // behind so the "tree behind the dot" never shows through.
            backgroundColor: dimmed
              ? colors.bgTab
              : done
                ? accent
                : colors.bgTab,
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
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
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
      // Trim each end by NODE_R so the path stops at the circle border
      // rather than crossing through it.
      const ty1 = s.y1 + NODE_R;
      const ty2 = s.y2 - NODE_R;
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
});
