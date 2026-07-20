-- Migration 32: Persist dismissed Master Admin notifications.
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS dismissed_at DATETIME NULL AFTER read_at;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admin_notifications'
    AND INDEX_NAME = 'idx_admin_notifications_visible'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_admin_notifications_visible ON admin_notifications (admin_id, dismissed_at, is_read, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
