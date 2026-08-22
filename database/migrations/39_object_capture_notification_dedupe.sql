-- Make Object Capture/customer notification deduplication atomic under concurrent status updates.
DELETE older
FROM customer_notifications older
JOIN customer_notifications newer
  ON newer.customer_uid = older.customer_uid
 AND newer.dedupe_key = older.dedupe_key
 AND newer.id > older.id
WHERE older.dedupe_key IS NOT NULL;

SET @has_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND INDEX_NAME = 'idx_customer_notifications_dedupe');
SET @sql := IF(@has_idx > 0, 'ALTER TABLE customer_notifications DROP INDEX idx_customer_notifications_dedupe', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND INDEX_NAME = 'uq_customer_notifications_dedupe');
SET @sql := IF(@has_idx = 0, 'ALTER TABLE customer_notifications ADD UNIQUE INDEX uq_customer_notifications_dedupe (customer_uid, dedupe_key)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
