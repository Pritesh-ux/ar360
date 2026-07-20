module.exports=[540312,e=>{"use strict";var t=e.i(843793);async function i(e,i,N,s){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if(!s?.force&&("true"===a||"1"===a||"false"!==a&&"0"!==a))return;let[{total:T=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,i]);0===Number(T)&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${i.replace(/`/g,"``")}\` ${N}`)}let N=!1;async function s(){N||(await i("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1",{force:!0}),N=!0)}async function a(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();"true"!==e&&"1"!==e&&("false"===e||"0"===e)&&(await i("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1"),await i("customers","business_type","VARCHAR(80) NULL"),await i("customers","website","VARCHAR(255) NULL"),await i("customers","address_line1","VARCHAR(255) NULL"),await i("customers","state","VARCHAR(100) NULL"),await i("customers","city","VARCHAR(100) NULL"),await i("customers","postal_code","VARCHAR(20) NULL"),await i("customers","profile_image_url","TEXT NULL"),await i("customer_notifications","dedupe_key","VARCHAR(120) NULL"),await i("support_ticket_messages","is_internal","TINYINT(1) NOT NULL DEFAULT 0"),await (0,t.query)(`
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
  `),await (0,t.query)(`
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
  `),await (0,t.query)(`
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
  `),await (0,t.query)(`
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
  `))}e.s(["ensureAccountSchema",0,a,"ensureSessionVersionColumn",0,s])},605766,e=>{"use strict";var t=e.i(254799),i=e.i(843793),N=e.i(540312);async function s(e){await (0,N.ensureAccountSchema)();let s=`act-${(0,t.randomBytes)(8).toString("hex")}`;await (0,i.query)(`INSERT INTO customer_activity_logs (activity_uid, customer_uid, user_id, event_type, title, detail, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[s,e.customerUid,e.userId??null,e.eventType,e.title,e.detail||"",e.meta?JSON.stringify(e.meta):null])}async function a(e){await (0,N.ensureAccountSchema)();let t=Math.max(1,e.page||1),s=Math.min(50,Math.max(1,e.pageSize||20)),[a,T]=await Promise.all([(0,i.query)(`SELECT activity_uid, event_type, title, detail, created_at
       FROM customer_activity_logs
       WHERE customer_uid = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,[e.customerUid,s,(t-1)*s]),(0,i.query)("SELECT COUNT(*) AS total FROM customer_activity_logs WHERE customer_uid = ?",[e.customerUid])]),L=Number(T[0]?.total||0);return{items:a.map(e=>({id:e.activity_uid,eventType:e.event_type,title:e.title,detail:e.detail,createdAt:e.created_at})),pagination:{page:t,pageSize:s,total:L,totalPages:Math.max(1,Math.ceil(L/s))}}}e.s(["listCustomerActivity",0,a,"writeCustomerActivity",0,s])}];

//# sourceMappingURL=src_lib_account_1dff8nx._.js.map