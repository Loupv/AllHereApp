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

import { verifyGoogle, verifyApple, issueSession, verifySession, type Provider } from './auth';
import { generateCode, hashCode, sendOtp } from './email';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', // token-based, no cookies → * is fine
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Key',
  'Access-Control-Max-Age': '86400',
};

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const bad = (message: string, status = 400): Response => json({ error: message }, status);

/** Constant-time string compare (Workers extension); length leak is fine. */
const timingSafeEqual = (a: string, b: string): boolean => {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.byteLength !== bb.byteLength) return false;
  return crypto.subtle.timingSafeEqual(ba, bb);
};

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

/** Resolve the signed-in user id from a Bearer session, or null. */
const userFromAuth = async (request: Request, env: Env): Promise<string | null> => {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token ? await verifySession(token, env) : null;
};

// Crockford-ish alphabet — no 0/O/1/I so the code is easy to read & retype.
const PAIR_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const genPairCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (const b of bytes) out += PAIR_ALPHABET[b % 32];
  return out;
};

/** Return the user's pair code, minting one on first request (unique-retry). */
async function ensurePairCode(userId: string, env: Env): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT pair_code FROM users WHERE id = ?1`)
    .bind(userId).first<{ pair_code: string | null }>();
  if (!row) return null;
  if (row.pair_code) return row.pair_code;
  for (let i = 0; i < 6; i++) {
    const code = genPairCode();
    try {
      await env.DB.prepare(`UPDATE users SET pair_code = ?1 WHERE id = ?2`).bind(code, userId).run();
      return code;
    } catch {
      // UNIQUE collision — vanishingly rare with 32^8 space; retry.
    }
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;

    // Optional shared-key guard — enabled only when APP_KEY is set (prod).
    // Health check stays open; /v1/* requires a matching X-App-Key.
    if (env.APP_KEY && url.pathname.startsWith('/v1/')) {
      if (!timingSafeEqual(request.headers.get('X-App-Key') ?? '', env.APP_KEY)) {
        return json({ error: 'unauthorized' }, 401);
      }
    }

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
        case 'POST /v1/auth/google':
          return await authProvider(request, env, 'google');
        case 'POST /v1/auth/apple':
          return await authProvider(request, env, 'apple');
        case 'POST /v1/auth/email/request':
          return await emailRequest(request, env);
        case 'POST /v1/auth/email/verify':
          return await emailVerify(request, env);
        case 'GET /v1/stats':
          return await stats(request, env);
        case 'GET /v1/me':
          return await me(request, env);
        case 'POST /v1/sessions':
          return await ingestSession(request, env);
        case 'GET /v1/sessions':
          return await listSessions(request, env);
        case 'POST /v1/sessions/delete':
          return await deleteSession(request, env);
        case 'POST /v1/sessions/star':
          return await starSession(request, env);
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

/**
 * Verify an Apple/Google ID token, upsert the user by provider sub, link
 * the anonymous device to that user, and return a session JWT. The token
 * is verified server-side (signature + issuer + audience) — never trusted.
 */
async function authProvider(request: Request, env: Env, provider: Provider): Promise<Response> {
  if (!env.SESSION_SECRET) return json({ error: 'auth not configured (missing SESSION_SECRET)' }, 503);
  const body = await readJson(request);
  if (!body) return bad('invalid json');
  const idToken = str(body.id_token);
  if (!idToken) return bad('id_token required');

  let identity;
  try {
    identity = provider === 'google' ? await verifyGoogle(idToken, env) : await verifyApple(idToken, env);
  } catch {
    return json({ error: 'invalid id_token' }, 401);
  }

  const subCol = provider === 'google' ? 'google_sub' : 'apple_sub'; // not user input — safe to inline
  const newId = crypto.randomUUID();
  const upsert = (email: string | null) =>
    env.DB.prepare(
      `INSERT INTO users (id, email, ${subCol}, created_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(${subCol}) DO UPDATE SET email = COALESCE(?2, users.email)
       RETURNING id`,
    )
      .bind(newId, email, identity.sub, Date.now())
      .first<{ id: string }>();

  let row: { id: string } | null;
  try {
    row = await upsert(identity.email);
  } catch {
    // email has a UNIQUE constraint; a cross-provider email collision would
    // otherwise 500. Keep the account, just don't store the colliding email.
    row = await upsert(null);
  }
  const userId = row?.id ?? newId;

  // Link the anonymous device to this user (analytics joins device → user).
  const deviceId = str(body.device_id);
  if (deviceId) {
    await env.DB.prepare(`UPDATE devices SET user_id = ?1 WHERE id = ?2`).bind(userId, deviceId).run();
  }

  const session = await issueSession(userId, env);
  return json({ session, user_id: userId, email: identity.email });
}

const normEmail = (v: unknown): string | null => {
  const s = str(v)?.toLowerCase().trim();
  return s && s.includes('@') && s.length <= 254 ? s : null;
};

/** Email OTP — step 1: generate a code, store its hash, send it via Resend. */
async function emailRequest(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) return json({ error: 'email auth not configured' }, 503);
  const body = await readJson(request);
  if (!body) return bad('invalid json');
  const email = normEmail(body.email);
  if (!email) return bad('valid email required');

  const code = generateCode();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO email_otps (email, code_hash, expires_at, attempts, created_at)
     VALUES (?1, ?2, ?3, 0, ?4)
     ON CONFLICT(email) DO UPDATE SET code_hash = ?2, expires_at = ?3, attempts = 0, created_at = ?4`,
  )
    .bind(email, await hashCode(email, code), now + 10 * 60 * 1000, now)
    .run();

  try {
    await sendOtp(env, email, code);
  } catch {
    return json({ error: 'could not send code' }, 502);
  }
  return json({ ok: true });
}

