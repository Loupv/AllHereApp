import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProgress } from '../src/player/progressStore';
import { useAuth, type User } from '../src/auth/authStore';
import { silentMindVolets } from '../src/content/catalog';
import { fetchStats, type AccountStats } from '../src/analytics/stats';
import { flush } from '../src/analytics/events';
import { fetchMe, fetchSessions, type LmtSession, type SessionParticipant } from '../src/analytics/sessions';
import { MiniLineChart } from '../src/components/MiniLineChart';
import { colors, radius, spacing, type } from '../src/theme';

const PANES = ['Profile', 'Silent Mind Practice', 'Live Tracker', 'Quantified Meditation Reports'] as const;
// Tab indices (kept in sync with PANES) — referenced for swipe spill + the
// pager/gesture guards on the Live Tracker tab.
const TAB = { profile: 0, sm: 1, live: 2, qm: 3 } as const;

const CHART_H = 130; // taller charts — more room for the curve detail

// Per-pane identity colour — amber (Profile), magenta (Silent Mind), indigo
// (Live Tracker), teal (QM reports). Each tints its pane bg + active tab rail.
const PANE_THEME = [
  { accent: '#C2913F', tint: 'rgba(194,145,63,0.22)' },
  { accent: colors.accent, tint: 'rgba(158,54,148,0.22)' },
  { accent: '#5A6BD8', tint: 'rgba(90,107,216,0.22)' },
  { accent: colors.accentAlt, tint: 'rgba(54,160,158,0.22)' },
] as const;

/** Friendly display name derived from the email local part (we don't store a
 *  real name): "loup.vuarnesson@…" → "Loup Vuarnesson". */
const displayName = (email: string | null): string => {
  if (!email) return 'Guest';
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || email;
};

const fmtTime = (s: number): string => {
  const sec = Math.round(s);
  if (sec < 3600) return `${Math.floor(sec / 60)}min ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}min`;
};

const fmtScore = (v: number | null): string => (v == null ? '—' : v.toFixed(1));

const fmtSessionDate = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// LMT protocol JSON shape (see LiveMeditationTracker summary/+page.svelte):
//   { steps: [{ kind: 'round' | 'break', durationSec, roundIdx }, …] }
type PlanStep = { kind: 'round' | 'break'; durationSec: number | null; roundIdx: number };

const parseSteps = (protocol: string | null): PlanStep[] | null => {
  if (!protocol) return null;
  try {
    const p = JSON.parse(protocol) as { steps?: PlanStep[] };
    return Array.isArray(p.steps) ? p.steps : null;
  } catch {
    return null;
  }
};

const sessionTypeLabel = (s: LmtSession): string => {
  const steps = parseSteps(s.protocol);
  const rounds = steps?.filter(st => st.kind === 'round') ?? [];
  if (rounds.length) {
    const sec = rounds[0].durationSec;
    return sec ? `${rounds.length} × ${Math.round(sec / 60)} min` : `${rounds.length} rounds`;
  }
  const dur = s.participants[0]?.duration_ms;
  if (dur) return `${Math.round(dur / 60000)} min`;
  return s.mode ?? 'Session';
};

