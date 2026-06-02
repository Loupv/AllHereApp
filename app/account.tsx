import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Alert, useWindowDimensions,
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
import { fetchMe, fetchSessions, deleteSession, starSession, type LmtSession, type SessionParticipant } from '../src/analytics/sessions';
import { MiniLineChart } from '../src/components/MiniLineChart';
import { colors, radius, spacing, type } from '../src/theme';

const PANES = ['Silent Mind Profile', 'Live Tracker', 'Quantified Meditation Reports'] as const;
// Tab indices (kept in sync with PANES) — referenced for swipe spill + the
// pager/gesture guards on the Live Tracker tab.
const TAB = { sm: 0, live: 1, qm: 2 } as const;

const CHART_H = 130; // taller charts — more room for the curve detail

// Vertical completion bar — mirrors the Silent Mind tree's journey hues
// (dawn gold → Earth green → Sky blue → Space purple), listed top→bottom so
// the fill reveals the journey from the bottom up.
const SM_BAR_H = 168;
const JOURNEY_HUES = ['#9B6FDD', '#3D6BBA', '#3D8E5E', '#C9A66B'] as const;

// Per-pane identity colour — magenta (Silent Mind Profile), indigo (Live
// Tracker), teal (QM reports). Each tints its pane bg + active tab rail.
const PANE_THEME = [
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

/** Grey (lowest) → green (highest) across [lo, hi] — only the strong scores
 *  light up green; low ones stay muted grey. */
const scoreColor = (v: number | null, lo: number, hi: number): string => {
  if (v == null) return colors.textDim;
  const t = hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 1;
  return `hsl(140, ${Math.round(t * 68)}%, ${Math.round(52 + t * 6)}%)`;
};

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
  const dur = s.participants[0]?.duration_ms;
  // A genuine rounds session (rounds mode, or a multi-round protocol).
  const isRounds = s.mode === 'rounds' || rounds.length > 1;
  if (isRounds && rounds.length) {
    const sec = rounds[0].durationSec;
    return sec ? `${rounds.length} × ${Math.round(sec / 60)} min` : `${rounds.length} rounds`;
  }
  // Infinite / intensity / guided → no fixed rounds; show the total time.
  return dur ? `Free format · ${fmtDuration(dur)}` : 'Free format';
};

/** Total duration as a clock (h:mm:ss / m:ss), seconds included, no "min". */
const fmtDuration = (ms: number): string => {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
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

  // No footer anymore (logout moved into Profile) — panes carry the bottom
  // safe-area padding themselves.
  const bottomPad = Math.max(insets.bottom, spacing.xl);

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
        {/* ── Silent Mind Profile ──────────────────────────────── */}
        <Pane width={width} tint={PANE_THEME[TAB.sm].tint} bottomPad={bottomPad}>
          <SilentMindProfilePane
            listened={listened}
            user={user}
            pairCode={pairCode}
            stats={stats}
            confirmReset={confirmReset}
            onReset={() => {
              if (confirmReset) { resetProgress(); setConfirmReset(false); }
              else setConfirmReset(true);
            }}
            onLogout={() => { logout(); router.back(); }}
          />
        </Pane>

        {/* ── Live Tracker ─────────────────────────────────────── */}
        <Pane width={width} tint={PANE_THEME[TAB.live].tint} bottomPad={bottomPad} refreshing={refreshing} onRefresh={() => void load(true)}>
          <LiveTrackerPane
            user={!!user}
            sessions={sessions}
            chartWidth={width - spacing.lg * 2}
            onReportOpen={setReportOpen}
            onReload={() => void load(false)}
            onSpillLeft={() => goTo(TAB.live - 1)}
            onSpillRight={() => goTo(TAB.live + 1)}
          />
        </Pane>

        {/* ── Quantified Meditation Reports (future) ───────────── */}
        <Pane width={width} tint={PANE_THEME[TAB.qm].tint} bottomPad={bottomPad}>
          <View style={styles.soonWrap}>
            <Text style={styles.soonBadge}>Soon</Text>
            <Text style={styles.caption}>Quantified Meditation reports are on the way.</Text>
          </View>
        </Pane>
      </ScrollView>
    </View>
  );
}

