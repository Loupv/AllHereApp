-- One active email OTP per address (a new request replaces the old).
CREATE TABLE IF NOT EXISTS email_otps (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,      -- sha256(email:code), never the plaintext code
  expires_at  INTEGER NOT NULL,   -- epoch ms
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
