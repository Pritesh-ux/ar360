-- Migration 14: Support ticket message threads for master admin

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_uid VARCHAR(64) NOT NULL,
  author_type ENUM('admin','customer','system') NOT NULL DEFAULT 'admin',
  author_name VARCHAR(191) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ticket_messages_ticket (ticket_uid),
  INDEX idx_ticket_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
