-- Migration 61: Site / website visitor analytics (marketing + app surfaces)
-- Separate from product analytics_events so Viewer Analytics KPIs stay clean.

CREATE TABLE IF NOT EXISTS site_visitors (
  visitor_id VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(40) NULL,
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  country VARCHAR(80) NOT NULL DEFAULT '',
  region VARCHAR(120) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  device_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
  os VARCHAR(20) NOT NULL DEFAULT 'unknown',
  screen_width SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  screen_height SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ip_hash VARCHAR(32) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visitor_id),
  INDEX idx_sv_last_seen (last_seen_at),
  INDEX idx_sv_customer (customer_uid),
  INDEX idx_sv_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_sessions (
  session_id VARCHAR(64) NOT NULL,
  visitor_id VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(40) NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  landing_page VARCHAR(512) NOT NULL DEFAULT '',
  exit_page VARCHAR(512) NULL,
  referrer VARCHAR(255) NOT NULL DEFAULT '',
  utm_source VARCHAR(120) NOT NULL DEFAULT '',
  utm_medium VARCHAR(120) NOT NULL DEFAULT '',
  utm_campaign VARCHAR(160) NOT NULL DEFAULT '',
  utm_term VARCHAR(160) NOT NULL DEFAULT '',
  utm_content VARCHAR(160) NOT NULL DEFAULT '',
  device_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
  os VARCHAR(20) NOT NULL DEFAULT 'unknown',
  country VARCHAR(80) NOT NULL DEFAULT '',
  region VARCHAR(120) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  page_view_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id),
  INDEX idx_ss_visitor (visitor_id),
  INDEX idx_ss_last_activity (last_activity_at),
  INDEX idx_ss_started (started_at),
  INDEX idx_ss_customer (customer_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_page_views (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(64) NOT NULL,
  visitor_id VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(40) NULL,
  path VARCHAR(512) NOT NULL,
  page_title VARCHAR(255) NOT NULL DEFAULT '',
  referrer VARCHAR(255) NOT NULL DEFAULT '',
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INT UNSIGNED NULL,
  utm_source VARCHAR(120) NOT NULL DEFAULT '',
  utm_medium VARCHAR(120) NOT NULL DEFAULT '',
  utm_campaign VARCHAR(160) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  INDEX idx_spv_session (session_id),
  INDEX idx_spv_visitor (visitor_id),
  INDEX idx_spv_viewed (viewed_at),
  INDEX idx_spv_path (path(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(64) NOT NULL DEFAULT '',
  visitor_id VARCHAR(64) NOT NULL DEFAULT '',
  customer_uid VARCHAR(40) NULL,
  event VARCHAR(60) NOT NULL,
  path VARCHAR(512) NOT NULL DEFAULT '',
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_se_created (created_at),
  INDEX idx_se_event (event),
  INDEX idx_se_visitor (visitor_id),
  INDEX idx_se_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
