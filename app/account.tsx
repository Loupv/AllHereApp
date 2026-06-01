import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions,
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

const PANES = ['Silent Mind program', 'Live Tracker', 'Quantified Meditation Reports'] as const;

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

  useEffect(() => {
    if (!user) return;
    let on = true;
    // Flush any queued listen events first so the just-played audio is
    // counted server-side before we read /v1/stats — otherwise the seconds
    // counter lags behind by a buffer cycle.
    void (async () => {
      await flush();
      if (!on) return;
      void fetchStats().then(s => on && setStats(s));
      void fetchMe().then(m => on && setPairCode(m?.pair_code ?? null));
      void fetchSessions().then(s => {
        if (!on) return;
        setSessions(s);
        if (s && s.length && !selectedId) setSelectedId(s[0].id);
      });
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
          <SmProgramPane listened={listened} accent={PANE_THEME[0].accent} />
        </Pane>

        {/* ── Pane 2 · Live Tracker ────────────────────────────── */}
        <Pane width={width} tint={PANE_THEME[1].tint}>
          <LiveTrackerPane
            user={!!user}
            pairCode={pairCode}
            sessions={sessions}
            onOpen={openReport}
            accent={PANE_THEME[1].accent}
          />
        </Pane>

        {/* ── Pane 3 · Quantified Meditation Reports ───────────── */}
        <Pane width={width} tint={PANE_THEME[2].tint}>
          <ReportPane
            user={!!user}
            sessions={sessions}
            selected={selected}
            onSelect={setSelectedId}
          />
        </Pane>
      </ScrollView>

      {/* ── Footer · stats + actions ───────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {user && stats && (
          <View style={styles.statsRow}>
            <Text style={styles.statText}>{stats.listens} listens · {fmtTime(stats.seconds)} listened</Text>
            <Text style={styles.statText}>{stats.qmRounds} QM rounds · {stats.streakDays}-day streak</Text>
          </View>
        )}
        <View style={styles.footerActions}>
          <Pressable onPress={() => { if (confirmReset) { resetProgress(); setConfirmReset(false); } else setConfirmReset(true); }} hitSlop={8}>
            <Text style={[styles.footerLink, confirmReset && styles.footerLinkDanger]}>
              {confirmReset ? 'Tap again to reset progress' : 'Reset progress'}
            </Text>
          </Pressable>
          {user && (
            <Pressable onPress={() => { logout(); router.back(); }} hitSlop={8}>
              <Text style={styles.footerLink}>Log out</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// Full-width swipe pane: a soft top-down colour wash over the dark base, with
// the scrollable content on top.
function Pane({ width, tint, children }: { width: number; tint: string; children: ReactNode }) {
  return (
    <View style={{ width }}>
      <LinearGradient colors={[tint, 'transparent']} style={styles.paneGradient} pointerEvents="none" />
      <ScrollView contentContainerStyle={styles.paneContent} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

// ── Pane 1 ────────────────────────────────────────────────────────────────
function SmProgramPane({ listened, accent }: { listened: Record<string, true>; accent: string }) {
  const parts = silentMindVolets
    .map(v => {
      const tracks = [...v.tracks, ...(v.qmTracks ?? [])].filter(t => !t.comingSoon);
      const done = tracks.filter(t => listened[t.id]).length;
      return { id: v.id, title: v.title || 'Introduction', done, total: tracks.length };
    })
    .filter(p => p.total > 0);
  const done = parts.reduce((a, p) => a + p.done, 0);
  const total = parts.reduce((a, p) => a + p.total, 0);

  return (
    <View>
      <Text style={[styles.bigStat, { color: accent }]}>{done}<Text style={styles.bigStatDim}> / {total}</Text></Text>
      <Text style={styles.caption}>tracks completed in the Silent Mind program</Text>
      <View style={styles.list}>
        {parts.map(p => (
          <View key={p.id} style={styles.listRow}>
            <Text style={styles.rowTitle}>{p.title}</Text>
            <Text style={styles.rowMeta}>{p.done} / {p.total}</Text>
          </View>
        ))}
      </View>
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
        <Text style={[styles.code, { color: accent }]} selectable>{pairCode ?? '…'}</Text>
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
  user, sessions, selected, onSelect,
}: {
  user: boolean;
  sessions: LmtSession[] | null;
  selected: LmtSession | null;
  onSelect: (id: string) => void;
}) {
  if (!user) return <Text style={styles.empty}>Sign in to see your meditation reports.</Text>;
  if (!sessions || sessions.length === 0) return <Text style={styles.empty}>No reports yet.</Text>;
  if (!selected) return <Text style={styles.empty}>Pick a session in Live Tracker.</Text>;

  const dividers = roundDividers(selected.protocol);

  return (
    <View>
      {/* Session picker (only if more than one) */}
      {sessions.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: spacing.xs }}>
          {sessions.map(s => (
            <Pressable
              key={s.id}
              onPress={() => onSelect(s.id)}
              style={[styles.chip, s.id === selected.id && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, s.id === selected.id && styles.chipLabelActive]}>
                {fmtSessionDate(s.started_at)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Text style={styles.reportTitle}>{sessionTypeLabel(selected)}</Text>
      <Text style={styles.caption}>{fmtSessionDate(selected.started_at)}{selected.mode ? ` · ${selected.mode}` : ''}</Text>

      {selected.participants.map(p => (
        <ParticipantReport key={p.participant} p={p} dividers={dividers} showName={selected.participants.length > 1} />
      ))}
    </View>
  );
}

function ParticipantReport({ p, dividers, showName }: { p: SessionParticipant; dividers: number[]; showName: boolean }) {
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

      <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Index</Text>
      <MiniLineChart data={p.curve.map(c => c.index)} color={colors.accentAlt} dividers={dividers} />

      <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Alpha</Text>
      <MiniLineChart data={p.curve.map(c => c.alpha)} color={colors.accent} dividers={dividers} />
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
    backgroundColor: colors.bgSoft,
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

  bigStat: { ...type.display, color: colors.text, fontSize: 44 },
  bigStatDim: { color: colors.textDim },
  caption: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  sectionLabel: { ...type.sectionLabel, color: colors.textMuted, marginBottom: spacing.xs },

  list: { marginTop: spacing.md, gap: 0 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.09)',
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rowTitle: { ...type.body, color: colors.text, fontSize: 15 },
  rowMeta: { ...type.caption, color: colors.textDim, fontSize: 12, marginTop: 2 },
  rowScore: { ...type.h3, color: colors.accentAlt },

  empty: { ...type.body, color: colors.textDim, marginTop: spacing.md },

  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong,
    paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm,
  },
  code: { ...type.h2, color: colors.text, letterSpacing: 4, fontSize: 24 },

  chips: { marginBottom: spacing.md, flexGrow: 0 },
  chip: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: { borderColor: colors.accentAlt, backgroundColor: colors.accentAltSoft },
  chipLabel: { ...type.caption, color: colors.textDim, fontSize: 12 },
  chipLabelActive: { color: colors.text },

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
    backgroundColor: colors.bgSoft,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm,
  },
  statsRow: { gap: 2 },
  statText: { ...type.caption, color: colors.textMuted, fontSize: 12 },
  footerActions: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLink: { ...type.caption, color: colors.textDim, textDecorationLine: 'underline' },
  footerLinkDanger: { color: '#FF6B6B' },
});
