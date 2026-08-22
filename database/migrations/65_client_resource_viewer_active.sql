-- Per-assignment flag: only viewer_active=1 products appear in client AR catalog.
-- Scoped by client_uid so clients never share / mix product visibility.
ALTER TABLE client_resources
  ADD COLUMN IF NOT EXISTS viewer_active TINYINT(1) NOT NULL DEFAULT 1;
