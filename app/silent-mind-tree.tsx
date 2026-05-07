import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackButton } from '../src/components/BackButton';
import { silentMindVolets, introAudios, trackDuration, type AudioTrack } from '../src/content/catalog';
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

const QM_TO_SM_PAIRING: Record<string, string> = {
  'qm1-2': 'p1-2',
  'qm1-4': 'p1-3',
  'qm2-3': 'p2-3',
};

// Vertical rhythm — pitch determines "how many stages per screen". At
// ~150 px per row pitch, a typical mobile viewport (~700 usable px)
// fits 4-5 rows + a couple of dashed-divider transitions.
const ROW_PITCH = 150;
const DIVIDER_GAP = 56;     // extra vertical space when a divider sits between rows

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
  const { width: winW } = useWindowDimensions();
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

  // Anchor index for each part = its bottom-most row in display order
  // (the entry track going UP). Drives where the "Introduction / Earth /
  // Sky / Space" part-name label sits next to the tree.
  const partAnchors = useMemo(() => {
    const out: { partId: StageId; layerIdx: number }[] = [];
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (l.kind !== 'row') continue;
      const next = layers[i + 1];
      if (!next || next.kind === 'divider') {
        out.push({ partId: l.partId, layerIdx: i });
      }
    }
    return out;
  }, [layers]);

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
    <View style={[styles.root, { backgroundColor: colors.bgTab }]}>
      <Stack.Screen options={{ title: '' }} />
      <BackButton />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your Journey</Text>

        <View style={[styles.tree, { width: totalW, height: totalH }]}>
          <Svg
            width={totalW}
            height={totalH}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {buildPathSegments(layers, rowYs, SM_X, QM_X, CENTER_X)}
          </Svg>

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

          {/* Part-name labels — sit on the LEFT of each part's bottom
              row (the entry track going up). Bottom rows are always
              single-lane today, so the left gutter is free for the
              part-name label without colliding with track labels. */}
          {partAnchors.map(({ partId, layerIdx }) => {
            const y = rowYs[layerIdx];
            const labelRight = CENTER_X - NODE_R - LABEL_PAD - 4;
            return (
              <View
                key={`part-${partId}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: y - 12,
                  width: labelRight,
                  height: 24,
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                }}
              >
                <Text style={styles.partName} numberOfLines={1}>
                  {partLabel(partId)}
                </Text>
              </View>
            );
          })}

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
                    onPress={() => playTrack('sm', l.partId, l.smTrack!)}
                  />
                ) : null}
                {l.qmTrack ? (
                  <CircleNode
                    cx={qmCx}
                    cy={y}
                    accent={colors.accentAlt}
                    state={qmState}
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
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------

function CircleNode({
  cx,
  cy,
  accent,
  state,
  onPress,
}: {
  cx: number;
  cy: number;
  accent: string;
  state: NodeState;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const soon = state === 'soon';
  const done = state === 'done';
  const dimmed = locked || soon;
  const D = NODE_R * 2;
  const HIT = D + 12;
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
      <View
        style={{
          width: D,
          height: D,
          borderRadius: NODE_R,
          borderWidth: 2.5,
          borderColor: dimmed ? 'rgba(255,255,255,0.30)' : accent,
          backgroundColor: dimmed
            ? 'transparent'
            : done
              ? accent
              : `${accent}33`, // ~20% alpha so the connector glides through
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done ? (
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
        ) : null}
      </View>
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
) {
  const elements: React.ReactNode[] = [];
  let prevRowIdx: number | null = null;

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

    segs.forEach((s, j) => {
      const isDiagonal = s.x1 !== s.x2;
      const d = isDiagonal
        ? `M ${s.x1} ${s.y1} C ${s.x1} ${(s.y1 + s.y2) / 2}, ${s.x2} ${(s.y1 + s.y2) / 2}, ${s.x2} ${s.y2}`
        : `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`;
      elements.push(
        <Path
          key={`p-${i}-${j}`}
          d={d}
          stroke="rgba(255,255,255,0.32)"
          strokeWidth={2}
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.20)',
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
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
  },
});
