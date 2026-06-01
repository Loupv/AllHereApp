# AllHere API (Cloudflare Worker + D1)

Anonymous-first activity & progress backend for the AllHere app.
An **actor** is a device (anonymous) or — once linked at login (Phase 2) — a user.

## Endpoints (JSON)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | health check |
| POST | `/v1/device` | upsert an anonymous device → `{ device_id }` (client id or server-minted) |
| POST | `/v1/events` | batch-ingest activity events (`{ actor_id, actor_kind, events:[…] }`) |
| GET | `/v1/progress?actor_id=` | read an actor's track progress |
| POST | `/v1/progress` | upsert progress (last-write-wins on `updated_at`) |

Event types: `app_session`, `feature_open`, `play_start`, `play_progress`
(heartbeat → listening time via `duration_s`), `play_complete`, `skip`, `seek`, `round_complete`.

## Local dev

```sh
cd worker
npm install
npm run db:migrate:local   # create local D1 + apply migrations
npm run dev                # http://127.0.0.1:8787
```

The app points at `EXPO_PUBLIC_API_URL` (default `http://127.0.0.1:8787`).
⚠️ A physical device can't reach the Mac's localhost — set
`EXPO_PUBLIC_API_URL` to a deployed URL or the Mac LAN IP for on-device tests.

## Deploy (remote)

Needs a `wrangler login` with **Workers + D1** permissions (not just R2).

```sh
npm run db:create            # → copy the printed database_id into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

## App-key guard (before public exposure)

The `/v1/*` endpoints are open by default (anonymous). Set a shared key to
gate them:

```sh
wrangler secret put APP_KEY        # prod (overrides the empty var)
# local: echo 'APP_KEY=...' > .dev.vars
```

When `APP_KEY` is set, requests must send a matching `X-App-Key` header
(timing-safe compare). Set the same value in the app via `EXPO_PUBLIC_APP_KEY`.

> Before going public, also add rate-limiting / abuse protection — an open
> anonymous write endpoint should not ship unguarded.

## Schema

`migrations/0001_init.sql` — `users` / `devices` / `progress` / `events`.