// Full-width swipe pane: a soft top-down colour wash over the dark base, with
// the scrollable content on top.
function Pane({
  width, tint, children, refreshing, onRefresh, bottomPad = 0,
}: {
  width: number; tint: string; children: ReactNode;
  refreshing?: boolean; onRefresh?: () => void; bottomPad?: number;
}) {
  return (
    <View style={{ width }}>
      <LinearGradient colors={[tint, 'transparent']} style={styles.paneGradient} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[styles.paneContent, { paddingBottom: bottomPad }]}
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

// ── Pane 1 · Silent Mind Profile ───────────────────────────────────────────
// One tab combining identity, program progress, activity stats, the Live
// Tracker pairing/connection, and account actions.
function SilentMindProfilePane({
  listened, user, pairCode, confirmReset, onReset, onLogout, stats,
}: {
  listened: Record<string, true>;
  user: User | null;
  pairCode: string | null;
  stats: AccountStats | null;
  confirmReset: boolean;
  onReset: () => void;
  onLogout: () => void;
}) {
  // Program completion counts the FULL planned program, including not-yet-
  // released (coming-soon) audios.
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
      <Text style={styles.profileName} numberOfLines={1}>{displayName(user?.email ?? null)}</Text>

      {/* Silent Mind program — on its own magenta-washed card */}
      <LinearGradient
        colors={['rgba(158,54,148,0.28)', 'rgba(158,54,148,0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.smCard}
      >
        <Text style={styles.smCardLabel}>Silent Mind program</Text>
        <View style={styles.smBody}>
          {/* Vertical completion bar — fills bottom-up through the journey hues */}
          <View style={styles.smBar}>
            <LinearGradient colors={JOURNEY_HUES} style={styles.smBarTrack} />
            <View style={[styles.smBarClip, { height: (SM_BAR_H * pct) / 100 }]}>
              <LinearGradient colors={JOURNEY_HUES} style={styles.smBarFill} />
            </View>
          </View>

          <View style={styles.smBodyMain}>
            <View style={styles.smPctRow}>
              <Text style={styles.bigStat}>{pct}<Text style={styles.bigStatDim}>%</Text></Text>
              <Text style={styles.smPctMeta}>{done} / {total} audios</Text>
            </View>
            <View style={styles.list}>
              {parts.map(p => (
                <View key={p.id} style={styles.smRow}>
                  <Text style={styles.rowTitle}>{p.title}</Text>
                  <Text style={styles.rowMeta}>{p.done} / {p.total}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </LinearGradient>

      {stats && (
        <View style={styles.profileSection}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <View style={styles.statTiles}>
            <StatTile value={String(stats.listens)} label="listens" />
            <StatTile value={fmtTime(stats.seconds)} label="listened" />
            <StatTile value={String(stats.qmRounds)} label="QM rounds" />
            <StatTile value={`${stats.streakDays}d`} label="streak" />
          </View>
        </View>
      )}

      <View style={styles.idSection}>
        <Text style={styles.sectionLabel}>All Here ID</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code} selectable>{pairCode ?? '…'}</Text>
        </View>
      </View>

      <View style={styles.profileActions}>
        <Pressable onPress={onReset} hitSlop={8}>
          <Text style={[styles.footerLink, confirmReset && styles.footerLinkDanger]}>
            {confirmReset ? 'Tap again to reset progress' : 'Reset progress'}
          </Text>
        </Pressable>
        {user && (
          <Pressable onPress={onLogout} hitSlop={8}>
            <Text style={styles.footerLink}>Log out</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Pane 2 ────────────────────────────────────────────────────────────────
function LiveTrackerPane({
  user, sessions, chartWidth, onReportOpen, onReload, onSpillLeft, onSpillRight,
}: {
  user: boolean;
  sessions: LmtSession[] | null;
  chartWidth: number;
  onReportOpen: (open: boolean) => void;
  onReload: () => void;
  onSpillLeft: () => void;
  onSpillRight: () => void;
}) {
  // Tapping a session opens its report in place (no tab change); back returns
  // to the list.
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { onReportOpen(!!openId); }, [openId, onReportOpen]);
  // Star state: optimistic local overrides + a "starred only" filter.
  const [starOverride, setStarOverride] = useState<Record<string, boolean>>({});
  const [starredOnly, setStarredOnly] = useState(false);
  const isStarred = (s: LmtSession) => starOverride[s.id] ?? !!s.starred;
  const toggleStar = (s: LmtSession) => {
    const next = !isStarred(s);
    setStarOverride(prev => ({ ...prev, [s.id]: next }));
    void starSession(s.id, next).then(ok => { if (ok) onReload(); });
  };
  // Slide the report content when moving between sessions, so the change
  // reads clearly even when two sessions look alike.
  const slide = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value }] }));

  // Permanently delete a session (used by the report's Delete link and a
  // long-press on a list row), behind a destructive confirm.
  const requestDelete = (id: string) => {
    Alert.alert(
      'Delete this session?',
      'This permanently removes the session and its data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setOpenId(null);
            void deleteSession(id).then(ok => {
              onReload();
              if (!ok) Alert.alert('Could not delete', 'Please try again when you’re online.');
            });
          },
        },
      ],
    );
  };

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
          <Pressable onPress={() => requestDelete(open.id)} hitSlop={8} style={styles.deleteBtn}>
            <Text style={styles.deleteLabel}>Delete session</Text>
          </Pressable>
        </View>
      </GestureDetector>
    );
  }

  const visible = (sessions ?? []).filter(s => !starredOnly || isStarred(s));
  // Colour range for the QM3 score across the visible sessions.
  const scoreVals = visible.map(s => s.participants[0]?.qm3_index).filter((n): n is number => n != null);
  const scoreLo = scoreVals.length ? Math.min(...scoreVals) : 0;
  const scoreHi = scoreVals.length ? Math.max(...scoreVals) : 1;

  return (
    <View>
      <View style={styles.listHead}>
        <Text style={styles.sectionLabel}>Available sessions</Text>
        <Pressable onPress={() => setStarredOnly(v => !v)} hitSlop={8}>
          <Text style={[styles.filterChip, starredOnly && styles.filterChipOn]}>★ Starred</Text>
        </Pressable>
      </View>
      {sessions == null ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>
          {starredOnly ? 'No starred sessions yet.' : 'No sessions yet. They show up after you run one in the tracker.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {visible.map(s => (
            <Pressable
              key={s.id}
              onPress={() => setOpenId(s.id)}
              style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
            >
              <Pressable
                onPress={() => toggleStar(s)}
                hitSlop={10}
                style={({ pressed }) => [styles.starBtn, pressed && { opacity: 0.6 }]}
                accessibilityLabel={isStarred(s) ? 'Unstar session' : 'Star session'}
              >
                <Text style={[styles.star, isStarred(s) && styles.starOn]}>{isStarred(s) ? '★' : '☆'}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{sessionTypeLabel(s)}</Text>
                <Text style={styles.rowMeta}>{fmtSessionDate(s.started_at)}</Text>
              </View>
              <Text style={[styles.rowScore, { color: scoreColor(s.participants[0]?.qm3_index ?? null, scoreLo, scoreHi) }]}>
                {fmtScore(s.participants[0]?.qm3_index ?? null)}
              </Text>
              <Pressable
                onPress={() => requestDelete(s.id)}
                hitSlop={10}
                style={({ pressed }) => [styles.delCircle, pressed && { opacity: 0.6 }]}
                accessibilityLabel="Delete session"
              >
                <Text style={styles.delMinus}>−</Text>
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
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
  const { index, alpha, relTimes, roundCenters, roundBounds } = useMemo(() => {
    const segAt = roundSegmenter(steps);
    const idx: (number | null)[] = [];
    const alp: (number | null)[] = [];
    const ts: (number | null)[] = []; // round-relative time (0 at each round start)
    const spans = new Map<number, [number, number]>();
    let prevSeg: number | null = null;
    let segStartT = 0;
    for (const c of p.curve) {
      const seg = segAt(c.t);
      if (seg === -1) continue;              // drop break samples
      if (prevSeg !== null && seg !== prevSeg) { idx.push(null); alp.push(null); ts.push(null); }
      if (seg !== prevSeg) segStartT = c.t;  // a new round → reset the clock
      const oi = idx.length;
      idx.push(c.index); alp.push(c.alpha); ts.push(c.t - segStartT);
      const sp = spans.get(seg);
      if (sp) sp[1] = oi; else spans.set(seg, [oi, oi]);
      prevSeg = seg;
    }
    const len = idx.length || 1;
    const denomL = len - 1 || 1;
    const ordered = [...spans.entries()].sort((a, b) => a[1][0] - b[1][0]);
    const centers = ordered.map(([id, [s, e]]) => ({ frac: ((s + e) / 2) / denomL, label: `R${id}` }));
    // Vertical boundary lines at each round's start + end (always, even for a
    // single round).
    const bounds: number[] = [];
    for (const [, [s, e]] of ordered) { bounds.push(s / denomL); bounds.push(e / denomL); }
    return { index: idx, alpha: alp, relTimes: ts, roundCenters: centers, roundBounds: bounds };
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

  const relWin = relTimes.slice(start, end);
  // Map round-centre labels into the visible window.
  const denom = n - 1 || 1;
  const g0 = start / denom;
  const g1 = (end - 1) / denom;
  const gSpan = g1 - g0 || 1;
  const localMarkers = roundCenters
    .map(m => ({ frac: (m.frac - g0) / gSpan, label: m.label }))
    .filter(m => m.frac >= 0 && m.frac <= 1);
  const localBounds = roundBounds
    .map(b => (b - g0) / gSpan)
    .filter(x => x >= 0 && x <= 1);
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
                <MiniLineChart data={idxSlice} color={colors.accentAlt} dividers={localBounds} height={CHART_H} min={0} max={iR?.max} />
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
                <MiniLineChart data={alphaSlice} color={colors.accent} dividers={localBounds} height={CHART_H} min={aMin} max={400} pivot={0} baseline={0} />
              </View>
            </View>

            <View style={styles.axisRowWrap}>
              <TimeAxis times={relWin} />
            </View>
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

// Time scale beneath the charts. Reads round-relative times sampled at evenly
// spaced points across the visible window, so the clock restarts at 0:00 at
// each round boundary instead of running cumulatively.
function TimeAxis({ times }: { times: (number | null)[] }) {
  if (times.length < 2) return null;
  const N = 4;
  const at = (idx: number): number =>
    times[idx] ?? times[Math.max(0, idx - 1)] ?? times[Math.min(times.length - 1, idx + 1)] ?? 0;
  const ticks = Array.from({ length: N + 1 }, (_, i) => at(Math.round((i / N) * (times.length - 1))));
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

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statTileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      <Text style={styles.statTileLabel}>{label}</Text>
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
  profileName: { ...type.h2, color: colors.text, fontSize: 18, textAlign: 'center', marginTop: spacing.xs },
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

  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterChip: {
    ...type.caption, fontSize: 11, color: colors.textDim,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  filterChipOn: { color: '#E6B34A', borderColor: 'rgba(230,179,74,0.6)' },
  starBtn: { marginRight: spacing.sm, paddingHorizontal: 2 },
  star: { fontSize: 16, color: colors.textDim },
  starOn: { color: '#E6B34A' },
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
  delCircle: {
    width: 24, height: 24, borderRadius: 12, marginLeft: spacing.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,107,107,0.55)',
  },
  delMinus: { color: '#FF6B6B', fontSize: 18, lineHeight: 20, marginTop: -2 },

  empty: { ...type.body, color: colors.textDim, marginTop: spacing.md },

  profileSection: { marginTop: spacing.xl, gap: spacing.xs },
  idSection: { marginTop: spacing.xl, alignItems: 'center', gap: spacing.sm },
  profileActions: { marginTop: spacing.xxl, gap: spacing.md, alignItems: 'flex-start' },

  smCard: {
    marginTop: spacing.lg, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(158,54,148,0.45)',
    overflow: 'hidden',
  },
  smCardLabel: { ...type.sectionLabel, color: colors.text, marginBottom: spacing.sm },
  smBody: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  smBodyMain: { flex: 1 },
  smBar: {
    width: 8, height: SM_BAR_H, borderRadius: 4, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  smBarTrack: { ...StyleSheet.absoluteFillObject, opacity: 0.22 },
  smBarClip: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  smBarFill: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SM_BAR_H },
  smPctRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  smPctMeta: { ...type.caption, color: colors.textMuted, fontSize: 12 },
  smRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)',
  },

  statTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  statTile: {
    flexGrow: 1, flexBasis: '22%', minWidth: 70,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md, gap: 2,
  },
  statTileValue: { ...type.h2, color: colors.text, fontSize: 18 },
  statTileLabel: { ...type.caption, color: colors.textDim, fontSize: 10 },
  codeBox: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  code: { ...type.h3, color: colors.text, letterSpacing: 3, fontSize: 16 },

  reportTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  navLink: { ...type.caption, color: colors.text, fontSize: 13 },
  navDisabled: { color: colors.textDim, opacity: 0.4 },

  deleteBtn: { alignSelf: 'center', marginTop: spacing.xl, paddingVertical: spacing.sm },
  deleteLabel: { ...type.caption, color: '#FF6B6B', textDecorationLine: 'underline' },

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

  footerLink: { ...type.caption, color: colors.textDim, textDecorationLine: 'underline' },
  footerLinkDanger: { color: '#FF6B6B' },
});
