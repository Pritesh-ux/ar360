-- Per-client toggle: show only assigned products in the public AR viewer catalog sidebar.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS viewer_catalog_enabled TINYINT(1) NOT NULL DEFAULT 0;
