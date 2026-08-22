-- Phone verification flag + OTP metadata for customer settings.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS phone_verified TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_verify_code VARCHAR(12) NULL,
  ADD COLUMN IF NOT EXISTS phone_verify_expires_at DATETIME NULL;
