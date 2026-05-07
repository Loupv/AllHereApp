import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackButton } from '../src/components/BackButton';
import { silentMindVolets, introAudios, type AudioTrack } from '../src/content/catalog';
import { useProgress, isTrackUnlocked } from '../src/player/progressStore';
import { usePlayerStore } from '../src/player/store';
import { colors, spacing, type as typo } from '../src/theme';

/**
 * Continuous-tree visualisation of the Silent Mind program. Each track
 * is a small circle node; the tree climbs bottom-up from "Welcome" at
 * the bottom to the deepest Part 3 practice at the top. SM tracks sit
 * on the left lane, paired QM counterparts on the right lane (when one
 * exists), connected by a single curve through the part. Dashed
 * horizontal lines mark the transitions between Parts. Tap a node →
 * opens the Player on that track.
 */

type StageId = 'intro' | 'part1' | 'part2' | 'part3';
type Lane = 'sm' | 'qm';
type NodeState = 'locked' | 'available' | 'done' | 'soon';

/**
 * QM ↔ SM track pairings — declared explicitly because catalog titles
 * diverge ("QM3 — Breathing Body" vs SM "Breath and Self-Observation").
 * Add new entries when QM rounds are added to a part.
 */
const QM_TO_SM_PAIRING: Record<string, string> = {
  'qm1-2': 'p1-2',
  'qm1-4': 'p1-3',
  'qm2-3': 'p2-3',
};

// Tree geometry — kept tight so the whole journey fits in one mobile
// viewport without scrolling (target: Part 2 visible from rest).
const ROW_H = 38;          // height of one row (node + connector segment)
const NODE_R = 8;          // node radius
const TREE_W = 220;        // logical tree width — drives lane positions
const SM_X = TREE_W * 0.28;          //  ~62
const QM_X = TREE_W * 0.72;          // ~158
const CENTER_X = TREE_W / 2;         // 110
const DIVIDER_H = 26;      // dashed-line height (between parts)

type Layer =
  | { kind: 'row'; smTrack: AudioTrack | null; qmTrack: AudioTrack | null; hasQM: boolean; partId: StageId }
  | { kind: 'divider' };

