import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackButton } from '../src/components/BackButton';
import { silentMindVolets, introAudios } from '../src/content/catalog';
import { useProgress } from '../src/player/progressStore';
import { colors, radius, spacing, type as typo } from '../src/theme';

/**
 * Vertical journey tree as a per-stage pager. Each viewport-height page
 * focuses on one zone (Introduction · Earth · Sky · Space) so the user
 * climbs the tree stage by stage. Pages snap; landing scrolls to the
 * Introduction page (the starting point); pagination rail on the right
 * shows position + lock state.
 */

type StageId = 'intro' | 'part1' | 'part2' | 'part3';
type Lane = 'sm' | 'qm';
type BranchState = 'locked' | 'available' | 'done';

type StageDef = {
  id: StageId;
  zone: string;        // The Earth / Sky / Space / Underground
  smTitle: string;
  smCount: number;     // playable SM tracks (excl. comingSoon)
  qmCount: number;     // playable QM tracks
  description?: string;
};

const NODE_W = 150;
const NODE_H = 92;
const LANE_GAP = 36;
const TREE_W = NODE_W * 2 + LANE_GAP;       // 336
const TREE_CENTER = TREE_W / 2;             // 168
const SM_X = NODE_W / 2;                    // 75
const QM_X = TREE_W - NODE_W / 2;           // 261
const HINT_H = 56;                          // small connector hint at top/bottom of a page

function buildStages(): StageDef[] {
  const stages: StageDef[] = [
    {
      id: 'intro', zone: 'Introduction', smTitle: 'Introduction',
      smCount: introAudios.length, qmCount: 0,
      description: 'Three short audios to get oriented before the journey begins.',
    },
  ];
  for (const v of silentMindVolets) {
    if (v.id === 'intro') continue;
    stages.push({
      id: v.id as StageId,
      zone: v.tagline ?? v.subtitle ?? v.title,
      smTitle: v.subtitle ?? v.title,
      smCount: v.tracks.filter(t => !t.comingSoon).length,
      qmCount: (v.qmTracks ?? []).filter(t => !t.comingSoon).length,
      description: v.description,
    });
  }
  return stages;
}

function trackIdsFor(stage: StageId, lane: Lane): string[] {
  if (stage === 'intro') return lane === 'sm' ? introAudios.map(t => t.id) : [];
  const v = silentMindVolets.find(s => s.id === stage);
  if (!v) return [];
  const list = lane === 'sm' ? v.tracks : (v.qmTracks ?? []);
  return list.filter(t => !t.comingSoon).map(t => t.id);
}

function previousStage(stage: StageId): StageId | undefined {
  if (stage === 'part1') return 'intro';
  if (stage === 'part2') return 'part1';
  if (stage === 'part3') return 'part2';
  return undefined;
}

function branchState(
  stage: StageId,
  lane: Lane,
  listened: Record<string, true>,
): BranchState {
  const ids = trackIdsFor(stage, lane);
  if (ids.length === 0) return 'locked';

  if (stage === 'intro') {
    return ids.every(id => listened[id]) ? 'done' : 'available';
  }

  const prev = previousStage(stage)!;
  const prevSm = trackIdsFor(prev, 'sm');
  const prevQm = trackIdsFor(prev, 'qm');
  const anyPrevDone = [...prevSm, ...prevQm].some(id => listened[id]);
  if (!anyPrevDone) return 'locked';
  return ids.every(id => listened[id]) ? 'done' : 'available';
}

