import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useProgress } from '../src/player/progressStore';
import { useAuth } from '../src/auth/authStore';
import { silentMindVolets } from '../src/content/catalog';
import { fetchStats, type AccountStats } from '../src/analytics/stats';
import { flush } from '../src/analytics/events';
import { fetchMe, fetchSessions, type LmtSession, type SessionParticipant } from '../src/analytics/sessions';
import { MiniLineChart } from '../src/components/MiniLineChart';
import { colors, radius, spacing, type } from '../src/theme';

const PANES = ['Silent Mind Practice', 'Live Tracker', 'Quantified Meditation Reports'] as const;

// Per-pane identity colour — magenta (SM program), indigo (Live Tracker),
// teal (QM reports). Each tints its pane background and the active tab rail.
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

/** Fractional x-positions (0..1) of each round/break transition, for the
 *  chart guide lines. Normalised by the planned total so round windows line
 *  up with the time-axis curve. */
const roundDividers = (protocol: string | null): number[] => {
  const steps = parseSteps(protocol);
  if (!steps || steps.length < 2) return [];
  const durs = steps.map(st => st.durationSec ?? 0);
  const total = durs.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const out: number[] = [];
  let cum = 0;
  for (let i = 0; i < steps.length - 1; i++) {
    cum += durs[i];
    out.push(cum / total);
  }
  return out;
};

/** mm:ss clock for the chart time axis. */
const fmtClock = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** Round-number markers (R1, R2, …) at the fractional centre of each round
 *  window, for labelling the time axis. */
