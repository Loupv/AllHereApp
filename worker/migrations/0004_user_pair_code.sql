-- Short, human-typeable account code shared between the AllHere mobile app and
-- the Live Meditation Tracker desktop app. The user reads it in the app and
-- pastes it into LMT; LMT stamps it on the sessions it pushes (as owner_id
-- and/or participant.user_ref) so the app can show that user their own reports.
ALTER TABLE users ADD COLUMN pair_code TEXT;
-- UNIQUE index (SQLite allows many NULLs) so codes don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pair_code ON users(pair_code);