export default function SilentMindTreeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const listened = useProgress(s => s.listened);
  const scrollRef = useRef<ScrollView>(null);

  const stages = useMemo(() => buildStages(), []);
  // Display order top → bottom of scroll: Space first, Introduction last,
  // so swiping up the screen reveals the next stage *above* (climbing).
  const displayed = useMemo(() => [...stages].reverse(), [stages]);

  // Use a fixed page height that matches the viewport so each stage
  // takes the screen exactly. We cap below to leave room for safe-area
  // insets without doing layout-time math per page.
  const pageH = winH;

  const [activeIdx, setActiveIdx] = useState(displayed.length - 1); // intro by default

  // Land on Introduction (last page in display order = bottom of scroll)
  // so the user starts at their actual entry point. iOS Safari needs a
  // tick after layout before scrollTo lands correctly.
  useEffect(() => {
    const id = setTimeout(() => {
      const introOffset = (displayed.length - 1) * pageH;
      scrollRef.current?.scrollTo({ y: introOffset, animated: false });
    }, 50);
    return () => clearTimeout(id);
  }, [pageH, displayed.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / pageH);
    if (idx !== activeIdx && idx >= 0 && idx < displayed.length) {
      setActiveIdx(idx);
    }
  };

  const navigate = (stage: StageId, lane: Lane, state: BranchState) => {
    if (state === 'locked') return;
    if (lane === 'sm') router.push(`/silent-mind/${stage}` as never);
    else router.push(`/qm/${stage}` as never);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bgTab }]}>
      <Stack.Screen options={{ title: '' }} />
      <BackButton />

      <ScrollView
        ref={scrollRef}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={pageH}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {displayed.map((stage, i) => {
          const branched = stage.qmCount > 0;
          const smState = branchState(stage.id, 'sm', listened);
          const qmState = branched ? branchState(stage.id, 'qm', listened) : 'locked';
          const prev = displayed[i - 1]; // page above (more advanced stage)
          const next = displayed[i + 1]; // page below (earlier stage)

          // Connector hints at top/bottom of the page so the user gets a
          // visual cue of continuity even though stages are paged.
          const fromShape: 'single' | 'branched' = branched ? 'branched' : 'single';
          const aboveShape: 'single' | 'branched' | undefined =
            prev ? (prev.qmCount > 0 ? 'branched' : 'single') : undefined;
          const belowShape: 'single' | 'branched' | undefined =
            next ? (next.qmCount > 0 ? 'branched' : 'single') : undefined;

          return (
            <View
              key={stage.id}
              style={[styles.page, { height: pageH, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}
            >
              {/* Top hint — connector entering this stage from the stage above */}
              <View style={styles.hintTop}>
                {aboveShape ? (
                  <PageConnector edge="top" from={aboveShape} to={fromShape} />
                ) : (
                  <View style={{ height: HINT_H }} />
                )}
              </View>

              {/* Centered stage block — zone label, node(s), description
                  travel together so the visual centre of mass stays
                  on the node, not pushed down by flex distribution. */}
              <View style={styles.centerStage}>
                <Text style={styles.zoneLabel}>{stage.zone}</Text>
                <View style={styles.lanesRow}>
                  {branched ? (
                    <>
                      <LaneNode
                        title="Silent Mind"
                        count={`${stage.smCount} ${stage.smCount === 1 ? 'practice' : 'practices'}`}
                        accent={colors.accent}
                        state={smState}
                        onPress={() => navigate(stage.id, 'sm', smState)}
                      />
                      <View style={{ width: LANE_GAP }} />
                      <LaneNode
                        title="QM Training"
                        count={`${stage.qmCount} ${stage.qmCount === 1 ? 'session' : 'sessions'}`}
                        accent={colors.accentAlt}
                        state={qmState}
                        onPress={() => navigate(stage.id, 'qm', qmState)}
                      />
                    </>
                  ) : (
                    <LaneNode
                      title={stage.id === 'intro' ? 'Introduction' : 'Silent Mind'}
                      count={
                        stage.id === 'intro'
                          ? `${stage.smCount} ${stage.smCount === 1 ? 'audio' : 'audios'}`
                          : `${stage.smCount} ${stage.smCount === 1 ? 'practice' : 'practices'}`
                      }
                      accent={colors.accent}
                      state={smState}
                      onPress={() => navigate(stage.id, 'sm', smState)}
                    />
                  )}
                </View>
                {stage.description ? (
                  <Text style={styles.description} numberOfLines={3}>
                    {stage.description}
                  </Text>
                ) : null}
              </View>

              {/* Bottom hint — connector continuing down to the stage below */}
              <View style={styles.hintBottom}>
                {belowShape ? (
                  <PageConnector edge="bottom" from={fromShape} to={belowShape} />
                ) : (
                  <StartHere />
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Right-edge progress rail — one bullet per stage, current
          highlighted. Tapping a bullet jumps to that page. */}
      <View
        pointerEvents="box-none"
        style={[styles.rail, { top: insets.top + 80, bottom: insets.bottom + 80 }]}
      >
        {displayed.map((s, i) => {
          const stageBranched = s.qmCount > 0;
          const reachable =
            branchState(s.id, 'sm', listened) !== 'locked' ||
            (stageBranched && branchState(s.id, 'qm', listened) !== 'locked');
          const active = i === activeIdx;
          return (
            <Pressable
              key={s.id}
              onPress={() => scrollRef.current?.scrollTo({ y: i * pageH, animated: true })}
              hitSlop={8}
              style={[
                styles.railDot,
                !reachable && styles.railDotLocked,
                // Active wins over locked for the colour so the "you
                // are here" indicator stays readable even on stages
                // that are currently out of reach.
                active && styles.railDotActive,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function LaneNode({
  title,
  count,
  accent,
  state,
  onPress,
}: {
  title: string;
  count: string;
  accent: string;
  state: BranchState;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const done = state === 'done';
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      hitSlop={6}
      style={({ pressed }) => [
        styles.node,
        {
          width: NODE_W,
          height: NODE_H,
          borderColor: locked ? 'rgba(255,255,255,0.10)' : accent,
          backgroundColor: locked
            ? 'rgba(255,255,255,0.025)'
            : done
              ? 'rgba(255,255,255,0.04)'
              : `${accent}1F`,
        },
        pressed && !locked && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[styles.nodeTitle, { color: locked ? colors.textDim : colors.text }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[styles.nodeCount, { color: locked ? colors.textDim : colors.textMuted }]}
        numberOfLines={1}
      >
        {count}
      </Text>
      {locked ? (
        <Text style={styles.stateGlyph}>🔒</Text>
      ) : done ? (
        <Text style={[styles.stateGlyph, { color: accent }]}>✓</Text>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

/**
 * Connector hint stub at the top / bottom edge of a page. Conveys
 * continuity (something is above / below) without pulling the next
 * stage's nodes onto this page.
 */
function PageConnector({
  edge,
  from,
  to,
}: {
  edge: 'top' | 'bottom';
  from: 'single' | 'branched';
  to: 'single' | 'branched';
}) {
  const w = TREE_W;
  const h = HINT_H;
  const c = TREE_CENTER;
  const sm = SM_X;
  const qm = QM_X;

  // Top hint: line(s) come into the bottom edge of the hint area (where
  // the node sits below). Bottom hint: line(s) leave from the top edge
  // (where the node sat above). We model both as "incoming = the page's
  // current stage shape" and "outgoing = the neighbour's shape".
  const incoming = edge === 'top' ? to : from; // shape at the page-side
  const outgoing = edge === 'top' ? from : to; // shape at the off-page side

  // Positions: yClose = side closer to the page's nodes; yFar = off-page.
  const yClose = edge === 'top' ? h : 0;
  const yFar = edge === 'top' ? 0 : h;

  let d = '';
  if (incoming === 'single' && outgoing === 'single') {
    d = `M ${c} ${yFar} L ${c} ${yClose}`;
  } else if (incoming === 'single' && outgoing === 'branched') {
    // page-side single, off-page branched — diverge toward the edge.
    const yMid = (yFar + yClose) / 2;
    d = `M ${c} ${yClose} L ${c} ${yMid}
         M ${c} ${yMid} C ${c} ${(yMid + yFar) / 2}, ${sm} ${(yMid + yFar) / 2}, ${sm} ${yFar}
         M ${c} ${yMid} C ${c} ${(yMid + yFar) / 2}, ${qm} ${(yMid + yFar) / 2}, ${qm} ${yFar}`;
  } else if (incoming === 'branched' && outgoing === 'branched') {
    d = `M ${sm} ${yFar} L ${sm} ${yClose}
         M ${qm} ${yFar} L ${qm} ${yClose}`;
  } else {
    // page-side branched, off-page single — converge toward the edge.
    const yMid = (yFar + yClose) / 2;
    d = `M ${sm} ${yClose} C ${sm} ${(yMid + yClose) / 2}, ${c} ${(yMid + yClose) / 2}, ${c} ${yMid}
         M ${qm} ${yClose} C ${qm} ${(yMid + yClose) / 2}, ${c} ${(yMid + yClose) / 2}, ${c} ${yMid}
         M ${c} ${yMid} L ${c} ${yFar}`;
  }

  return (
    <Svg width={w} height={h}>
      <Path d={d} stroke="rgba(255,255,255,0.32)" strokeWidth={2} fill="none" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------

function StartHere() {
  return (
    <View style={styles.startHere}>
      <View style={styles.startBullet} />
      <Text style={styles.startText}>Start here</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hintTop: { alignItems: 'center', height: HINT_H },
  hintBottom: { alignItems: 'center', minHeight: HINT_H, paddingBottom: spacing.lg },
  centerStage: {
    alignItems: 'center',
    width: '100%',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  zoneLabel: {
    ...typo.display,
    color: colors.text,
    fontSize: 22,
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  lanesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTitle: {
    ...typo.h3,
    fontSize: 15,
    textAlign: 'center',
  },
  nodeCount: {
    ...typo.caption,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  stateGlyph: {
    position: 'absolute',
    top: 6,
    right: 8,
    fontSize: 12,
    color: colors.textDim,
  },
  description: {
    ...typo.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  startHere: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  startBullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  startText: {
    ...typo.overline,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 2,
  },
  rail: {
    position: 'absolute',
    right: spacing.md,
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  railDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  railDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  railDotLocked: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
