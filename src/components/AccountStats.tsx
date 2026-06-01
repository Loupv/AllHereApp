import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../auth/authStore';
import { fetchStats, type AccountStats as Stats } from '../analytics/stats';
import { colors, type, spacing } from '../theme';

const fmtTime = (s: number): string => {
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

/**
 * Signed-in user's activity summary, pinned just under the account icon
 * (top-right of Start). Read-only — sign-out lives in the AccountSheet.
 * Renders nothing when signed out or before stats load.
 */
export function AccountStats() {
  const user = useAuth((s) => s.user);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) {
      setStats(null);
      return;
    }
    let on = true;
    void fetchStats().then((s) => {
      if (on) setStats(s);
    });
    return () => {
      on = false;
    };
  }, [user]);

  if (!user || !stats) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.stat}>{stats.listens} listens</Text>
      <Text style={styles.stat}>{fmtTime(stats.seconds)} listened</Text>
      <Text style={styles.stat}>{stats.qmRounds} QM rounds</Text>
      <Text style={styles.stat}>{stats.streakDays}-day streak</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 40, right: spacing.sm, alignItems: 'flex-end', gap: 1, zIndex: 40 },
  stat: { ...type.caption, color: colors.textDim, fontSize: 11 },
});