/** Email OTP — step 2: verify the code, upsert the user, link device, session. */
async function emailVerify(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET) return json({ error: 'auth not configured (missing SESSION_SECRET)' }, 503);
  const body = await readJson(request);
  if (!body) return bad('invalid json');
  const email = normEmail(body.email);
  const code = str(body.code);
  if (!email || !code) return bad('email + code required');

  const row = await env.DB.prepare(
    `SELECT code_hash, expires_at, attempts FROM email_otps WHERE email = ?1`,
  )
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row) return json({ error: 'invalid code' }, 401);
  if (Date.now() > row.expires_at) return json({ error: 'code expired' }, 401);
  if (row.attempts >= 5) return json({ error: 'too many attempts' }, 429);

  if (!timingSafeEqual(await hashCode(email, code), row.code_hash)) {
    await env.DB.prepare(`UPDATE email_otps SET attempts = attempts + 1 WHERE email = ?1`).bind(email).run();
    return json({ error: 'invalid code' }, 401);
  }
  await env.DB.prepare(`DELETE FROM email_otps WHERE email = ?1`).bind(email).run();

  const newId = crypto.randomUUID();
  const u = await env.DB.prepare(
    `INSERT INTO users (id, email, created_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(email) DO UPDATE SET email = excluded.email
     RETURNING id`,
  )
    .bind(newId, email, Date.now())
    .first<{ id: string }>();
  const userId = u?.id ?? newId;

  const deviceId = str(body.device_id);
  if (deviceId) {
    await env.DB.prepare(`UPDATE devices SET user_id = ?1 WHERE id = ?2`).bind(userId, deviceId).run();
  }

  const session = await issueSession(userId, env);
  return json({ session, user_id: userId, email });
}

