-- Per-client plan window and optional public showroom link expiry.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_starts_at DATE NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_expires_at DATE NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS link_expires_at DATE NULL;
