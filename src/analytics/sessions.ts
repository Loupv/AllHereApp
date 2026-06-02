/**
 * Live Meditation Tracker reports — client reader.
 *
 * The LMT desktop app pushes finished EEG sessions to the worker (see
 * `worker` + LMT `INTEGRATION.md`). The app reads them back here, scoped to
 * the signed-in user by their pairing code (`GET /v1/sessions`, Bearer auth).
 */
import { apiUrl, apiHeaders } from './config';
import { useAuth } from '../auth/authStore';

export type CurvePoint = { t: number; index: number | null; alpha: number | null };

export type SessionParticipant = {
  participant: string;
  user_ref: string | null;
  qm3_index: number | null;
  qm3_alpha_pos: number | null;
  qm3_alpha_neg: number | null;
  mean_index: number | null;
  mean_alpha: number | null;
  duration_ms: number | null;
  curve: CurvePoint[];
};

export type LmtSession = {
  id: string;
  owner_id: string;
  started_at: number;
  ended_at: number | null;
  mode: string | null;
  /** JSON string of the session plan (rounds × minutes), or null. */
  protocol: string | null;
  participants: SessionParticipant[];
};

export type Me = { user_id: string; email: string | null; pair_code: string | null };

const authHeaders = (): Record<string, string> | null => {
  const session = useAuth.getState().user?.session;
  if (!session) return null;
  return { ...apiHeaders(), Authorization: `Bearer ${session}` };
};

export const fetchMe = async (): Promise<Me | null> => {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(apiUrl('/v1/me'), { headers });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
};

export const fetchSessions = async (): Promise<LmtSession[] | null> => {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(apiUrl('/v1/sessions'), { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as { sessions?: LmtSession[] };
    return data.sessions ?? [];
  } catch {
    return null;
  }
};

/** Permanently delete a session you own. Returns true on success. */
export const deleteSession = async (id: string): Promise<boolean> => {
  const headers = authHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(apiUrl('/v1/sessions/delete'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
};