/** Aggregated activity stats for the signed-in user (Bearer session). */
async function stats(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const userId = token ? await verifySession(token, env) : null;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  // The user's events live under their linked device ids.
  const inDevices = `actor_id IN (SELECT id FROM devices WHERE user_id = ?1)`;
  const agg = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN type = 'play_start'     THEN 1 ELSE 0 END) AS listens,
       COALESCE(SUM(CASE WHEN type = 'play_progress' THEN duration_s ELSE 0 END), 0) AS seconds,
       SUM(CASE WHEN type = 'round_complete' THEN 1 ELSE 0 END) AS qm_rounds
     FROM events WHERE ${inDevices}`,
  )
    .bind(userId)
    .first<{ listens: number | null; seconds: number | null; qm_rounds: number | null }>();

  const { results } = await env.DB.prepare(
    `SELECT DISTINCT CAST(server_ts / 86400000 AS INTEGER) AS day
     FROM events WHERE ${inDevices} ORDER BY day DESC`,
  )
    .bind(userId)
    .all<{ day: number }>();

  // Streak = consecutive days with activity, ending today or yesterday.
  const today = Math.floor(Date.now() / 86400000);
  const days = (results ?? []).map((r) => r.day);
  let streak = 0;
  if (days.length && (days[0] === today || days[0] === today - 1)) {
    let expected = days[0];
    for (const d of days) {
      if (d === expected) {
        streak++;
        expected--;
      } else if (d < expected) break;
    }
  }

  return json({
    listens: agg?.listens ?? 0,
    seconds: Math.round(agg?.seconds ?? 0),
    qmRounds: agg?.qm_rounds ?? 0,
    streakDays: streak,
  });
}

/**
 * Ingest a finished Live Meditation Tracker session (recap + per-participant
 * QM3 aggregates + a ~1 Hz curve). Idempotent upsert on session.id: a re-push
 * replaces the session row and wholesale-replaces its participant rows. The
 * whole write is one atomic D1 batch so partial sessions never land.
 */
async function ingestSession(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return bad('invalid json');

  const s = body.session as Record<string, unknown> | undefined;
  const participants = body.participants;
  if (!s || typeof s !== 'object') return bad('session required');
  if (!Array.isArray(participants)) return bad('participants[] required');
  if (participants.length > 64) return bad('too many participants (max 64)');

  const id = str(s.id);
  const ownerId = str(s.owner_id);
  const startedAt = num(s.started_at);
  if (!id || !ownerId || startedAt === null) {
    return bad('session needs id, owner_id, started_at');
  }
  const now = Date.now();

  const statements = [
    env.DB.prepare(
      `INSERT INTO lmt_sessions (id, owner_id, started_at, ended_at, mode, protocol, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
       ON CONFLICT(id) DO UPDATE SET
         owner_id = excluded.owner_id, started_at = excluded.started_at,
         ended_at = excluded.ended_at, mode = excluded.mode,
         protocol = excluded.protocol, updated_at = excluded.updated_at`,
    ).bind(
      id, ownerId, startedAt, num(s.ended_at),
      str(s.mode), str(s.protocol), now,
    ),
    // Re-push replaces participants wholesale (clean upsert semantics).
    env.DB.prepare(`DELETE FROM lmt_session_participants WHERE session_id = ?1`).bind(id),
  ];

  const pStmt = env.DB.prepare(
    `INSERT INTO lmt_session_participants
       (session_id, participant, user_ref, qm3_index, qm3_alpha_pos, qm3_alpha_neg,
        mean_index, mean_alpha, duration_ms, curve)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  );
  for (const p of participants) {
    if (!p || typeof p !== 'object') return bad('each participant must be an object');
    const row = p as Record<string, unknown>;
    const name = str(row.participant);
    if (!name) return bad('participant needs a name');
    statements.push(
      pStmt.bind(
        id, name, str(row.user_ref),
        num(row.qm3_index), num(row.qm3_alpha_pos), num(row.qm3_alpha_neg),
        num(row.mean_index), num(row.mean_alpha), num(row.duration_ms),
        row.curve != null ? JSON.stringify(row.curve) : null,
      ),
    );
  }

  await env.DB.batch(statements); // atomic — partial sessions never land
  return json({ ok: true, session_id: id });
}

/** `GET /v1/me` — the signed-in user's identity + their LMT pairing code
 *  (minted on first read). The app shows this code so the user can paste it
 *  into the Live Meditation Tracker desktop app. */
