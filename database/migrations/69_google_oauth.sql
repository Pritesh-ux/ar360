-- Google OAuth identity for customer accounts.
-- DEFERRED: schema only — no /api/auth/google* routes ship yet.
-- Do not enable Google login in prod docs until OAuth routes exist.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'password';

ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub ON users (google_sub);
