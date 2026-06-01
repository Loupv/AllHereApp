-- Live Meditation Tracker session recaps. Distinct from the events/progress
-- firehose: these are rich, per-session, operator-owned records.
CREATE TABLE IF NOT EXISTS lmt_sessions (
  id          TEXT PRIMARY KEY,   -- `${operator}:${localId}` (idempotent upsert key)
  owner_id    TEXT NOT NULL,      -- operator identity (Phase 1); becomes user link later
  started_at  INTEGER NOT NULL,   -- epoch ms
  ended_at    INTEGER,
  mode        TEXT,
  protocol    TEXT,               -- JSON string
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lmt_sessions_owner ON lmt_sessions(owner_id, started_at);

CREATE TABLE IF NOT EXISTS lmt_session_participants (
  session_id    TEXT NOT NULL REFERENCES lmt_sessions(id) ON DELETE CASCADE,
  participant   TEXT NOT NULL,
  user_ref      TEXT,             -- NULLABLE Phase-2 hook → users(id)
  qm3_index     REAL,
  qm3_alpha_pos REAL,
  qm3_alpha_neg REAL,
  mean_index    REAL,
  mean_alpha    REAL,
  duration_ms   INTEGER,
  curve         TEXT,             -- JSON array string
  PRIMARY KEY (session_id, participant)
);