async function me(request: Request, env: Env): Promise<Response> {
  const userId = await userFromAuth(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const row = await env.DB.prepare(`SELECT email FROM users WHERE id = ?1`)
    .bind(userId).first<{ email: string | null }>();
  const pairCode = await ensurePairCode(userId, env);
  return json({ user_id: userId, email: row?.email ?? null, pair_code: pairCode });
}

/**
 * List the signed-in user's LMT sessions, newest first. A session belongs to
 * the user when its `owner_id` equals the user's pair code, or any of its
 * participants carry `user_ref = pair_code` — so the LMT side can stamp the
 * code in either place. Each session carries its participant rows (curve JSON
 * parsed back to an array).
 */
async function listSessions(request: Request, env: Env): Promise<Response> {
  const userId = await userFromAuth(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const code = await ensurePairCode(userId, env);
  if (!code) return json({ sessions: [] });

  const sessions = await env.DB.prepare(
    `SELECT id, owner_id, started_at, ended_at, mode, protocol, starred
     FROM lmt_sessions
     WHERE owner_id = ?1
        OR id IN (SELECT session_id FROM lmt_session_participants WHERE user_ref = ?1)
     ORDER BY starred DESC, started_at DESC LIMIT 200`,
  ).bind(code).all();

  const ids = (sessions.results ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return json({ sessions: [] });

  const placeholders = ids.map((_, i) => `?${i + 1}`).join(', ');
  const parts = await env.DB.prepare(
    `SELECT session_id, participant, user_ref, qm3_index, qm3_alpha_pos, qm3_alpha_neg,
            mean_index, mean_alpha, duration_ms, curve
     FROM lmt_session_participants WHERE session_id IN (${placeholders})`,
  ).bind(...ids).all();

  // Per-session participant visibility (privacy):
  //  - if the requester OWNS the session (owner_id == their code), they're the
  //    host → see every participant;
  //  - otherwise they only matched via a participant.user_ref == code → show
  //    only their own row, never another meditant's performance.
  const ownerById = new Map<string, string>();
  for (const r of sessions.results ?? []) {
    const row = r as { id: string; owner_id: string };
    ownerById.set(row.id, row.owner_id);
  }

  const bySession = new Map<string, unknown[]>();
  for (const p of parts.results ?? []) {
    const row = p as Record<string, unknown> & { session_id: string; user_ref: string | null; curve: string | null };
    const isOwner = ownerById.get(row.session_id) === code;
    if (!isOwner && row.user_ref !== code) continue;
    const list = bySession.get(row.session_id) ?? [];
    list.push({ ...row, curve: row.curve ? JSON.parse(row.curve) : [] });
    bySession.set(row.session_id, list);
  }

  return json({
    sessions: (sessions.results ?? []).map((r) => {
      const row = r as Record<string, unknown> & { id: string };
      return { ...row, participants: bySession.get(row.id) ?? [] };
    }),
  });
}

/**
 * Permanently delete an LMT session (and its participant rows). Allowed only
 * when the requester owns the session (`owner_id` == their pair code) — a
 * participant-only match can't wipe a session that may hold others' data.
 */
async function deleteSession(request: Request, env: Env): Promise<Response> {
  const userId = await userFromAuth(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const body = await readJson(request);
  const id = str(body?.id);
  if (!id) return bad('id required');

  const code = await ensurePairCode(userId, env);
  const row = await env.DB.prepare(`SELECT owner_id FROM lmt_sessions WHERE id = ?1`)
    .bind(id).first<{ owner_id: string }>();
  if (!row) return json({ ok: true, deleted: 0 }); // already gone
  if (!code || row.owner_id !== code) return json({ error: 'forbidden' }, 403);

  // Explicit child delete (don't rely on FK cascade being enabled in D1).
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM lmt_session_participants WHERE session_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM lmt_sessions WHERE id = ?1`).bind(id),
  ]);
  return json({ ok: true, deleted: 1 });
}

/** Star/unstar a session you own. Body: { id, starred }. */
async function starSession(request: Request, env: Env): Promise<Response> {
  const userId = await userFromAuth(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const body = await readJson(request);
  const id = str(body?.id);
  if (!id) return bad('id required');
  const starred = body?.starred ? 1 : 0;

  const code = await ensurePairCode(userId, env);
  const row = await env.DB.prepare(`SELECT owner_id FROM lmt_sessions WHERE id = ?1`)
    .bind(id).first<{ owner_id: string }>();
  if (!row) return json({ ok: true, starred: 0 });
  if (!code || row.owner_id !== code) return json({ error: 'forbidden' }, 403);

  await env.DB.prepare(`UPDATE lmt_sessions SET starred = ?2, updated_at = ?3 WHERE id = ?1`)
    .bind(id, starred, Date.now()).run();
  return json({ ok: true, starred });
}
