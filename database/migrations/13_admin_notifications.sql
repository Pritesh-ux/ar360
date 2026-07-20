-- Migration 13: Master Admin notifications (bell + activity feed)
-- Idempotent

CREATE TABLE IF NOT EXISTS admin_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_uid VARCHAR(80) NOT NULL,
  admin_id BIGINT UNSIGNED NULL,
  category ENUM('billing','support','customer','product','system','security') NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  body VARCHAR(512) NOT NULL DEFAULT '',
  href VARCHAR(512) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_notifications_uid (notification_uid),
  INDEX idx_admin_notifications_admin_read (admin_id, is_read),
  INDEX idx_admin_notifications_created (created_at),
  INDEX idx_admin_notifications_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