/** mm:ss clock for the chart time axis. */
const fmtClock = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);

  const navigation = useNavigation();
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);
  const resetProgress = useProgress(s => s.resetProgress);
  const listened = useProgress(s => s.listened);

  const [stats, setStats] = useState<AccountStats | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LmtSession[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // True while a session report is open in Live Tracker — disables the tab
  // pager's own swipe there so the in-report session swipe owns the gesture.
  const [reportOpen, setReportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Pull the account data. Flushes queued listen events first so the just-
  // played audio is counted server-side before we read /v1/stats (otherwise
  // the seconds counter lags a buffer cycle). Also the pull-to-refresh path.
  const cacheKey = user ? `ah_lmt_${user.userId}` : null;

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    try {
      await flush();
      const [s, m, sess] = await Promise.all([fetchStats(), fetchMe(), fetchSessions()]);
      if (!mounted.current) return;
      if (s) setStats(s);
      if (m) setPairCode(m.pair_code ?? null);
      if (sess) {
        setSessions(sess);
        // Cache sessions + pairing code so they're available offline.
        void AsyncStorage.setItem(`ah_lmt_${user.userId}`, JSON.stringify({ sessions: sess, pairCode: m?.pair_code ?? null }));
      }
    } finally {
      if (mounted.current && isRefresh) setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { void load(false); }, [load]);

  // Hydrate sessions + pairing code from the offline cache first (kept even
  // when the network read fails), so they show without a connection.
  useEffect(() => {
    if (!cacheKey) return;
    let on = true;
    AsyncStorage.getItem(cacheKey)
      .then(raw => {
        if (!on || !raw) return;
        const c = JSON.parse(raw) as { sessions: LmtSession[]; pairCode: string | null };
        setSessions(prev => (prev == null ? c.sessions : prev));
        setPairCode(prev => (prev == null ? c.pairCode : prev));
      })
      .catch(() => { /* no/corrupt cache — network will fill in */ });
    return () => { on = false; };
  }, [cacheKey]);

  // Disable the screen's native swipe-back while a session report is open on
  // Live Tracker — otherwise the full-screen back gesture eats the horizontal
  // swipe meant to move between sessions.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !(reportOpen && active === TAB.live) });
  }, [navigation, reportOpen, active]);

  const goTo = (idx: number) => {
    setActive(idx);
    // Defer to the next frame: when this is triggered from a Pressable that
    // lives inside a pane's (vertical) ScrollView — e.g. tapping a session
    // row — calling scrollTo synchronously inside the touch gesture gets
    // swallowed by the horizontal pager, so only the tab highlight moved.
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: idx * width, animated: true }));
  };
  const onPaged = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== active) setActive(idx);
  };

  return (
    <View style={styles.root}>
      {/* Slim header — identity moved into the Profile tab to free space */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      {/* Tab nav */}
      <View style={styles.segments}>
        {PANES.map((label, i) => (
          <Pressable key={label} onPress={() => goTo(i)} style={styles.segment} hitSlop={6}>
            <Text style={[styles.segmentLabel, active === i && styles.segmentLabelActive]} numberOfLines={2}>
              {label}
            </Text>
            <View style={[styles.segmentRail, active === i && { backgroundColor: PANE_THEME[i].accent }]} />
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={!(reportOpen && active === TAB.live)}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPaged}
        style={styles.pager}
      >
        {/* ── Profile ─────────────────────────────────────────── */}
        <Pane width={width} tint={PANE_THEME[TAB.profile].tint}>
          <ProfilePane user={user} pairCode={pairCode} accent={PANE_THEME[TAB.profile].accent} />
        </Pane>

        {/* ── Silent Mind Practice ─────────────────────────────── */}
        <Pane width={width} tint={PANE_THEME[TAB.sm].tint}>
          <SmProgramPane
            listened={listened}
            stats={stats}
            confirmReset={confirmReset}
            onReset={() => {
              if (confirmReset) { resetProgress(); setConfirmReset(false); }
              else setConfirmReset(true);
            }}
          />
        </Pane>

        {/* ── Live Tracker ─────────────────────────────────────── */}
        <Pane width={width} tint={PANE_THEME[TAB.live].tint} refreshing={refreshing} onRefresh={() => void load(true)}>
          <LiveTrackerPane
            user={!!user}
            sessions={sessions}
            chartWidth={width - spacing.lg * 2}
            onReportOpen={setReportOpen}
            onSpillLeft={() => goTo(TAB.live - 1)}
            onSpillRight={() => goTo(TAB.live + 1)}
          />
        </Pane>

        {/* ── Quantified Meditation Reports (future) ───────────── */}
        <Pane width={width} tint={PANE_THEME[TAB.qm].tint}>
          <View style={styles.soonWrap}>
            <Text style={styles.soonBadge}>Soon</Text>
            <Text style={styles.caption}>Quantified Meditation reports are on the way.</Text>
          </View>
        </Pane>
      </ScrollView>

      {/* ── Footer · log out only (stats + reset live in the SM pane) ── */}
      {user && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable onPress={() => { logout(); router.back(); }} hitSlop={8} style={styles.logoutBtn}>
            <Text style={styles.footerLink}>Log out</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Full-width swipe pane: a soft top-down colour wash over the dark base, with
// the scrollable content on top.
function Pane({
  width, tint, children, refreshing, onRefresh,
}: {
  width: number; tint: string; children: ReactNode;
  refreshing?: boolean; onRefresh?: () => void;
}) {
  return (
    <View style={{ width }}>
      <LinearGradient colors={[tint, 'transparent']} style={styles.paneGradient} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={styles.paneContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh
            ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.text}
                colors={[colors.text]}
                progressBackgroundColor={colors.bgSoft}
              />
            )
            : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

// ── Pane 1 ────────────────────────────────────────────────────────────────
function SmProgramPane({
  listened, stats, confirmReset, onReset,
}: {
  listened: Record<string, true>;
  stats: AccountStats | null;
  confirmReset: boolean;
  onReset: () => void;
}) {
  // Total counts the FULL planned program, including not-yet-released
  // (coming-soon) audios — so the percentage reflects progress toward the
  // whole journey, not just what's currently downloadable.
  const parts = silentMindVolets
    .map(v => {
      const tracks = [...v.tracks, ...(v.qmTracks ?? [])];
      const done = tracks.filter(t => listened[t.id]).length;
      return { id: v.id, title: v.title || 'Introduction', done, total: tracks.length };
    })
    .filter(p => p.total > 0);
  const done = parts.reduce((a, p) => a + p.done, 0);
  const total = parts.reduce((a, p) => a + p.total, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <View>
      <Text style={styles.bigStat}>{pct}<Text style={styles.bigStatDim}>%</Text></Text>
      <Text style={styles.caption}>of the Silent Mind program completed ({done} / {total} audios)</Text>
      <View style={styles.list}>
        {parts.map(p => (
          <View key={p.id} style={styles.listRow}>
            <Text style={styles.rowTitle}>{p.title}</Text>
            <Text style={styles.rowMeta}>{p.done} / {p.total}</Text>
          </View>
        ))}
      </View>

      {stats && (
        <View style={styles.statsBlock}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <Text style={styles.statText}>{stats.listens} listens · {fmtTime(stats.seconds)} listened</Text>
          <Text style={styles.statText}>{stats.qmRounds} QM rounds · {stats.streakDays}-day streak</Text>
        </View>
      )}

      <Pressable onPress={onReset} hitSlop={8} style={styles.resetBtn}>
        <Text style={[styles.footerLink, confirmReset && styles.footerLinkDanger]}>
          {confirmReset ? 'Tap again to reset progress' : 'Reset progress'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Pane 2 ────────────────────────────────────────────────────────────────
function LiveTrackerPane({
  user, sessions, chartWidth, onReportOpen, onSpillLeft, onSpillRight,
}: {
  user: boolean;
  sessions: LmtSession[] | null;
  chartWidth: number;
  onReportOpen: (open: boolean) => void;
  onSpillLeft: () => void;
  onSpillRight: () => void;
}) {
  // Tapping a session opens its report in place (no tab change); back returns
  // to the list.
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { onReportOpen(!!openId); }, [openId, onReportOpen]);
  // Slide the report content when moving between sessions, so the change
  // reads clearly even when two sessions look alike.
  const slide = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value }] }));
  if (!user) return <Text style={styles.empty}>Sign in to connect the Live Meditation Tracker.</Text>;

  const list = sessions ?? [];
  const open = openId ? list.find(s => s.id === openId) ?? null : null;
  if (open) {
    const idx = list.findIndex(s => s.id === open.id);
    const prev = idx > 0 ? list[idx - 1] : null;                 // newer
    const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null; // older

    // Move to another session with a slide: the incoming report starts off
    // to the side (dir = +1 enters from the right, -1 from the left) and
    // eases to centre.
    const go = (id: string, dir: number) => {
      slide.value = dir * chartWidth;
      slide.value = withTiming(0, { duration: 240 });
      setOpenId(id);
    };

    // Horizontal swipe steps between sessions; at the ends it spills over to
    // the neighbouring tab (left → Silent Mind, right → QM Reports).
    const SWIPE = 48;
    const onSwipeEnd = (tx: number, vx: number) => {
      if (tx <= -SWIPE || vx <= -600) {        // swipe left → older / next tab
        if (next) go(next.id, 1);
        else { setOpenId(null); onSpillRight(); }   // spill to the tab on the right
      } else if (tx >= SWIPE || vx >= 600) {   // swipe right → newer / prev tab
        if (prev) go(prev.id, -1);
        else { setOpenId(null); onSpillLeft(); }    // spill to the tab on the left
      }
    };
    const swipe = Gesture.Pan()
      .activeOffsetX([-20, 20])
      .failOffsetY([-16, 16])
      .onEnd(e => runOnJS(onSwipeEnd)(e.translationX, e.velocityX));

    return (
      <GestureDetector gesture={swipe}>
        <View>
          {/* Back to the list (left) + step between sessions (top-right) */}
          <View style={styles.reportTop}>
            <Pressable onPress={() => setOpenId(null)} hitSlop={8}>
              <Text style={styles.navLink}>‹ Sessions</Text>
            </Pressable>
            <View style={styles.navStep}>
              <Pressable onPress={() => prev && go(prev.id, -1)} disabled={!prev} hitSlop={8}>
                <Text style={[styles.navLink, !prev && styles.navDisabled]}>‹ Prev</Text>
              </Pressable>
              <Pressable onPress={() => next && go(next.id, 1)} disabled={!next} hitSlop={8}>
                <Text style={[styles.navLink, !next && styles.navDisabled]}>Next ›</Text>
              </Pressable>
            </View>
          </View>
          <Animated.View style={slideStyle}>
            <SessionReport session={open} chartWidth={chartWidth} />
          </Animated.View>
        </View>
      </GestureDetector>
    );
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>Available sessions</Text>
      {sessions == null ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : sessions.length === 0 ? (
        <Text style={styles.empty}>No sessions yet. They show up after you run one in the tracker.</Text>
      ) : (
        <View style={styles.list}>
          {sessions.map(s => (
            <Pressable
              key={s.id}
              onPress={() => setOpenId(s.id)}
              style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{sessionTypeLabel(s)}</Text>
                <Text style={styles.rowMeta}>{fmtSessionDate(s.started_at)}</Text>
              </View>
              <Text style={styles.rowScore}>QM3 {fmtScore(s.participants[0]?.qm3_index ?? null)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────
// Identity + LMT pairing code. Lives in its own tab so the header and the
// other panes stay uncluttered.
function ProfilePane({ user, pairCode, accent }: { user: User | null; pairCode: string | null; accent: string }) {
  return (
    <View>
      <View style={styles.profileTop}>
        <LinearGradient
          colors={[colors.accent, colors.accentAlt]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarInitial}>{displayName(user?.email ?? null).charAt(0)}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{displayName(user?.email ?? null)}</Text>
          <Text style={styles.identityEmail} numberOfLines={1}>{user?.email ?? 'Not signed in'}</Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, styles.codeHead]}>Pairing code</Text>
      <View style={[styles.codeBox, { borderColor: accent }]}>
        <Text style={styles.code} selectable>{pairCode ?? '…'}</Text>
      </View>
      <Text style={styles.codeHint}>
        Paste this in the Live Meditation Tracker → Settings → AllHere sync to link your sessions.
      </Text>
    </View>
  );
}

// A single session's report: title + per-participant scores & charts. Shown
// inline inside the Live Tracker pane when a session is tapped.
function SessionReport({ session, chartWidth }: { session: LmtSession; chartWidth: number }) {
  const steps = useMemo(() => parseSteps(session.protocol), [session.protocol]);
  return (
    <View>
      <Text style={styles.reportTitle}>{sessionTypeLabel(session)}</Text>
      <Text style={styles.caption}>{fmtSessionDate(session.started_at)}{session.mode ? ` · ${session.mode}` : ''}</Text>
      {session.participants.map(p => (
        <ParticipantReport
          key={p.participant}
          p={p}
          steps={steps}
          chartWidth={chartWidth}
          showName={session.participants.length > 1}
        />
      ))}
    </View>
  );
}

const seriesRange = (xs: (number | null)[]): { min: number; max: number } | null => {
  const v = xs.filter((n): n is number => n != null && Number.isFinite(n));
  return v.length ? { min: Math.min(...v), max: Math.max(...v) } : null;
};

const fmtPct1 = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const fmtAlpha = (v: number | null): string => (v == null ? '—' : `${v.toFixed(1)}%`);

// Map a time (s) to its round number, or -1 for breaks / out-of-plan. With no
// protocol, everything is one round (id 1) — no transitions, so no gaps.
const roundSegmenter = (steps: PlanStep[] | null): ((t: number) => number) => {
  if (!steps || steps.length === 0) return () => 1;
  const ranges: { lo: number; hi: number; seg: number }[] = [];
  let cum = 0;
  for (const st of steps) {
    const d = st.durationSec ?? 0;
    ranges.push({ lo: cum, hi: cum + d, seg: st.kind === 'round' ? st.roundIdx : -1 });
    cum += d;
  }
  return (t: number) => {
    for (const r of ranges) if (t >= r.lo && t < r.hi) return r.seg;
    return ranges[ranges.length - 1].seg; // past the end → last segment
  };
};

function ParticipantReport({
  p, steps, chartWidth, showName,
}: {
  p: SessionParticipant;
  steps: PlanStep[] | null;
  chartWidth: number;
  showName: boolean;
}) {
  // Cut the curve between rounds: drop break samples and insert a single null
  // slot at each round → round transition, so the line breaks with a tiny
  // (one-sample, few-px) gap that shows the background. Works whether or not
  // the source curve has samples during the breaks.
  const { index, alpha, times, roundCenters } = useMemo(() => {
    const segAt = roundSegmenter(steps);
    const idx: (number | null)[] = [];
    const alp: (number | null)[] = [];
    const ts: (number | null)[] = [];
    const spans = new Map<number, [number, number]>();
    let prevSeg: number | null = null;
    for (const c of p.curve) {
      const seg = segAt(c.t);
      if (seg === -1) continue;              // drop break samples
      if (prevSeg !== null && seg !== prevSeg) { idx.push(null); alp.push(null); ts.push(null); }
      const oi = idx.length;
      idx.push(c.index); alp.push(c.alpha); ts.push(c.t);
      const sp = spans.get(seg);
      if (sp) sp[1] = oi; else spans.set(seg, [oi, oi]);
      prevSeg = seg;
    }
    const len = idx.length || 1;
    const centers = [...spans.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, [s, e]]) => ({ frac: ((s + e) / 2) / (len - 1 || 1), label: `R${id}` }));
    return { index: idx, alpha: alp, times: ts, roundCenters: centers };
  }, [p.curve, steps]);
  const n = index.length;
  const hasCurve = n > 1;

  // Windowed zoom/pan: only the visible slice renders horizontally. The Y
  // scale stays FIXED to the whole-session range — pinch/drag drive both
  // charts at once, no nested ScrollView fighting the pager.
  const MIN_SAMPLES = 12;
  const maxZoom = Math.max(1, Math.floor(n / MIN_SAMPLES));
  const [zoom, setZoom] = useState(1);
  const [centerFrac, setCenterFrac] = useState(0.5);
  const baseZoom = useRef(1);
  const baseCenter = useRef(0.5);
  const setZoomClamped = (z: number) => setZoom(Math.max(1, Math.min(maxZoom, z)));

  const count = Math.min(n, Math.max(Math.min(MIN_SAMPLES, n), Math.round(n / zoom)));
  const start = Math.max(0, Math.min(n - count, Math.round(centerFrac * (n - 1) - count / 2)));
  const end = Math.min(n, start + count); // exclusive
  const idxSlice = index.slice(start, end);
  const alphaSlice = alpha.slice(start, end);

  // Y range over the WHOLE session (fixed vertical scale + stable labels).
  const iR = seriesRange(index);
  const aR = seriesRange(alpha);
  const aMin = aR ? Math.min(aR.min, 0) : 0; // include 0 so the baseline shows

  const winTimes = times.slice(start, end).filter((t): t is number => t != null);
  const tStart = winTimes.length ? winTimes[0] : 0;
  const tEnd = winTimes.length ? winTimes[winTimes.length - 1] : 0;
  // Map round-centre labels into the visible window.
  const denom = n - 1 || 1;
  const g0 = start / denom;
  const g1 = (end - 1) / denom;
  const gSpan = g1 - g0 || 1;
  const localMarkers = roundCenters
    .map(m => ({ frac: (m.frac - g0) / gSpan, label: m.label }))
    .filter(m => m.frac >= 0 && m.frac <= 1);
  const showRounds = roundCenters.length > 1; // only label rounds when there's > 1

  const pinchBegin = () => { baseZoom.current = zoom; };
  const pinchMove = (scale: number) => setZoomClamped(baseZoom.current * scale);
  const panBegin = () => { baseCenter.current = centerFrac; };
  const panMove = (tx: number) => {
    const dSamples = (-tx / chartWidth) * count;
    setCenterFrac(Math.max(0, Math.min(1, (baseCenter.current * denom + dSamples) / denom)));
  };
  const pinch = Gesture.Pinch()
    .onBegin(() => runOnJS(pinchBegin)())
    .onUpdate(e => runOnJS(pinchMove)(e.scale));
  const pan = Gesture.Pan()
    .enabled(count < n)
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onBegin(() => runOnJS(panBegin)())
    .onUpdate(e => runOnJS(panMove)(e.translationX));
  const gesture = Gesture.Race(pinch, pan);

  return (
    <View style={styles.participant}>
      {showName && <Text style={styles.rowTitle}>{p.participant}</Text>}

      <View style={styles.scores}>
        <View style={styles.scoreGroup}>
          <Text style={styles.scoreGroupLabel}>QM3</Text>
          <View style={styles.scoreRow}>
            <Score label="Index" value={fmtScore(p.qm3_index)} />
            <Score label="Alpha +" value={fmtAlpha(p.qm3_alpha_pos)} />
            <Score label="Alpha −" value={fmtAlpha(p.qm3_alpha_neg)} />
          </View>
        </View>
        <View style={styles.scoreGroup}>
          <Text style={styles.scoreGroupLabel}>Session mean</Text>
          <View style={styles.scoreRow}>
            <Score label="Index" value={fmtScore(p.mean_index)} />
            <Score label="Alpha" value={fmtAlpha(p.mean_alpha)} />
          </View>
        </View>
      </View>

      {/* One gesture surface over BOTH charts — pinch zoom / drag pan apply
          to the index + alpha pair together. */}
      {hasCurve && (
        <GestureDetector gesture={gesture}>
          <View style={styles.combo}>
            {showRounds && (
              <View style={styles.roundLabelsRow}>
                <View style={styles.yAxisSpacer} />
                <View style={styles.roundLabelsFill}>
                  {localMarkers.map((m, i) => (
                    <Text key={i} style={[styles.roundLabel, { left: `${m.frac * 100}%` }]}>{m.label}</Text>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.chartLabel}>Index</Text>
            <View style={styles.chartRow}>
              <View style={styles.yAxis}>
                <Text style={styles.axisVal}>{iR ? iR.max.toFixed(0) : ''}</Text>
                <Text style={styles.axisVal}>0</Text>
              </View>
              <View style={styles.chartFill}>
                <MiniLineChart data={idxSlice} color={colors.accentAlt} height={CHART_H} min={0} max={iR?.max} />
              </View>
            </View>

            <Text style={styles.chartLabelTight}>Alpha</Text>
            <View style={styles.chartRow}>
              <View style={styles.yAxis}>
                <Text style={styles.axisVal}>+400%</Text>
                <Text style={styles.axisValMid}>baseline</Text>
                <Text style={styles.axisVal}>{fmtPct1(aMin)}</Text>
              </View>
              <View style={styles.chartFill}>
                <MiniLineChart data={alphaSlice} color={colors.accent} height={CHART_H} min={aMin} max={400} pivot={0} baseline={0} />
              </View>
            </View>

            <View style={styles.axisRowWrap}>
              <TimeAxis tStart={tStart} tEnd={tEnd} />
            </View>
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

// Time scale beneath the charts: evenly-spaced mm:ss ticks (flex row).
function TimeAxis({ tStart, tEnd }: { tStart: number; tEnd: number }) {
  const span = tEnd - tStart;
  if (span <= 0) return null;
  const N = 4;
  const ticks = Array.from({ length: N + 1 }, (_, i) => tStart + (i / N) * span);
  return (
    <View style={styles.axisTicksOnly}>
      {ticks.map((t, i) => (
        <Text key={`t${i}`} style={styles.axisTime}>{fmtClock(t)}</Text>
      ))}
    </View>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.score}>
      <Text style={styles.scoreValue}>{value}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { ...type.h2, color: '#FFFFFF', fontSize: 20 },
  name: { ...type.h2, color: colors.text, fontSize: 18 },
  identityEmail: { ...type.caption, color: colors.textDim, fontSize: 12, marginTop: 1 },
  close: { ...type.caption, color: colors.textDim, textDecorationLine: 'underline' },

  segments: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginTop: spacing.md },
  segment: { flex: 1, alignItems: 'center' },
  segmentLabel: { ...type.caption, color: colors.textDim, fontSize: 11, textAlign: 'center', minHeight: 30 },
  segmentLabelActive: { color: colors.text },
  segmentRail: { height: 2, alignSelf: 'stretch', backgroundColor: 'transparent', marginTop: spacing.xs, borderRadius: 1 },
  segmentRailActive: { backgroundColor: colors.accent },

  pager: { flex: 1 },
  paneGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 340 },
  paneContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },

  bigStat: { ...type.h2, color: colors.text, fontSize: 40 },
  bigStatDim: { color: colors.textDim },
  caption: { ...type.caption, color: colors.textDim, marginTop: 2 },
  sectionLabel: { ...type.sectionLabel, color: colors.textDim, marginBottom: spacing.xs },

  list: { marginTop: spacing.md, gap: 0 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.09)',
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rowTitle: { ...type.body, color: colors.text, fontSize: 15 },
  rowMeta: { ...type.caption, color: colors.textDim, fontSize: 12, marginTop: 2 },
  rowScore: { ...type.body, color: colors.text },

  empty: { ...type.body, color: colors.textDim, marginTop: spacing.md },

  codeHead: { marginTop: spacing.xl },
  codeBox: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md, marginBottom: spacing.xs,
  },
  code: { ...type.h3, color: colors.text, letterSpacing: 3, fontSize: 16 },
  codeHint: { ...type.caption, color: colors.textDim, fontSize: 11 },

  reportTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  navLink: { ...type.caption, color: colors.text, fontSize: 13 },
  navDisabled: { color: colors.textDim, opacity: 0.4 },

  soonWrap: { paddingTop: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  soonBadge: { ...type.overline, color: colors.textDim },

  combo: { marginTop: spacing.md },
  roundLabelsRow: { flexDirection: 'row', height: 16, marginBottom: 2 },
  yAxisSpacer: { width: 48 },
  roundLabelsFill: { flex: 1 },
  roundLabel: { position: 'absolute', top: 0, marginLeft: -8, ...type.overline, color: colors.textDim, fontSize: 10, letterSpacing: 1 },

  chartLabel: { ...type.sectionLabel, color: colors.textDim, marginBottom: spacing.xs },
  chartLabelTight: { ...type.sectionLabel, color: colors.textDim, marginTop: spacing.sm, marginBottom: spacing.xs },
  chartRow: { flexDirection: 'row', alignItems: 'stretch' },
  yAxis: { width: 48, height: CHART_H, justifyContent: 'space-between', paddingRight: spacing.xs },
  axisVal: { ...type.caption, color: colors.textDim, fontSize: 10, textAlign: 'right' },
  axisValMid: { ...type.caption, color: colors.textDim, fontSize: 9, textAlign: 'right' },
  chartFill: { flex: 1 },
  axisRowWrap: { paddingLeft: 48, marginTop: spacing.xs },
  axisTicksOnly: { flexDirection: 'row', justifyContent: 'space-between' },
  axisTime: { ...type.caption, color: colors.textDim, fontSize: 10 },

  reportTitle: { ...type.h2, color: colors.text, marginTop: spacing.xs },
  participant: { marginTop: spacing.md, gap: spacing.xs },
  scores: { marginTop: spacing.xs, gap: spacing.sm },
  scoreGroup: { gap: spacing.xs },
  scoreGroupLabel: { ...type.overline, color: colors.textDim, fontSize: 10 },
  scoreRow: { flexDirection: 'row', gap: spacing.xs },
  score: {
    minWidth: 60, flexGrow: 1, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.sm,
  },
  scoreValue: { ...type.h3, color: colors.text, fontSize: 15 },
  scoreLabel: { ...type.caption, color: colors.textDim, fontSize: 10, marginTop: 1 },

  footer: {
    backgroundColor: colors.bgDeep,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm,
  },
  statsBlock: { marginTop: spacing.xl, gap: 2 },
  statText: { ...type.caption, color: colors.textDim, fontSize: 12 },
  resetBtn: { marginTop: spacing.xl, alignSelf: 'flex-start' },
  logoutBtn: { alignSelf: 'center' },
  footerLink: { ...type.caption, color: colors.textDim, textDecorationLine: 'underline' },
  footerLinkDanger: { color: '#FF6B6B' },
});
