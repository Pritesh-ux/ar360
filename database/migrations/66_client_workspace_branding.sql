-- Per-client branding for Product-first Client Workspace.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS logo_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS brand_primary VARCHAR(20) NULL DEFAULT '#C6FF32',
  ADD COLUMN IF NOT EXISTS brand_theme VARCHAR(40) NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS branding_json JSON NULL;
