-- Migration 59: Widen product_qr_codes.qr_code for slug-style public IDs
-- Live error: Data too long for column 'qr_code' (varchar(16) vs e.g. lapo-wh-01-TD8NM9)

ALTER TABLE product_qr_codes
  MODIFY COLUMN qr_code VARCHAR(64) NULL;
