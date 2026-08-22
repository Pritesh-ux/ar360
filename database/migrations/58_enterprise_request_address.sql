-- Migration 58: Address + state on Enterprise quote requests

ALTER TABLE enterprise_requests
  ADD COLUMN IF NOT EXISTS address VARCHAR(500) NULL AFTER company_website,
  ADD COLUMN IF NOT EXISTS state VARCHAR(120) NULL AFTER country;
