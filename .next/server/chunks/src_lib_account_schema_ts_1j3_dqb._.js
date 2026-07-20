module.exports=[540312,e=>{"use strict";var N=e.i(843793);async function t(e,t,L,T){let s=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if(!T?.force&&("true"===s||"1"===s||"false"!==s&&"0"!==s))return;let[{total:E=0}={total:0}]=await (0,N.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,t]);0===Number(E)&&await (0,N.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${t.replace(/`/g,"``")}\` ${L}`)}let L=!1;async function T(){L||(await t("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1",{force:!0}),L=!0)}async function s(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();"true"!==e&&"1"!==e&&("false"===e||"0"===e)&&(await t("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1"),await t("customers","business_type","VARCHAR(80) NULL"),await t("customers","website","VARCHAR(255) NULL"),await t("customers","address_line1","VARCHAR(255) NULL"),await t("customers","state","VARCHAR(100) NULL"),await t("customers","city","VARCHAR(100) NULL"),await t("customers","postal_code","VARCHAR(20) NULL"),await t("customers","profile_image_url","TEXT NULL"),await t("customer_notifications","dedupe_key","VARCHAR(120) NULL"),await t("support_ticket_messages","is_internal","TINYINT(1) NOT NULL DEFAULT 0"),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS customer_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      device VARCHAR(40) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(60) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      ip_hash VARCHAR(64) NOT NULL DEFAULT '',
      user_agent VARCHAR(255) NOT NULL DEFAULT '',
      last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_sessions_uid (session_uid),
      INDEX idx_customer_sessions_user (user_id, revoked_at),
      INDEX idx_customer_sessions_customer (customer_uid, last_active_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS customer_activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      activity_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(60) NOT NULL,
      title VARCHAR(255) NOT NULL,
      detail VARCHAR(512) NOT NULL DEFAULT '',
      meta_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_activity_uid (activity_uid),
      INDEX idx_customer_activity_customer (customer_uid, created_at),
      INDEX idx_customer_activity_type (event_type, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS data_export_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending','processing','ready','failed','expired') NOT NULL DEFAULT 'pending',
      file_path VARCHAR(512) NULL,
      error_message VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      expires_at DATETIME NULL,
      UNIQUE KEY uq_data_export_uid (request_uid),
      INDEX idx_data_export_customer (customer_uid, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,N.query)(`
    CREATE TABLE IF NOT EXISTS account_deletion_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending','approved','cancelled','completed') NOT NULL DEFAULT 'pending',
      reason VARCHAR(512) NULL,
      scheduled_for DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelled_at DATETIME NULL,
      completed_at DATETIME NULL,
      UNIQUE KEY uq_deletion_request_uid (request_uid),
      INDEX idx_deletion_request_customer (customer_uid, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `))}e.s(["ensureAccountSchema",0,s,"ensureSessionVersionColumn",0,T])}];

//# sourceMappingURL=src_lib_account_schema_ts_1j3_dqb._.js.map