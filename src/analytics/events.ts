/**
 * Activity-event queue. `track()` is fire-and-forget: it appends to a
 * disk-backed buffer that flushes to /v1/events in batches (on a threshold,
 * on an interval while active, and on background). Offline-safe — a failed
 * flush keeps the events queued for the next attempt. Never throws.
 */
import { kv, hydrateFromDisk } from '../content/kv';
import { apiUrl, apiHeaders, ANALYTICS_ENABLED } from './config';
import { getDeviceId } from './device';

export type EventType =
  | 'app_session'
  | 'feature_open'
  | 'play_start'
  | 'play_progress'
  | 'play_complete'
  | 'skip'
  | 'seek'
  | 'round_complete';

export type EventFields = {
  audio_id?: string;
  position_s?: number;
  duration_s?: number;
  payload?: unknown;
};

type QueuedEvent = EventFields & { type: EventType; client_ts: number };

const QUEUE_KEY = 'ah_event_queue_v1';
const FLUSH_THRESHOLD = 20;
const MAX_BATCH = 500;
const MAX_QUEUE = 2000; // cap so a long offline stretch can't grow unbounded

let queue: QueuedEvent[] = [];
let loaded = false;
let flushing = false;

const load = () => {
  if (loaded) return;
  queue = kv.get<QueuedEvent[]>(QUEUE_KEY) ?? [];
  loaded = true;
};

const persist = () => kv.set(QUEUE_KEY, queue);

/** Pull any events persisted before a native cold start (kv.get is empty
 *  at module-init), merging disk-first so nothing queued offline is lost. */
export const hydrateQueue = (): void => {
  hydrateFromDisk<QueuedEvent[]>(QUEUE_KEY, (stored) => {
    if (!Array.isArray(stored) || stored.length === 0) return;
    load();
    queue = [...stored, ...queue].slice(-MAX_QUEUE);
    persist();
  });
};

export const track = (type: EventType, fields: EventFields = {}): void => {
  if (!ANALYTICS_ENABLED) return;
  load();
  queue.push({ type, client_ts: Date.now(), ...fields });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  persist();
  if (queue.length >= FLUSH_THRESHOLD) void flush();
};

export const flush = async (): Promise<void> => {
  if (!ANALYTICS_ENABLED || flushing) return;
  load();
  if (queue.length === 0) return;
  const deviceId = getDeviceId();
  if (!deviceId) return; // not registered yet — try again next tick
  flushing = true;
  try {
    const batch = queue.slice(0, MAX_BATCH);
    const res = await fetch(apiUrl('/v1/events'), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ actor_id: deviceId, actor_kind: 'device', events: batch }),
    });
    if (res.ok) {
      queue = queue.slice(batch.length);
      persist();
    }
  } catch {
    /* offline — keep queued, retry on the next flush */
  } finally {
    flushing = false;
  }
};
