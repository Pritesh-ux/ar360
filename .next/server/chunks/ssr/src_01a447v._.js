module.exports=[41768,a=>{"use strict";var b=a.i(761469);async function c(a,c,d,e){let f=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if(!e?.force&&("true"===f||"1"===f||"false"!==f&&"0"!==f))return;let[{total:g=0}={total:0}]=await (0,b.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[a,c]);0===Number(g)&&await (0,b.query)(`ALTER TABLE \`${a.replace(/`/g,"``")}\` ADD COLUMN \`${c.replace(/`/g,"``")}\` ${d}`)}let d=!1;async function e(){d||(await c("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1",{force:!0}),d=!0)}async function f(){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();"true"!==a&&"1"!==a&&("false"===a||"0"===a)&&(await c("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1"),await c("customers","business_type","VARCHAR(80) NULL"),await c("customers","website","VARCHAR(255) NULL"),await c("customers","address_line1","VARCHAR(255) NULL"),await c("customers","state","VARCHAR(100) NULL"),await c("customers","city","VARCHAR(100) NULL"),await c("customers","postal_code","VARCHAR(20) NULL"),await c("customers","profile_image_url","TEXT NULL"),await c("customer_notifications","dedupe_key","VARCHAR(120) NULL"),await c("support_ticket_messages","is_internal","TINYINT(1) NOT NULL DEFAULT 0"),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `))}a.s(["ensureAccountSchema",0,f,"ensureSessionVersionColumn",0,e])},895710,a=>{"use strict";a.i(254799),a.s(["parseBrowser",0,function(a){return/SamsungBrowser/i.test(a)?"Samsung Internet":/Edg\//i.test(a)?"Edge":/OPR\/|Opera/i.test(a)?"Opera":/Firefox/i.test(a)?"Firefox":/Chrome/i.test(a)&&!/Chromium/i.test(a)?"Chrome":/Safari/i.test(a)?"Safari":"unknown"},"parseDevice",0,function(a){let b=a.toLowerCase();return/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(b)?"tablet":/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(b)?"mobile":/windows|macintosh|linux|cros/i.test(b)?"desktop":"unknown"}])},381200,a=>{"use strict";var b=a.i(254799),c=a.i(761469),d=a.i(41768),e=a.i(895710);async function f(a){let f;await (0,d.ensureAccountSchema)();let g=`sess-${(0,b.randomBytes)(12).toString("hex")}`,h=a.request?.headers.get("user-agent")??"",i=(0,e.parseDevice)(h),j=(0,e.parseBrowser)(h),k=a.request?.headers.get("x-vercel-ip-country")??a.request?.headers.get("cf-ipcountry")??"",l=a.request?.headers.get("x-forwarded-for"),m=l?.split(",")[0]?.trim()||a.request?.headers.get("x-real-ip")||"";return await (0,c.query)(`INSERT INTO customer_sessions (session_uid, user_id, customer_uid, device, browser, country, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[g,a.userId,a.customerUid,i,j,k,(f=process.env.AUTH_SECRET||process.env.SESSION_SECRET||"dev-only-change-this-auth-secret",!m?"":(0,b.createHmac)("sha256",f).update(m).digest("hex").slice(0,64)),h.slice(0,255)]),g}async function g(a){await (0,c.query)("UPDATE customer_sessions SET last_active_at = NOW() WHERE session_uid = ? AND revoked_at IS NULL",[a])}async function h(a){await (0,d.ensureAccountSchema)();let b=await (0,c.query)("SELECT session_version FROM users WHERE id = ? LIMIT 1",[a]);return Number(b[0]?.session_version||1)}async function i(a){await (0,d.ensureAccountSchema)();let b=await h(a.userId);return(void 0===a.sessionVersion||a.sessionVersion===b)&&(!a.sessionUid||(await (0,c.query)("SELECT id FROM customer_sessions WHERE session_uid = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1",[a.sessionUid,a.userId])).length>0)}a.s(["createCustomerSessionRecord",0,f,"getUserSessionVersion",0,h,"isSessionValid",0,i,"touchCustomerSession",0,g])}];

//# sourceMappingURL=src_01a447v._.js.map