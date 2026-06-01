-- AllHere backend — initial schema (Phase 1, anonymous-first).
-- An "actor" is a device (anonymous) or, once linked at login, a user.

-- Known identities. Created on first login / link (Phase 2).
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,   -- uuid
  email       TEXT UNIQUE,
  apple_sub   TEXT UNIQUE,        -- stable Apple user id
  google_sub  TEXT UNIQUE,        -- stable Google user id
  created_at  INTEGER NOT NULL,   -- epoch ms
  deleted_at  INTEGER
);

-- Devices: tracked anonymously from first launch; user_id is null until
-- the device is linked to an account (Phase 2 `/v1/auth/*` + link).
CREATE TABLE IF NOT EXISTS devices (
  id          TEXT PRIMARY KEY,   -- client-generated uuid
  user_id     TEXT REFERENCES users(id),
  platform    TEXT,               -- ios | android | web
  app_version TEXT,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- Authoritative per-actor track status (server mirror of progressStore).
CREATE TABLE IF NOT EXISTS progress (
  actor_id    TEXT NOT NULL,      -- device id (anon) or user id
  actor_kind  TEXT NOT NULL,      -- 'device' | 'user'
  track_id    TEXT NOT NULL,
  status      TEXT NOT NULL,      -- 'listened' | 'completed'
  updated_at  INTEGER NOT NULL,   -- epoch ms (last-write-wins key)
  PRIMARY KEY (actor_id, track_id)
);

-- Append-only activity firehose. Listening time = sum(duration_s);
-- skips = type='skip'; features used = type='feature_open'; etc.
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,   -- uuid (server-assigned)
  actor_id    TEXT NOT NULL,
  actor_kind  TEXT NOT NULL,
  type        TEXT NOT NULL,      -- app_session|feature_open|play_start|play_progress|play_complete|skip|seek|round_complete
  audio_id    TEXT,
  position_s  REAL,               -- playhead seconds (seek/progress)
  duration_s  REAL,               -- listened delta for this event (listening-time accounting)
  payload     TEXT,               -- JSON blob for extra, event-specific fields
  client_ts   INTEGER,            -- when it happened on device (epoch ms)
  server_ts   INTEGER NOT NULL    -- when ingested
);
CREATE INDEX IF NOT EXISTS idx_events_actor_ts ON events(actor_id, server_ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts  ON events(type, server_ts);
