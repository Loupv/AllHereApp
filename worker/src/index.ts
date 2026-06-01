/**
 * AllHere activity & progress API — Phase 1 (anonymous-first).
 *
 * Endpoints (all JSON):
 *   GET  /              health check
 *   POST /v1/device     upsert an anonymous device, returns its id
 *   POST /v1/events     batch-ingest activity events
 *   GET  /v1/progress   read an actor's track progress  (?actor_id=)
 *   POST /v1/progress   upsert progress (last-write-wins on updated_at)
 *
 * An "actor" is a device (anonymous) or — once linked at login (Phase 2) —
 * a user id. Auth (Apple/Google/email) + linking land in Phase 2.
 */

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', // token-based, no cookies → * is fine
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const bad = (message: string, status = 400): Response => json({ error: message }, status);

type ActorKind = 'device' | 'user';
const isActorKind = (v: unknown): v is ActorKind => v === 'device' || v === 'user';

const EVENT_TYPES = new Set([
  'app_session',
  'feature_open',
  'play_start',
  'play_progress',
  'play_complete',
  'skip',
  'seek',
  'round_complete',
]);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

const readJson = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const v = await request.json();
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;

    try {
      switch (route) {
        case 'GET /':
          return json({ ok: true, service: 'allhere-api', ts: Date.now() });
        case 'POST /v1/device':
          return await registerDevice(request, env);
        case 'POST /v1/events':
          return await ingestEvents(request, env);
        case 'GET /v1/progress':
          return await getProgress(url, env);
        case 'POST /v1/progress':
          return await putProgress(request, env);
        default:
          return bad('not found', 404);
      }
    } catch (err) {
      // Structured log; never passThroughOnException (would hide the bug).
      console.error(JSON.stringify({ level: 'error', route, message: String(err) }));
      return json({ error: 'internal error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function registerDevice(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return bad('invalid json');

  const id = str(body.device_id) ?? crypto.randomUUID();
  const platform = str(body.platform);
  const appVersion = str(body.app_version);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO devices (id, platform, app_version, created_at, last_seen)
     VALUES (?1, ?2, ?3, ?4, ?4)
     ON CONFLICT(id) DO UPDATE SET
       platform    = COALESCE(?2, devices.platform),
       app_version = COALESCE(?3, devices.app_version),
       last_seen   = ?4`,
  )
    .bind(id, platform, appVersion, now)
    .run();

  return json({ device_id: id });
}

async function ingestEvents(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return bad('invalid json');

  const actorId = str(body.actor_id);
  const actorKind = body.actor_kind;
  const events = body.events;
  if (!actorId) return bad('actor_id required');
  if (!isActorKind(actorKind)) return bad('actor_kind must be device|user');
  if (!Array.isArray(events) || events.length === 0) return bad('events[] required');
  if (events.length > 500) return bad('too many events (max 500)');

  const now = Date.now();
  const stmt = env.DB.prepare(
    `INSERT INTO events
       (id, actor_id, actor_kind, type, audio_id, position_s, duration_s, payload, client_ts, server_ts)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  );

  const batch = [];
  for (const e of events) {
    if (!e || typeof e !== 'object') return bad('each event must be an object');
    const ev = e as Record<string, unknown>;
    if (typeof ev.type !== 'string' || !EVENT_TYPES.has(ev.type)) {
      return bad(`invalid event type: ${String(ev.type)}`);
    }
    batch.push(
      stmt.bind(
        crypto.randomUUID(),
        actorId,
        actorKind,
        ev.type,
        str(ev.audio_id),
        num(ev.position_s),
        num(ev.duration_s),
        ev.payload != null ? JSON.stringify(ev.payload) : null,
        num(ev.client_ts),
        now,
      ),
    );
  }

  await env.DB.batch(batch);
  return json({ accepted: batch.length });
}

async function getProgress(url: URL, env: Env): Promise<Response> {
  const actorId = url.searchParams.get('actor_id');
  if (!actorId) return bad('actor_id required');

  const { results } = await env.DB.prepare(
    `SELECT track_id, status, updated_at FROM progress WHERE actor_id = ?1`,
  )
    .bind(actorId)
    .all();

  return json({ items: results ?? [] });
}

async function putProgress(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return bad('invalid json');

  const actorId = str(body.actor_id);
  const actorKind = body.actor_kind;
  const items = body.items;
  if (!actorId) return bad('actor_id required');
  if (!isActorKind(actorKind)) return bad('actor_kind must be device|user');
  if (!Array.isArray(items) || items.length === 0) return bad('items[] required');
  if (items.length > 1000) return bad('too many items (max 1000)');

  const stmt = env.DB.prepare(
    `INSERT INTO progress (actor_id, actor_kind, track_id, status, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(actor_id, track_id) DO UPDATE SET
       status     = excluded.status,
       updated_at = excluded.updated_at
     WHERE excluded.updated_at > progress.updated_at`,
  );

  const batch = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') return bad('each item must be an object');
    const row = it as Record<string, unknown>;
    if (typeof row.track_id !== 'string' || typeof row.status !== 'string') {
      return bad('each item needs track_id + status');
    }
    batch.push(stmt.bind(actorId, actorKind, row.track_id, row.status, num(row.updated_at) ?? Date.now()));
  }

  await env.DB.batch(batch);
  return json({ ok: true, upserted: batch.length });
}
