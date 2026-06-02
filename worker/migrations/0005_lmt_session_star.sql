-- Let a user star (favourite) their LMT sessions. Persisted on the session row.
ALTER TABLE lmt_sessions ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;
