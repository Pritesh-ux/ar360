-- Migration 31: align customer notification categories with runtime producers.
-- MODIFY is idempotent and preserves existing values while extending the ENUM.
ALTER TABLE customer_notifications
  MODIFY COLUMN category ENUM(
    'billing',
    'support',
    'product',
    'subscription',
    'storage',
    'bandwidth',
    'system',
    'security',
    'welcome'
  ) NOT NULL DEFAULT 'system';
