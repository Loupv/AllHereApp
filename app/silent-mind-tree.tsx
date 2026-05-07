import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackButton } from '../src/components/BackButton';
import { silentMindVolets, introAudios, trackDuration, type AudioTrack } from '../src/content/catalog';
import { useProgress, isTrackUnlocked } from '../src/player/progressStore';
import { usePlayerStore } from '../src/player/store';
import { colors, radius, spacing, type as typo } from '../src/theme';

/**
 * Vertical journey tree as a per-stage pager. Each viewport-height
 * page focuses on one zone (Introduction · Earth · Sky · Space). Within
 * a page we show ONE pastille per track — the SM lane on the left, and
 * if a QM counterpart exists, its pastille opposite on the right. No
 * intermediate per-part menu: tapping a pastille opens the player on
 * that track directly.
 */

type StageId = 'intro' | 'part1' | 'part2' | 'part3';
type Lane = 'sm' | 'qm';
type PastilleState = 'locked' | 'available' | 'done' | 'soon';

type StageDef = {
  id: StageId;
  zone: string;        // The Earth / Sky / Space / Introduction
  description?: string;
  smTracks: AudioTrack[];
  qmTracks: AudioTrack[];
  hasQM: boolean;      // any playable (non-comingSoon) QM track
};

/**
 * QM ↔ SM track pairings. The catalog doesn't carry an explicit pair
 * id (and titles diverge — "QM3 — Breathing Body" vs SM "Breath and
 * Self-Observation"), so we declare the semantic pair here. Add new
 * entries when QM rounds are added to a part.
 */
const QM_TO_SM_PAIRING: Record<string, string> = {
  'qm1-2': 'p1-2',
  'qm1-4': 'p1-3',
  'qm2-3': 'p2-3',
};

// Geometry
const PASTILLE_W = 148;
const PASTILLE_GAP = 22;
const TREE_W = PASTILLE_W * 2 + PASTILLE_GAP;       // 318
const TREE_CENTER = TREE_W / 2;                     // 159
const SM_X = PASTILLE_W / 2;                        // 74
const QM_X = TREE_W - PASTILLE_W / 2;               // 244
const HINT_H = 48;

function buildStages(): StageDef[] {
  const stages: StageDef[] = [
    {
      id: 'intro',
      zone: 'Introduction',
      description: 'Three short audios to get oriented before the journey begins.',
      smTracks: introAudios,
      qmTracks: [],
      hasQM: false,
    },
  ];
  for (const v of silentMindVolets) {
    if (v.id === 'intro') continue;
    const qm = v.qmTracks ?? [];
    stages.push({
      id: v.id as StageId,
      zone: v.tagline ?? v.subtitle ?? v.title,
      description: v.description,
      smTracks: v.tracks,
      qmTracks: qm,
      hasQM: qm.some(t => !t.comingSoon),
    });
  }
  return stages;
}

type Row = { sm: AudioTrack | null; qm: AudioTrack | null };

function buildRows(stage: StageDef): Row[] {
  const used = new Set<string>();
  const rows: Row[] = [];
  for (const sm of stage.smTracks) {
    const pairedQm = stage.qmTracks.find(
      qm => QM_TO_SM_PAIRING[qm.id] === sm.id,
    );
    if (pairedQm) used.add(pairedQm.id);
    rows.push({ sm, qm: pairedQm ?? null });
  }
  for (const qm of stage.qmTracks) {
    if (!used.has(qm.id)) rows.push({ sm: null, qm });
  }
  return rows;
}

function pastilleState(
  t: AudioTrack | null,
  listened: Record<string, true>,
): PastilleState {
  if (!t) return 'locked';
  if (t.comingSoon) return 'soon';
  if (!isTrackUnlocked(t.id, listened)) return 'locked';
  if (listened[t.id]) return 'done';
  return 'available';
}

