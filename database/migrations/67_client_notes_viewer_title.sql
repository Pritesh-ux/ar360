-- Client workspace simplifications: notes + viewer title for branding.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS viewer_title VARCHAR(180) NULL;
