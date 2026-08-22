-- First-time free trial welcome popup dismiss flag (dashboard).
ALTER TABLE customer_onboarding
  ADD COLUMN IF NOT EXISTS welcome_popup_dismissed_at DATETIME NULL;
