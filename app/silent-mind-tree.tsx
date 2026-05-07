import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackButton } from '../src/components/BackButton';
import { silentMindVolets, introAudios } from '../src/content/catalog';
import { useProgress } from '../src/player/progressStore';
import { colors, radius, spacing, type as typo } from '../src/theme';

/**
 * Alternative visualization of the Silent Mind program: a vertical
 * journey tree the user climbs from bottom (Introduction · underground)
 * to top (Part 3 · the Space). Each part where a QM track is available
 * forks into two parallel lanes (Silent Mind on the left, QM on the
 * right) which re-merge below if the next stage is single-lane.
 *
 * Unlock rule (per user spec, may evolve): completing ANY one branch
 * unlocks the next stage — i.e. SM-or-QM, not SM-and-QM.
 *
 * Plain navy background for now; visual zones (earth/sky/space) will
 * be layered in later, possibly through the existing shader system.
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
};

// Tree geometry — kept conservative so the branched stages still fit
// on narrow phones (≤320 px). All connector + node positions derive
// from these constants so the SVG paths and the absolute-positioned
// nodes always line up.
const NODE_W = 130;
const NODE_H = 76;
const LANE_GAP = 30;
const TREE_W = NODE_W * 2 + LANE_GAP;       // 290
const TREE_CENTER = TREE_W / 2;             // 145
const SM_X = NODE_W / 2;                    // 65 — left lane centre
const QM_X = TREE_W - NODE_W / 2;           // 225 — right lane centre
const CONNECTOR_H = 84;

function buildStages(): StageDef[] {
  const stages: StageDef[] = [
    { id: 'intro', zone: 'Introduction', smTitle: 'Introduction', smCount: introAudios.length, qmCount: 0 },
  ];
  for (const v of silentMindVolets) {
    if (v.id === 'intro') continue;
    stages.push({
      id: v.id as StageId,
      zone: v.tagline ?? v.subtitle ?? v.title,
      smTitle: v.subtitle ?? v.title,
      smCount: v.tracks.filter(t => !t.comingSoon).length,
      qmCount: (v.qmTracks ?? []).filter(t => !t.comingSoon).length,
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
  if (ids.length === 0) return 'locked'; // no playable tracks yet

  if (stage === 'intro') {
    return ids.every(id => listened[id]) ? 'done' : 'available';
  }

  // Unlock if ANY track from the previous stage (either lane) was listened.
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
  const { width } = useWindowDimensions();
  const listened = useProgress(s => s.listened);
  const scrollRef = useRef<ScrollView>(null);

  const stages = useMemo(() => buildStages(), []);
  // Display order: top of scroll → bottom of scroll
  // We want Part 3 at the top (Space), Intro at the bottom (start).
  const displayed = useMemo(() => [...stages].reverse(), [stages]);

  // On first mount, scroll to the bottom so the user sees the
  // Introduction node (their starting point) without having to scroll up.
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => clearTimeout(id);
  }, []);

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
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your Journey</Text>
        <Text style={styles.subtitle}>From Introduction to Silence — climb at your own pace.</Text>

        <View style={[styles.tree, { width: TREE_W }]}>
          {displayed.map((stage, i) => {
            const branched = stage.qmCount > 0;
            const smState = branchState(stage.id, 'sm', listened);
            const qmState = branched ? branchState(stage.id, 'qm', listened) : 'locked';

            // The stage immediately BELOW this one in display order.
            const next = displayed[i + 1];
            const fromShape: 'single' | 'branched' = branched ? 'branched' : 'single';
            const toShape: 'single' | 'branched' | undefined =
              next ? (next.qmCount > 0 ? 'branched' : 'single') : undefined;

            return (
              <View key={stage.id}>
                <StageRow
                  stage={stage}
                  smState={smState}
                  qmState={qmState}
                  branched={branched}
                  onPressLane={(lane, state) => navigate(stage.id, lane, state)}
                />
                {toShape ? (
                  <Connector from={fromShape} to={toShape} />
                ) : null}
              </View>
            );
          })}
          <StartHere />
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------

function StageRow({
  stage,
  smState,
  qmState,
  branched,
  onPressLane,
}: {
  stage: StageDef;
  smState: BranchState;
  qmState: BranchState;
  branched: boolean;
  onPressLane: (lane: Lane, state: BranchState) => void;
}) {
  return (
    <View style={styles.stageRow}>
      <Text style={styles.zoneLabel}>{stage.zone}</Text>
      {branched ? (
        <View style={styles.lanesRow}>
          <LaneNode
            title="Silent Mind"
            count={`${stage.smCount} ${stage.smCount === 1 ? 'practice' : 'practices'}`}
            accent={colors.accent}
            state={smState}
            onPress={() => onPressLane('sm', smState)}
          />
          <View style={{ width: LANE_GAP }} />
          <LaneNode
            title="QM Training"
            count={`${stage.qmCount} ${stage.qmCount === 1 ? 'session' : 'sessions'}`}
            accent={colors.accentAlt}
            state={qmState}
            onPress={() => onPressLane('qm', qmState)}
          />
        </View>
      ) : (
        <View style={styles.lanesRow}>
          <LaneNode
            title={stage.id === 'intro' ? 'Introduction' : 'Silent Mind'}
            count={
              stage.id === 'intro'
                ? `${stage.smCount} ${stage.smCount === 1 ? 'audio' : 'audios'}`
                : `${stage.smCount} ${stage.smCount === 1 ? 'practice' : 'practices'}`
            }
            accent={colors.accent}
            state={smState}
            onPress={() => onPressLane('sm', smState)}
          />
        </View>
      )}
    </View>
  );
}

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
              : `${accent}1F`, // ~12 % alpha tint
        },
        pressed && !locked && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[
          styles.nodeTitle,
          { color: locked ? colors.textDim : colors.text },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.nodeCount,
          { color: locked ? colors.textDim : colors.textMuted },
        ]}
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

function Connector({
  from,
  to,
}: {
  from: 'single' | 'branched';
  to: 'single' | 'branched';
}) {
  const w = TREE_W;
  const h = CONNECTOR_H;
  const c = TREE_CENTER;
  const sm = SM_X;
  const qm = QM_X;

  let d = '';
  if (from === 'single' && to === 'single') {
    d = `M ${c} 0 L ${c} ${h}`;
  } else if (from === 'single' && to === 'branched') {
    // Drop straight from above, then split smoothly into both lanes.
    const mid = h * 0.35;
    d = `M ${c} 0 L ${c} ${mid}
         M ${c} ${mid} C ${c} ${(mid + h) / 2}, ${sm} ${(mid + h) / 2}, ${sm} ${h}
         M ${c} ${mid} C ${c} ${(mid + h) / 2}, ${qm} ${(mid + h) / 2}, ${qm} ${h}`;
  } else if (from === 'branched' && to === 'branched') {
    // Two parallel rails — no merge, no split.
    d = `M ${sm} 0 L ${sm} ${h}
         M ${qm} 0 L ${qm} ${h}`;
  } else {
    // branched → single: two lanes converge then drop to centre.
    const mid = h * 0.65;
    d = `M ${sm} 0 C ${sm} ${mid / 2}, ${c} ${mid / 2}, ${c} ${mid}
         M ${qm} 0 C ${qm} ${mid / 2}, ${c} ${mid / 2}, ${c} ${mid}
         M ${c} ${mid} L ${c} ${h}`;
  }

  return (
    <View style={{ width: w, height: h, alignSelf: 'center' }}>
      <Svg width={w} height={h}>
        <Path d={d} stroke="rgba(255,255,255,0.32)" strokeWidth={2} fill="none" />
      </Svg>
    </View>
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
  scroll: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typo.display,
    color: colors.text,
    fontSize: 22,
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typo.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  tree: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  stageRow: {
    alignItems: 'center',
  },
  zoneLabel: {
    ...typo.overline,
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 2.4,
    marginBottom: spacing.sm,
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
    fontSize: 14,
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
  startHere: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
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
});