const roundMarkers = (protocol: string | null): { frac: number; label: string }[] => {
  const steps = parseSteps(protocol);
  if (!steps) return [];
  const durs = steps.map(st => st.durationSec ?? 0);
  const total = durs.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const out: { frac: number; label: string }[] = [];
  let cum = 0;
  steps.forEach((st, i) => {
    if (st.kind === 'round') out.push({ frac: (cum + durs[i] / 2) / total, label: `R${st.roundIdx}` });
    cum += durs[i];
  });
  return out;
};

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);

  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);
  const resetProgress = useProgress(s => s.resetProgress);
  const listened = useProgress(s => s.listened);

  const [stats, setStats] = useState<AccountStats | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LmtSession[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Pull the account data. Flushes queued listen events first so the just-
  // played audio is counted server-side before we read /v1/stats (otherwise
  // the seconds counter lags a buffer cycle). Also the pull-to-refresh path.
  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    try {
      await flush();
      const [s, m, sess] = await Promise.all([fetchStats(), fetchMe(), fetchSessions()]);
      if (!mounted.current) return;
      setStats(s);
      setPairCode(m?.pair_code ?? null);
      setSessions(sess);
      setSelectedId(prev => prev ?? (sess && sess.length ? sess[0].id : null));
    } finally {
      if (mounted.current && isRefresh) setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { void load(false); }, [load]);

  const goTo = (idx: number) => {
    setActive(idx);
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
  };
  const onPaged = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== active) setActive(idx);
  };

  const openReport = (id: string) => {
    setSelectedId(id);
    goTo(2);
  };

  const selected = sessions?.find(s => s.id === selectedId) ?? null;

  return (
    <View style={styles.root}>
      {/* Header: identity (avatar + name + email) + close */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.identity}>
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
            {user?.email ? (
              <Text style={styles.identityEmail} numberOfLines={1}>{user.email}</Text>
            ) : (
              <Text style={styles.identityEmail}>Not signed in</Text>
            )}
          </View>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      {/* Three-pane nav */}
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
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPaged}
        style={styles.pager}
      >
        {/* ── Pane 1 · Silent Mind program ─────────────────────── */}
        <Pane width={width} tint={PANE_THEME[0].tint}>
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

        {/* ── Pane 2 · Live Tracker ────────────────────────────── */}
        <Pane width={width} tint={PANE_THEME[1].tint} refreshing={refreshing} onRefresh={() => void load(true)}>
          <LiveTrackerPane
            user={!!user}
            pairCode={pairCode}
            sessions={sessions}
            onOpen={openReport}
            accent={PANE_THEME[1].accent}
          />
        </Pane>

        {/* ── Pane 3 · Quantified Meditation Reports ───────────── */}
        <Pane width={width} tint={PANE_THEME[2].tint} refreshing={refreshing} onRefresh={() => void load(true)}>
          <ReportPane
            user={!!user}
            sessions={sessions}
            selected={selected}
            onSelect={setSelectedId}
            onBack={() => goTo(1)}
            chartWidth={width - spacing.lg * 2}
          />
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
            ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />
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
  user, pairCode, sessions, onOpen, accent,
}: {
  user: boolean;
  pairCode: string | null;
  sessions: LmtSession[] | null;
  onOpen: (id: string) => void;
  accent: string;
}) {
  if (!user) return <Text style={styles.empty}>Sign in to connect the Live Meditation Tracker.</Text>;
  return (
    <View>
      <Text style={styles.sectionLabel}>Your pairing code</Text>
      <View style={[styles.codeBox, { borderColor: accent }]}>
        <Text style={styles.code} selectable>{pairCode ?? '…'}</Text>
      </View>
      <Text style={styles.caption}>
        In the Live Meditation Tracker desktop app, open Settings → AllHere sync and paste this code.
        Your finished sessions will then appear here.
      </Text>

      <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Available sessions</Text>
      {sessions == null ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : sessions.length === 0 ? (
        <Text style={styles.empty}>No sessions yet. They show up after you run one in the tracker.</Text>
      ) : (
        <View style={styles.list}>
          {sessions.map(s => (
            <Pressable
              key={s.id}
              onPress={() => onOpen(s.id)}
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

// ── Pane 3 ────────────────────────────────────────────────────────────────
function ReportPane({
  user, sessions, selected, onSelect, onBack, chartWidth,
}: {
  user: boolean;
  sessions: LmtSession[] | null;
  selected: LmtSession | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  chartWidth: number;
}) {
  if (!user) return <Text style={styles.empty}>Sign in to see your meditation reports.</Text>;
  if (!sessions || sessions.length === 0) return <Text style={styles.empty}>No reports yet.</Text>;
  if (!selected) return <Text style={styles.empty}>Pick a session in Live Tracker.</Text>;

  const dividers = roundDividers(selected.protocol);
  const markers = roundMarkers(selected.protocol);
  const idx = sessions.findIndex(s => s.id === selected.id);
  const prev = idx > 0 ? sessions[idx - 1] : null;       // newer
  const next = idx < sessions.length - 1 ? sessions[idx + 1] : null; // older

  return (
    <View>
      {/* Navigation: back to the list + step through sessions */}
      <View style={styles.reportNav}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.navLink}>‹ Sessions</Text>
        </Pressable>
        <View style={styles.navStep}>
          <Pressable onPress={() => prev && onSelect(prev.id)} disabled={!prev} hitSlop={8}>
            <Text style={[styles.navLink, !prev && styles.navDisabled]}>Prev</Text>
          </Pressable>
          <Text style={styles.navPos}>{idx + 1} / {sessions.length}</Text>
          <Pressable onPress={() => next && onSelect(next.id)} disabled={!next} hitSlop={8}>
            <Text style={[styles.navLink, !next && styles.navDisabled]}>Next</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.reportTitle}>{sessionTypeLabel(selected)}</Text>
      <Text style={styles.caption}>{fmtSessionDate(selected.started_at)}{selected.mode ? ` · ${selected.mode}` : ''}</Text>

      {selected.participants.map(p => (
        <ParticipantReport
          key={p.participant}
          p={p}
          dividers={dividers}
          markers={markers}
          chartWidth={chartWidth}
          showName={selected.participants.length > 1}
        />
      ))}
    </View>
  );
}

const seriesRange = (xs: (number | null)[]): { min: number; max: number } | null => {
  const v = xs.filter((n): n is number => n != null && Number.isFinite(n));
  return v.length ? { min: Math.min(...v), max: Math.max(...v) } : null;
};

function ParticipantReport({
  p, dividers, markers, chartWidth, showName,
}: {
  p: SessionParticipant;
  dividers: number[];
  markers: { frac: number; label: string }[];
  chartWidth: number;
  showName: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const contentW = Math.round(chartWidth * zoom);
  const totalSec = p.curve.length ? p.curve[p.curve.length - 1].t : 0;
  const index = p.curve.map(c => c.index);
  const alpha = p.curve.map(c => c.alpha);
  const iR = seriesRange(index);
  const aR = seriesRange(alpha);
  const hasCurve = p.curve.length > 1;

  return (
    <View style={styles.participant}>
      {showName && <Text style={styles.rowTitle}>{p.participant}</Text>}

      <View style={styles.scoreGrid}>
        <Score label="QM3 Index" value={fmtScore(p.qm3_index)} />
        <Score label="QM3 Alpha +" value={fmtScore(p.qm3_alpha_pos)} />
        <Score label="QM3 Alpha −" value={fmtScore(p.qm3_alpha_neg)} />
        <Score label="Mean Index" value={fmtScore(p.mean_index)} />
        <Score label="Mean Alpha" value={fmtScore(p.mean_alpha)} />
      </View>

      {hasCurve && (
        <>
          {/* Zoom widens the chart content; the horizontal ScrollView then
              pans through the session and the time axis adapts. */}
          <View style={styles.zoomRow}>
            <Pressable onPress={() => setZoom(z => Math.max(1, z - 1))} disabled={zoom <= 1} hitSlop={8}>
              <Text style={[styles.zoomBtn, zoom <= 1 && styles.navDisabled]}>−</Text>
            </Pressable>
            <Text style={styles.zoomLabel}>{zoom}×</Text>
            <Pressable onPress={() => setZoom(z => Math.min(6, z + 1))} disabled={zoom >= 6} hitSlop={8}>
              <Text style={[styles.zoomBtn, zoom >= 6 && styles.navDisabled]}>+</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            scrollEnabled={zoom > 1}
            showsHorizontalScrollIndicator={zoom > 1}
            nestedScrollEnabled
            directionalLockEnabled
          >
            <View style={{ width: contentW }}>
              <View style={styles.chartHead}>
                <Text style={styles.sectionLabel}>Index</Text>
                {iR && <Text style={styles.rangeLabel}>high {iR.max.toFixed(1)} · low {iR.min.toFixed(1)}</Text>}
              </View>
              <MiniLineChart data={index} color={colors.accentAlt} dividers={dividers} width={contentW} />

              <View style={[styles.chartHead, { marginTop: spacing.md }]}>
                <Text style={styles.sectionLabel}>Alpha</Text>
                {aR && (
                  <Text style={styles.rangeLabel}>
                    high {aR.max > 0 ? '+' : ''}{aR.max.toFixed(1)}% · low {aR.min.toFixed(1)}% · baseline 0%
                  </Text>
                )}
              </View>
              <MiniLineChart data={alpha} color={colors.accent} dividers={dividers} width={contentW} baseline={0} />

              <TimeAxis totalSec={totalSec} markers={markers} width={contentW} />
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

// Time scale beneath the charts: round-number markers (R1, R2, …) over a row
// of mm:ss ticks, positioned in pixels against the (possibly zoomed) width.
function TimeAxis({ totalSec, markers, width }: { totalSec: number; markers: { frac: number; label: string }[]; width: number }) {
  if (totalSec <= 0) return null;
  const step = totalSec <= 300 ? 60 : totalSec <= 900 ? 120 : 180;
  const ticks: number[] = [];
  for (let t = 0; t <= totalSec; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== totalSec) ticks.push(totalSec);
  const clamp = (x: number) => Math.max(0, Math.min(x, width - 30));

  return (
    <View style={[styles.axis, { width }]}>
      {markers.map((m, i) => (
        <Text key={`m${i}`} style={[styles.axisRound, { left: clamp(m.frac * width - 8) }]}>{m.label}</Text>
      ))}
      {ticks.map((t, i) => (
        <Text key={`t${i}`} style={[styles.axisTime, { left: clamp((t / totalSec) * width - 14) }]}>{fmtClock(t)}</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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

  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong,
    paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm,
  },
  code: { ...type.h2, color: colors.text, letterSpacing: 4, fontSize: 24 },

  reportNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navLink: { ...type.caption, color: colors.text, fontSize: 13 },
  navDisabled: { color: colors.textDim, opacity: 0.4 },
  navPos: { ...type.caption, color: colors.textDim, fontSize: 12 },

  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  zoomBtn: { ...type.h2, color: colors.text, fontSize: 22, lineHeight: 24, width: 24, textAlign: 'center' },
  zoomLabel: { ...type.caption, color: colors.textDim, fontSize: 12, minWidth: 24, textAlign: 'center' },

  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rangeLabel: { ...type.caption, color: colors.textDim, fontSize: 11 },
  axis: { height: 30, marginTop: spacing.xs },
  axisRound: { position: 'absolute', top: 0, ...type.caption, color: colors.textDim, fontSize: 10 },
  axisTime: { position: 'absolute', top: 14, ...type.caption, color: colors.textDim, fontSize: 10 },

  reportTitle: { ...type.h2, color: colors.text, marginTop: spacing.xs },
  participant: { marginTop: spacing.lg, gap: spacing.xs },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  score: {
    minWidth: 96, flexGrow: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md,
  },
  scoreValue: { ...type.h2, color: colors.text, fontSize: 22 },
  scoreLabel: { ...type.caption, color: colors.textDim, fontSize: 11, marginTop: 2 },

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
