-- Migration 20: Add unlimited storage/bandwidth columns
-- Idempotent

ALTER TABLE billing_plans ADD COLUMN unlimited_storage TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE billing_plans ADD COLUMN unlimited_bandwidth TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE customer_subscriptions ADD COLUMN unlimited_storage TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE customer_subscriptions ADD COLUMN unlimited_bandwidth TINYINT(1) NOT NULL DEFAULT 0;
