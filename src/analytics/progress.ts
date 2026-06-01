/**
 * Progress sync (stages listened / progression). When signed in, progress
 * is keyed to the USER account (authoritative across devices); otherwise to
 * the anonymous device. Never throws.
 */
import { apiUrl, apiHeaders, ANALYTICS_ENABLED } from './config';
import { getDeviceId } from './device';
import { useProgress } from '../player/progressStore';
import { useAuth } from '../auth/authStore';

type Actor = { id: string; kind: 'user' | 'device' };

const actor = (): Actor | null => {
  const u = useAuth.getState().user;
  if (u) return { id: u.userId, kind: 'user' };
  const d = getDeviceId();
  return d ? { id: d, kind: 'device' } : null;
};

export const pushProgress = async (): Promise<void> => {
  if (!ANALYTICS_ENABLED) return;
  const a = actor();
  if (!a) return;
  const ids = Object.keys(useProgress.getState().listened);
  if (ids.length === 0) return;
  const now = Date.now();
  const items = ids.map((track_id) => ({ track_id, status: 'listened', updated_at: now }));
  try {
    await fetch(apiUrl('/v1/progress'), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ actor_id: a.id, actor_kind: a.kind, items }),
    });
  } catch {
    /* offline — retried on the next push */
  }
};

export const pullProgress = async (): Promise<void> => {
  if (!ANALYTICS_ENABLED) return;
  const a = actor();
  if (!a) return;
  try {
    const res = await fetch(apiUrl(`/v1/progress?actor_id=${encodeURIComponent(a.id)}`), {
      headers: apiHeaders(),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: { track_id: string }[] };
    const mark = useProgress.getState().markListened;
    for (const it of data.items ?? []) if (it?.track_id) mark(it.track_id);
  } catch {
    /* offline — local stays authoritative until next pull */
  }
};
