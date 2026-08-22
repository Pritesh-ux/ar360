-- White-label "Powered by {name}" on workspace branding and per-client branding.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS powered_by_label VARCHAR(80) NULL;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS powered_by_label VARCHAR(80) NULL;
