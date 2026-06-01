/** Fetch the signed-in user's aggregated stats from /v1/stats. */
import { apiUrl, apiHeaders } from './config';
import { useAuth } from '../auth/authStore';

export type AccountStats = {
  listens: number;
  seconds: number;
  qmRounds: number;
  streakDays: number;
};

export const fetchStats = async (): Promise<AccountStats | null> => {
  const session = useAuth.getState().user?.session;
  if (!session) return null;
  try {
    const res = await fetch(apiUrl('/v1/stats'), {
      headers: { ...apiHeaders(), Authorization: `Bearer ${session}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as AccountStats;
  } catch {
    return null;
  }
};
