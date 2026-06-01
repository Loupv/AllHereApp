/**
 * Progress sync (stages listened / progression). Pushes the local
 * `progressStore.listened` map to /v1/progress and pulls the server copy
 * on boot, merging it back so progress follows the anonymous device (and,
 * post-Phase-2, the linked account) across reinstalls. Never throws.
 */
import { apiUrl, apiHeaders, ANALYTICS_ENABLED } from './config';
import { getDeviceId } from './device';
import { useProgress } from '../player/progressStore';

const body = (items: unknown) =>
  JSON.stringify({ actor_id: getDeviceId(), actor_kind: 'device', items });

export const pushProgress = async (): Promise<void> => {
  if (!ANALYTICS_ENABLED || !getDeviceId()) return;
  const listened = useProgress.getState().listened;
  const ids = Object.keys(listened);
  if (ids.length === 0) return;
  const now = Date.now();
  const items = ids.map((track_id) => ({ track_id, status: 'listened', updated_at: now }));
  try {
    await fetch(apiUrl('/v1/progress'), { method: 'POST', headers: apiHeaders(), body: body(items) });
  } catch {
    /* offline — retried on the next push */
  }
};

export const pullProgress = async (): Promise<void> => {
  if (!ANALYTICS_ENABLED || !getDeviceId()) return;
  try {
    const res = await fetch(apiUrl(`/v1/progress?actor_id=${encodeURIComponent(getDeviceId()!)}`), {
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