/**
 * Build the flat top-down sequence of layers — Part 3 first (top), then
 * a dashed divider, Part 2, divider, Part 1, divider, Intro last
 * (bottom). Within each part the tracks are reversed (catalog order is
 * sequential up = entry track first, deeper tracks last) so the entry
 * track sits at the BOTTOM of its part section.
 */
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
    const hasQM = qm.some(t => !t.comingSoon);
    // Reverse so entry track ends up at the bottom of this part section
    // when we render top-down.
    rows.reverse().forEach(r =>
      layers.push({ kind: 'row', smTrack: r.smTrack, qmTrack: r.qmTrack, hasQM, partId }),
    );
  };

  // Top-down order: Part 3, Part 2, Part 1, Intro
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

  const layers = useMemo(() => buildLayers(), []);

  // Total drawn height for the connector SVG (everything that's not a row label is in here).
  const totalH = useMemo(() => {
    let h = ROW_H / 2; // half-row of breathing space at the very top
    for (const l of layers) {
      if (l.kind === 'row') h += ROW_H;
      else h += DIVIDER_H;
    }
    h += ROW_H / 2; // half-row at the bottom (so the bottom node sits clear of the edge)
    return h;
  }, [layers]);

  const playTrack = (lane: Lane, partId: StageId, t: AudioTrack) => {
    if (t.comingSoon || !isTrackUnlocked(t.id, listened)) return;
    // Build the lane's playlist within the relevant volet so the player's
    // next/prev buttons walk the right list.
    const v = silentMindVolets.find(s => s.id === partId);
    let playlist: AudioTrack[] = [];
    if (partId === 'intro') {
      playlist = introAudios.filter(x => !x.comingSoon);
    } else if (v) {
      const list = lane === 'sm' ? v.tracks : (v.qmTracks ?? []);
      playlist = list.filter(x => !x.comingSoon);
    }
    openPlayer(t, playlist, { autoStart: true });
  };

  // Compute Y positions for each row's node centre — drives both the
  // SVG connector path and the absolute-positioned circle nodes.
  const rowYs = useMemo(() => {
    const ys: number[] = [];
    let y = ROW_H / 2;
    for (const l of layers) {
      if (l.kind === 'row') {
        ys.push(y + ROW_H / 2);
        y += ROW_H;
      } else {
        ys.push(y + DIVIDER_H / 2);
        y += DIVIDER_H;
      }
    }
    return ys;
  }, [layers]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bgTab }]}>
      <Stack.Screen options={{ title: '' }} />
      <BackButton />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your Journey</Text>

        <View style={[styles.tree, { width: TREE_W, height: totalH }]}>
          {/* Continuous progression line connecting all rows. */}
          <Svg
            width={TREE_W}
            height={totalH}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {buildPathSegments(layers, rowYs)}
          </Svg>

          {/* Dashed dividers — drawn as Views so the dashed border style
              renders consistently across web and native (SVG dasharray
              is fine but a View is one less moving part). */}
          {layers.map((l, i) => {
            if (l.kind !== 'divider') return null;
            const y = rowYs[i];
            return (
              <View
                key={`div-${i}`}
                style={[
                  styles.divider,
                  { top: y - 0.5, width: TREE_W + 28, left: -14 },
                ]}
                pointerEvents="none"
              />
            );
          })}

          {/* Circular nodes per row. Single-lane rows (no QM pair) sit on
              the centre axis so the connector line passes through them;
              branched rows split the SM and QM nodes onto their lanes. */}
          {layers.map((l, i) => {
            if (l.kind !== 'row') return null;
            const y = rowYs[i];
            const branched = l.smTrack !== null && l.qmTrack !== null;
            const smCx = branched ? SM_X : CENTER_X;
            const qmCx = branched ? QM_X : CENTER_X;
            return (
              <View key={`row-${i}`} pointerEvents="box-none">
                {l.smTrack ? (
                  <CircleNode
                    cx={smCx}
                    cy={y}
                    accent={colors.accent}
                    state={nodeState(l.smTrack, listened)}
                    onPress={() => playTrack('sm', l.partId, l.smTrack!)}
                  />
                ) : null}
                {l.qmTrack ? (
                  <CircleNode
                    cx={qmCx}
                    cy={y}
                    accent={colors.accentAlt}
                    state={nodeState(l.qmTrack, listened)}
                    onPress={() => playTrack('qm', l.partId, l.qmTrack!)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.startCaption}>Start with Welcome ↓</Text>
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
  const HIT = D + 16; // generous tap target
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
          borderWidth: 2,
          borderColor: dimmed ? 'rgba(255,255,255,0.30)' : accent,
          backgroundColor: dimmed
            ? 'transparent'
            : done
              ? accent
              : `${accent}40`, // ~25% alpha fill so available reads as "ready"
        }}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

/**
 * Build the SVG <Path> elements that draw the continuous progression
 * line. We walk consecutive PAIRS of *row* layers (skipping dividers)
 * and emit a curve between them. The shape depends on whether each row
 * is single-lane or branched, and on whether the QM/SM lane is filled
 * on either side.
 */
function buildPathSegments(layers: Layer[], rowYs: number[]) {
  const elements: React.ReactNode[] = [];
  let prevRowIdx: number | null = null;

  layers.forEach((layer, i) => {
    if (layer.kind !== 'row') return;
    const y = rowYs[i];
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
    const yCur = y;

    // Lane "occupancy" for this segment: which lanes have a node at
    // each end. We draw a sub-path per lane that's present at both
    // ends, plus a centre stem when only one end is single-lane.
    const prevSm = prev.smTrack !== null;
    const prevQm = prev.qmTrack !== null;
    const curSm = layer.smTrack !== null;
    const curQm = layer.qmTrack !== null;

    // Single-lane row uses CENTER_X for connection; paired rows use SM_X / QM_X.
    const prevSingle = !(prevSm && prevQm);
    const curSingle = !(curSm && curQm);

    const prevAnchorX = prevSingle ? CENTER_X : null; // null = both lanes
    const curAnchorX = curSingle ? CENTER_X : null;

    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
    if (prevAnchorX !== null && curAnchorX !== null) {
      segments.push({ x1: prevAnchorX, y1: yPrev, x2: curAnchorX, y2: yCur });
    } else if (prevAnchorX !== null && curAnchorX === null) {
      // single (prev = above) → branched (cur = below): split going down
      segments.push({ x1: prevAnchorX, y1: yPrev, x2: SM_X, y2: yCur });
      segments.push({ x1: prevAnchorX, y1: yPrev, x2: QM_X, y2: yCur });
    } else if (prevAnchorX === null && curAnchorX !== null) {
      // branched (prev = above) → single (cur = below): merge going down
      segments.push({ x1: SM_X, y1: yPrev, x2: curAnchorX, y2: yCur });
      segments.push({ x1: QM_X, y1: yPrev, x2: curAnchorX, y2: yCur });
    } else {
      // branched → branched: parallel rails
      segments.push({ x1: SM_X, y1: yPrev, x2: SM_X, y2: yCur });
      segments.push({ x1: QM_X, y1: yPrev, x2: QM_X, y2: yCur });
    }

    segments.forEach((s, j) => {
      // Slight cubic bezier on diagonal segments so the splits / merges
      // read as gentle curves rather than straight angles.
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
    paddingHorizontal: spacing.lg,
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
    borderTopColor: 'rgba(255,255,255,0.22)',
    borderStyle: 'dashed',
  },
  startCaption: {
    ...typo.overline,
    color: colors.textDim,
    fontSize: 9,
    letterSpacing: 1.6,
    marginTop: spacing.md,
  },
});