function stageReachable(
  stage: StageDef,
  listened: Record<string, true>,
): boolean {
  // Reachable = at least one pastille is available, done, or soon-but-
  // technically-unlocked. We use the same rule as the existing isTrackUnlocked
  // chain: the first SM track of every Part is unlocked from the start once
  // the prerequisites are met.
  return stage.smTracks.some(t => !t.comingSoon && isTrackUnlocked(t.id, listened))
    || stage.qmTracks.some(t => !t.comingSoon && isTrackUnlocked(t.id, listened));
}

export default function SilentMindTreeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const listened = useProgress(s => s.listened);
  const openPlayer = usePlayerStore(s => s.open);
  const scrollRef = useRef<ScrollView>(null);

  const stages = useMemo(() => buildStages(), []);
  // Display order top → bottom of scroll: Space first, Introduction last.
  // Climbing means swiping the screen up (= scrolling up to earlier index).
  const displayed = useMemo(() => [...stages].reverse(), [stages]);

  const pageH = winH;

  const [activeIdx, setActiveIdx] = useState(displayed.length - 1); // intro by default

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

  // Per-lane playlist for `openPlayer` — tapping a SM pastille walks
  // through the stage's playable SM tracks; same for QM.
  const playTrack = (stage: StageDef, lane: Lane, t: AudioTrack) => {
    if (t.comingSoon) return;
    if (!isTrackUnlocked(t.id, listened)) return;
    const playlist = (lane === 'sm' ? stage.smTracks : stage.qmTracks)
      .filter(x => !x.comingSoon);
    openPlayer(t, playlist, { autoStart: true });
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
          const prev = displayed[i - 1]; // page above (more advanced stage)
          const next = displayed[i + 1]; // page below (earlier stage)
          const fromShape: 'single' | 'branched' = stage.hasQM ? 'branched' : 'single';
          const aboveShape: 'single' | 'branched' | undefined =
            prev ? (prev.hasQM ? 'branched' : 'single') : undefined;
          const belowShape: 'single' | 'branched' | undefined =
            next ? (next.hasQM ? 'branched' : 'single') : undefined;
          const rows = buildRows(stage);

          return (
            <View
              key={stage.id}
              style={[
                styles.page,
                { height: pageH, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 },
              ]}
            >
              <View style={styles.hintTop}>
                {aboveShape ? (
                  <PageConnector edge="top" from={aboveShape} to={fromShape} />
                ) : (
                  <View style={{ height: HINT_H }} />
                )}
              </View>

              <View style={styles.centerStage}>
                <Text style={styles.zoneLabel}>{stage.zone}</Text>

                {/* Stages with no QM lane render a single centred
                    column (Intro, Part 3 today). Stages with QM keep
                    SM on the left, QM on the right at the same X as
                    the connector lanes. */}
                <View style={stage.hasQM ? styles.rowList : styles.rowListSingle}>
                  {rows.map((row, ri) => (
                    <View
                      key={ri}
                      style={stage.hasQM ? styles.row : styles.rowSingle}
                    >
                      {stage.hasQM ? (
                        <>
                          <View style={styles.lane}>
                            {row.sm ? (
                              <Pastille
                                track={row.sm}
                                accent={colors.accent}
                                state={pastilleState(row.sm, listened)}
                                onPress={() => playTrack(stage, 'sm', row.sm!)}
                              />
                            ) : (
                              <View style={{ width: PASTILLE_W, height: 1 }} />
                            )}
                          </View>
                          <View style={{ width: PASTILLE_GAP }} />
                          <View style={styles.lane}>
                            {row.qm ? (
                              <Pastille
                                track={row.qm}
                                accent={colors.accentAlt}
                                state={pastilleState(row.qm, listened)}
                                onPress={() => playTrack(stage, 'qm', row.qm!)}
                              />
                            ) : (
                              <View style={{ width: PASTILLE_W, height: 1 }} />
                            )}
                          </View>
                        </>
                      ) : (
                        row.sm ? (
                          <Pastille
                            track={row.sm}
                            accent={colors.accent}
                            state={pastilleState(row.sm, listened)}
                            onPress={() => playTrack(stage, 'sm', row.sm!)}
                          />
                        ) : null
                      )}
                    </View>
                  ))}
                </View>
              </View>

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

      <View
        pointerEvents="box-none"
        style={[styles.rail, { top: insets.top + 80, bottom: insets.bottom + 80 }]}
      >
        {displayed.map((s, i) => {
          const reachable = stageReachable(s, listened);
          const active = i === activeIdx;
          return (
            <Pressable
              key={s.id}
              onPress={() => scrollRef.current?.scrollTo({ y: i * pageH, animated: true })}
              hitSlop={8}
              style={[
                styles.railDot,
                !reachable && styles.railDotLocked,
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

function Pastille({
  track,
  accent,
  state,
  onPress,
}: {
  track: AudioTrack;
  accent: string;
  state: PastilleState;
  onPress: () => void;
}) {
  const locked = state === 'locked';
  const done = state === 'done';
  const soon = state === 'soon';
  const dimmed = locked || soon;
  const duration = trackDuration(track);

  return (
    <Pressable
      onPress={onPress}
      disabled={dimmed}
      hitSlop={4}
      style={({ pressed }) => [
        styles.pastille,
        {
          width: PASTILLE_W,
          borderColor: dimmed ? 'rgba(255,255,255,0.10)' : accent,
          backgroundColor: dimmed
            ? 'rgba(255,255,255,0.025)'
            : done
              ? 'rgba(255,255,255,0.04)'
              : `${accent}1F`,
        },
        pressed && !dimmed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.pastilleHead}>
        <View
          style={[
            styles.pastilleBullet,
            {
              backgroundColor: dimmed ? 'transparent' : accent,
              borderColor: dimmed ? 'rgba(255,255,255,0.30)' : accent,
            },
          ]}
        />
        <Text
          style={[
            styles.pastilleTitle,
            { color: dimmed ? colors.textDim : colors.text },
          ]}
          numberOfLines={2}
        >
          {track.title}
        </Text>
      </View>
      <View style={styles.pastilleFoot}>
        <Text
          style={[
            styles.pastilleMeta,
            { color: dimmed ? colors.textDim : colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {soon ? 'SOON' : locked ? 'LOCKED' : (duration ?? '')}
        </Text>
        {done ? (
          <Text style={[styles.pastilleCheck, { color: accent }]}>✓</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

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
  const incoming = edge === 'top' ? to : from;
  const outgoing = edge === 'top' ? from : to;
  const yClose = edge === 'top' ? h : 0;
  const yFar = edge === 'top' ? 0 : h;

  let d = '';
  if (incoming === 'single' && outgoing === 'single') {
    d = `M ${c} ${yFar} L ${c} ${yClose}`;
  } else if (incoming === 'single' && outgoing === 'branched') {
    const yMid = (yFar + yClose) / 2;
    d = `M ${c} ${yClose} L ${c} ${yMid}
         M ${c} ${yMid} C ${c} ${(yMid + yFar) / 2}, ${sm} ${(yMid + yFar) / 2}, ${sm} ${yFar}
         M ${c} ${yMid} C ${c} ${(yMid + yFar) / 2}, ${qm} ${(yMid + yFar) / 2}, ${qm} ${yFar}`;
  } else if (incoming === 'branched' && outgoing === 'branched') {
    d = `M ${sm} ${yFar} L ${sm} ${yClose}
         M ${qm} ${yFar} L ${qm} ${yClose}`;
  } else {
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
    paddingHorizontal: spacing.md,
  },
  zoneLabel: {
    ...typo.display,
    color: colors.text,
    fontSize: 22,
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  rowList: {
    width: TREE_W,
    gap: spacing.sm,
  },
  rowListSingle: {
    width: PASTILLE_W,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rowSingle: {
    width: PASTILLE_W,
  },
  lane: {
    width: PASTILLE_W,
  },
  pastille: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    minHeight: 56,
    justifyContent: 'space-between',
  },
  pastilleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pastilleBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  pastilleTitle: {
    ...typo.h3,
    fontSize: 12,
    lineHeight: 15,
    flex: 1,
  },
  pastilleFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingLeft: 16, // align with title (bullet + gap)
  },
  pastilleMeta: {
    ...typo.caption,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  pastilleCheck: {
    fontSize: 11,
    fontWeight: '700',
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
