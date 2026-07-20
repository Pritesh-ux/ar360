module.exports=[853663,e=>{"use strict";var s=e.i(254799);let t=["facebook","twitter","instagram","tiktok","linkedin","pinterest","youtube","snapchat","reddit","whatsapp"];function i(e){return e.toISOString().slice(0,10)}e.s(["buildDateRange",0,function(e,s){let t=new Date,r=s??i(t);return{fromDate:e??i(new Date(t.getTime()-25056e5)),toDate:r}},"classifyReferrer",0,function(e,s){if(!e||""===e){try{let e=new URL(s),t=e.searchParams.get("utm_source");if(t)return t.toLowerCase();let i=e.searchParams.get("ref");if("qr"===i)return"qr"}catch{}return"direct"}try{let s=new URL(e).hostname.toLowerCase();if(t.some(e=>s.includes(e)))return"social";if(s.includes("google")||s.includes("bing")||s.includes("yahoo"))return"search";return s}catch{return"direct"}},"extractIp",0,function(e){let s=e.headers.get("x-forwarded-for");return s?s.split(",")[0].trim():e.headers.get("x-real-ip")??"unknown"},"hashIp",0,function(e){return(0,s.createHash)("sha256").update(e+(process.env.AUTH_SECRET??"ar360")).digest("hex").slice(0,32)},"parseBrowser",0,function(e){return/SamsungBrowser/i.test(e)?"Samsung Internet":/Edg\//i.test(e)?"Edge":/OPR\/|Opera/i.test(e)?"Opera":/Firefox/i.test(e)?"Firefox":/Chrome/i.test(e)&&!/Chromium/i.test(e)?"Chrome":/Safari/i.test(e)?"Safari":"unknown"},"parseDevice",0,function(e){let s=e.toLowerCase();return/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(s)?"tablet":/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(s)?"mobile":/windows|macintosh|linux|cros/i.test(s)?"desktop":"unknown"},"parseOS",0,function(e){return/iPhone|iPad|iPod/i.test(e)?"iOS":/Android/i.test(e)?"Android":/Windows/i.test(e)?"Windows":/Macintosh|Mac OS X/i.test(e)?"macOS":/CrOS/i.test(e)?"ChromeOS":/Linux/i.test(e)?"Linux":"unknown"}])},540312,e=>{"use strict";var s=e.i(843793);async function t(e,t,i,r){let o=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if(!r?.force&&("true"===o||"1"===o||"false"!==o&&"0"!==o))return;let[{total:a=0}={total:0}]=await (0,s.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,t]);0===Number(a)&&await (0,s.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${t.replace(/`/g,"``")}\` ${i}`)}let i=!1;async function r(){i||(await t("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1",{force:!0}),i=!0)}async function o(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();"true"!==e&&"1"!==e&&("false"===e||"0"===e)&&(await t("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1"),await t("customers","business_type","VARCHAR(80) NULL"),await t("customers","website","VARCHAR(255) NULL"),await t("customers","address_line1","VARCHAR(255) NULL"),await t("customers","state","VARCHAR(100) NULL"),await t("customers","city","VARCHAR(100) NULL"),await t("customers","postal_code","VARCHAR(20) NULL"),await t("customers","profile_image_url","TEXT NULL"),await t("customer_notifications","dedupe_key","VARCHAR(120) NULL"),await t("support_ticket_messages","is_internal","TINYINT(1) NOT NULL DEFAULT 0"),await (0,s.query)(`
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
  `),await (0,s.query)(`
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
  `),await (0,s.query)(`
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
  `),await (0,s.query)(`
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
  `))}e.s(["ensureAccountSchema",0,o,"ensureSessionVersionColumn",0,r])},441591,e=>{"use strict";var s=e.i(254799),t=e.i(843793),i=e.i(540312),r=e.i(853663);async function o(e){let o;await (0,i.ensureAccountSchema)();let a=`sess-${(0,s.randomBytes)(12).toString("hex")}`,u=e.request?.headers.get("user-agent")??"",n=(0,r.parseDevice)(u),c=(0,r.parseBrowser)(u),N=e.request?.headers.get("x-vercel-ip-country")??e.request?.headers.get("cf-ipcountry")??"",d=e.request?.headers.get("x-forwarded-for"),E=d?.split(",")[0]?.trim()||e.request?.headers.get("x-real-ip")||"";return await (0,t.query)(`INSERT INTO customer_sessions (session_uid, user_id, customer_uid, device, browser, country, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[a,e.userId,e.customerUid,n,c,N,(o=process.env.AUTH_SECRET||process.env.SESSION_SECRET||"dev-only-change-this-auth-secret",!E?"":(0,s.createHmac)("sha256",o).update(E).digest("hex").slice(0,64)),u.slice(0,255)]),a}async function a(e){await (0,t.query)("UPDATE customer_sessions SET last_active_at = NOW() WHERE session_uid = ? AND revoked_at IS NULL",[e])}async function u(e){await (0,i.ensureAccountSchema)();let s=await (0,t.query)("SELECT session_version FROM users WHERE id = ? LIMIT 1",[e]);return Number(s[0]?.session_version||1)}async function n(e){await (0,i.ensureAccountSchema)();let s=await u(e.userId);return(void 0===e.sessionVersion||e.sessionVersion===s)&&(!e.sessionUid||(await (0,t.query)("SELECT id FROM customer_sessions WHERE session_uid = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1",[e.sessionUid,e.userId])).length>0)}async function c(e){return await (0,i.ensureAccountSchema)(),(await (0,t.query)(`SELECT session_uid, device, browser, country, ip_hash, last_active_at, created_at
     FROM customer_sessions
     WHERE user_id = ? AND customer_uid = ? AND revoked_at IS NULL
     ORDER BY last_active_at DESC
     LIMIT 20`,[e.userId,e.customerUid])).map(s=>{var t;return{sessionUid:s.session_uid,device:s.device,browser:s.browser,country:s.country||"—",ipMasked:(t=s.ip_hash)?`${t.slice(0,6)}…${t.slice(-4)}`:"—",lastActiveAt:s.last_active_at,createdAt:s.created_at,isCurrent:s.session_uid===e.currentSessionUid}})}async function N(e){return await (0,i.ensureAccountSchema)(),0!==(await (0,t.query)(`UPDATE customer_sessions SET revoked_at = NOW()
     WHERE session_uid = ? AND user_id = ? AND customer_uid = ? AND revoked_at IS NULL`,[e.sessionUid,e.userId,e.customerUid])).affectedRows}async function d(e){return await (0,i.ensureAccountSchema)(),e.keepSessionUid?await (0,t.query)(`UPDATE customer_sessions SET revoked_at = NOW()
       WHERE user_id = ? AND customer_uid = ? AND session_uid <> ? AND revoked_at IS NULL`,[e.userId,e.customerUid,e.keepSessionUid]):await (0,t.query)(`UPDATE customer_sessions SET revoked_at = NOW()
       WHERE user_id = ? AND customer_uid = ? AND revoked_at IS NULL`,[e.userId,e.customerUid]),await (0,t.query)("UPDATE users SET session_version = session_version + 1 WHERE id = ?",[e.userId]),u(e.userId)}async function E(e){return await (0,t.query)("UPDATE users SET session_version = session_version + 1 WHERE id = ?",[e]),u(e)}e.s(["bumpSessionVersion",0,E,"createCustomerSessionRecord",0,o,"getUserSessionVersion",0,u,"isSessionValid",0,n,"listCustomerSessions",0,c,"revokeAllOtherSessions",0,d,"revokeCustomerSession",0,N,"touchCustomerSession",0,a])}];

//# sourceMappingURL=src_0if2gj8._.js.map