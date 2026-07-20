module.exports=[449719,(e,r,t)=>{r.exports=e.x("assert",()=>require("assert"))},814747,(e,r,t)=>{r.exports=e.x("path",()=>require("path"))},918622,(e,r,t)=>{r.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,r,t)=>{r.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,r,t)=>{r.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},120635,(e,r,t)=>{r.exports=e.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},324725,(e,r,t)=>{r.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},224361,(e,r,t)=>{r.exports=e.x("util",()=>require("util"))},427699,(e,r,t)=>{r.exports=e.x("events",()=>require("events"))},677652,(e,r,t)=>{r.exports=e.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},792509,(e,r,t)=>{r.exports=e.x("url",()=>require("url"))},504446,(e,r,t)=>{r.exports=e.x("net",()=>require("net"))},688947,(e,r,t)=>{r.exports=e.x("stream",()=>require("stream"))},500874,(e,r,t)=>{r.exports=e.x("buffer",()=>require("buffer"))},406461,(e,r,t)=>{r.exports=e.x("zlib",()=>require("zlib"))},254799,(e,r,t)=>{r.exports=e.x("crypto",()=>require("crypto"))},951615,(e,r,t)=>{r.exports=e.x("node:buffer",()=>require("node:buffer"))},605365,(e,r,t)=>{r.exports=e.x("process",()=>require("process"))},755004,(e,r,t)=>{r.exports=e.x("tls",()=>require("tls"))},137464,(e,r,t)=>{r.exports=e.x("timers",()=>require("timers"))},99348,(e,r,t)=>{r.exports=e.x("string_decoder",()=>require("string_decoder"))},522734,(e,r,t)=>{r.exports=e.x("fs",()=>require("fs"))},193695,(e,r,t)=>{r.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},232074,e=>{"use strict";var r=e.i(843793);async function t(e,t,s){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:a=0}={total:0}]=await (0,r.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,t]);0===Number(a)&&await (0,r.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${t.replace(/`/g,"``")}\` ${s}`)}async function s(e,t,s){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:a=0}={total:0}]=await (0,r.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,t]);0===Number(a)&&await (0,r.query)(s)}async function i(e,t){let s=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===s||"1"===s||"false"!==s&&"0"!==s)return;let[{total:i=0}={total:0}]=await (0,r.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,t]);Number(i)>0&&await (0,r.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` DROP INDEX \`${t.replace(/`/g,"``")}\``)}async function a(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS customer_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      notification_uid VARCHAR(80) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      category ENUM('billing','support','product','subscription','storage','bandwidth','system','security','welcome') NOT NULL DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      body VARCHAR(512) NOT NULL DEFAULT '',
      href VARCHAR(512) NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_customer_notifications_uid (notification_uid),
      INDEX idx_customer_notifications_customer_read (customer_uid, is_read),
      INDEX idx_customer_notifications_user_read (user_id, is_read),
      INDEX idx_customer_notifications_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);let[a]=await (0,r.query)(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'category'
     LIMIT 1`);!a||a.COLUMN_TYPE.includes("'welcome'")&&a.COLUMN_TYPE.includes("'bandwidth'")||await (0,r.query)(`ALTER TABLE customer_notifications
       MODIFY COLUMN category ENUM('billing','support','product','subscription','storage','bandwidth','system','security','welcome')
       NOT NULL DEFAULT 'system'`),await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(64) NOT NULL DEFAULT '',
      theme VARCHAR(32) NOT NULL DEFAULT 'light',
      default_product_view ENUM('grid','list') NOT NULL DEFAULT 'grid',
      items_per_page INT UNSIGNED NOT NULL DEFAULT 12,
      date_format VARCHAR(32) NOT NULL DEFAULT 'dmy',
      language VARCHAR(16) NOT NULL DEFAULT 'en',
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
      email_notification_preferences_json JSON NULL,
      dashboard_preferences_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_preferences_user (user_id),
      INDEX idx_user_preferences_customer (customer_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS share_links (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      share_uid VARCHAR(80) NOT NULL,
      public_id VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      product_id VARCHAR(160) NOT NULL,
      link_type ENUM('public','qr','embed','email') NOT NULL DEFAULT 'public',
      slug VARCHAR(120) NULL,
      token VARCHAR(64) NOT NULL,
      destination_url TEXT NOT NULL,
      status ENUM('active','expired','archived','disabled') NOT NULL DEFAULT 'active',
      expires_at DATETIME NULL,
      password_hash VARCHAR(255) NULL,
      allowed_domains_json JSON NULL,
      viewer_config_json JSON NULL,
      view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      qr_scan_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_share_links_uid (share_uid),
      UNIQUE KEY uq_share_links_public (public_id),
      UNIQUE KEY uq_share_links_token (token),
      INDEX idx_share_links_customer_status (customer_uid, status),
      INDEX idx_share_links_product (product_id),
      INDEX idx_share_links_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS share_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      share_link_id BIGINT UNSIGNED NOT NULL,
      share_uid VARCHAR(80) NOT NULL DEFAULT '',
      customer_uid VARCHAR(64) NOT NULL DEFAULT '',
      product_id VARCHAR(160) NOT NULL DEFAULT '',
      event_type VARCHAR(40) NOT NULL,
      anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
      referrer VARCHAR(255) NOT NULL DEFAULT '',
      device VARCHAR(20) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      duration_seconds INT UNSIGNED NULL,
      meta JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_share_events_share_created (share_link_id, created_at),
      INDEX idx_share_events_customer_created (customer_uid, created_at),
      INDEX idx_share_events_product_created (product_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS qr_scan_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      qr_code_id BIGINT UNSIGNED NOT NULL,
      qr_uid VARCHAR(64) NOT NULL DEFAULT '',
      customer_uid VARCHAR(64) NOT NULL DEFAULT '',
      product_id VARCHAR(160) NOT NULL DEFAULT '',
      anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
      device VARCHAR(20) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      source VARCHAR(40) NOT NULL DEFAULT 'qr',
      referrer VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_qr_scan_events_qr_created (qr_code_id, created_at),
      INDEX idx_qr_scan_events_customer_created (customer_uid, created_at),
      INDEX idx_qr_scan_events_session_qr (anonymous_session_id, qr_code_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      payment_method_uid VARCHAR(80) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
      provider_customer_id VARCHAR(191) NULL,
      provider_payment_method_id VARCHAR(191) NOT NULL,
      brand VARCHAR(32) NOT NULL DEFAULT '',
      last_four VARCHAR(4) NOT NULL DEFAULT '',
      exp_month TINYINT UNSIGNED NULL,
      exp_year SMALLINT UNSIGNED NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      status ENUM('active','expired','removed') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_payment_methods_uid (payment_method_uid),
      INDEX idx_payment_methods_customer_default (customer_uid, is_default),
      INDEX idx_payment_methods_provider_ref (provider, provider_payment_method_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await t("products","tags","JSON NULL"),await t("products","deleted_at","DATETIME NULL"),await t("products","archived_at","DATETIME NULL"),await t("products","processing_error","VARCHAR(512) NULL"),await t("product_qr_codes","qr_uid","VARCHAR(64) NULL"),await t("product_qr_codes","name","VARCHAR(160) NOT NULL DEFAULT 'Main QR'"),await t("product_qr_codes","status","ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active'"),await t("product_qr_codes","expires_at","DATETIME NULL"),await t("product_qr_codes","deleted_at","DATETIME NULL"),await t("product_qr_codes","style_json","JSON NULL"),await (0,r.query)("UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = ''"),await i("product_qr_codes","uq_product_qr_product"),await s("product_qr_codes","idx_product_qr_product","CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)"),await s("product_qr_codes","uq_product_qr_uid","CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)"),await s("product_qr_codes","idx_product_qr_status","CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)"),await s("products","idx_products_customer_status","CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)"),await s("products","idx_products_customer_category","CREATE INDEX idx_products_customer_category ON products (customer_uid, category)"),await t("product_qr_codes","qr_code","VARCHAR(16) NULL"),await t("product_qr_codes","unique_scans","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await t("product_qr_codes","last_scan_at","DATETIME NULL"),await t("product_qr_codes","ar_launches","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await t("share_links","link_name","VARCHAR(160) NULL"),await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS qr_code_sequence (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      next_val INT UNSIGNED NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,r.query)("INSERT IGNORE INTO qr_code_sequence (id, next_val) VALUES (1, 1)"),await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS product_embed_configs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      product_id VARCHAR(160) NOT NULL,
      public_id VARCHAR(180) NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      allowed_domains_json JSON NULL,
      view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      unique_visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
      last_view_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_embed_product (product_id),
      INDEX idx_embed_customer (customer_uid),
      INDEX idx_embed_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,r.query)(`
    CREATE TABLE IF NOT EXISTS embed_view_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      embed_config_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      product_id VARCHAR(160) NOT NULL,
      anonymous_session_id VARCHAR(64) NOT NULL DEFAULT '',
      referrer_domain VARCHAR(255) NOT NULL DEFAULT '',
      device VARCHAR(20) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(40) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      duration_seconds INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_embed_events_config (embed_config_id, created_at),
      INDEX idx_embed_events_customer (customer_uid, created_at),
      INDEX idx_embed_events_product (product_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await s("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}e.s(["ensureUserPanelSchema",0,a])},924868,(e,r,t)=>{r.exports=e.x("fs/promises",()=>require("fs/promises"))},729698,e=>{"use strict";var r=e.i(522734),t=e.i(814747);let s=t.default.resolve(process.cwd(),"storage","Customers"),i=t.default.resolve(process.cwd(),"public","Storage","Customers");function a(e){try{return r.default.readdirSync(e).length>0}catch{return!1}}e.s(["DEFAULT_STORAGE_ROOT",0,s,"LEGACY_STORAGE_ROOT",0,i,"STORAGE_PUBLIC_PREFIX",0,"/Storage/Customers","resolveStorageRoot",0,function(){let e=process.env.STORAGE_ROOT?.trim();return e?t.default.resolve(e):a(s)?s:a(i)?i:s}])},847427,e=>{"use strict";var r=e.i(843793);async function t(e){let t=await (0,r.query)("SELECT user_id FROM customers WHERE customer_uid = ? LIMIT 1",[e]);return t[0]?.user_id||null}async function s(e,s){let i=await t(e);return!!i&&(await (0,r.query)(`SELECT id FROM user_addons
      WHERE user_id = ?
        AND addon_slug = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,[i,s])).length>0}async function i(e){return s(e,"client-management")}async function a(e){return s(e,"team-management")}function _(e,r){let t=String(e||"").trim().toLowerCase(),s=!!r.business_available,i=!!r.enterprise_available,a=!!r.custom_available;return"business"===t?s:"enterprise"===t||"agency"===t?i:!!t.startsWith("ecp_")&&a}async function o(e,s){let i=await t(e),[a,o]=await Promise.all([(0,r.query)("SELECT * FROM addon_modules WHERE enabled = TRUE AND status = 'active' ORDER BY sort_order ASC"),i?(0,r.query)(`SELECT * FROM user_addons
            WHERE user_id = ?
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > NOW())`,[i]):Promise.resolve([])]),u=new Set(o.map(e=>e.addon_slug)),n=String(s||"").trim().toLowerCase();return a.filter(e=>n&&"starter"!==n&&"trial"!==n&&"free"!==n&&"pro"!==n&&_(n,e)||u.has(e.slug)).map(e=>({...e,purchased:u.has(e.slug),activeAddonDetails:o.find(r=>r.addon_slug===e.slug)||null}))}async function u(){return(0,r.query)("SELECT * FROM addon_modules ORDER BY sort_order ASC, id ASC")}async function n(e,t){let s=[],i=[];for(let[e,r]of Object.entries(t))void 0!==r&&(s.push(`${e} = ?`),"boolean"==typeof r?i.push(+!!r):i.push(r));s.length&&(i.push(e),await (0,r.query)(`UPDATE addon_modules SET ${s.join(", ")}, updated_at = NOW() WHERE slug = ?`,i))}async function N(e=100){return(0,r.query)(`SELECT ua.id, ua.user_id, ua.addon_slug, ua.status, ua.billing_type, ua.activated_at, ua.expires_at,
            c.customer_uid,
            COALESCE(NULLIF(TRIM(c.company_name), ''), c.contact_name) AS customer_name,
            c.email
       FROM user_addons ua
       LEFT JOIN customers c ON c.user_id = ua.user_id
      ORDER BY ua.activated_at DESC
      LIMIT ?`,[e])}let d=["client-management","team-management"];function E(e){return d.includes(e)}async function T(e){let s=await t(e),[i,a]=await Promise.all([u(),s?(0,r.query)("SELECT * FROM user_addons WHERE user_id = ? ORDER BY activated_at DESC",[s]):Promise.resolve([])]);return i.map(e=>{let r=a.find(r=>r.addon_slug===e.slug)||null;return{slug:e.slug,name:e.name,description:e.description,monthly_price:e.monthly_price,yearly_price:e.yearly_price,active:!!r&&"active"===r.status&&(!r.expires_at||new Date(r.expires_at).getTime()>Date.now()),license:r}})}function c(e){return e.toISOString().slice(0,19).replace("T"," ")}async function L(e){let s=String(e.slug||"").trim();if(!E(s))throw Error("Unknown add-on slug.");let i=await t(e.customerUid);if(!i)throw Error("Customer owner account not found.");let a=String(e.billingType||"manual").trim()||"manual",_=null;if(null===e.expiresAt)_=null;else if(e.expiresAt instanceof Date)_=c(e.expiresAt);else if("string"==typeof e.expiresAt&&e.expiresAt.trim()){let r=new Date(e.expiresAt);if(Number.isNaN(r.getTime()))throw Error("Invalid expiresAt.");_=c(r)}else if("yearly"===a){let e=new Date;e.setFullYear(e.getFullYear()+1),_=c(e)}else if("monthly"===a){let e=new Date;e.setMonth(e.getMonth()+1),_=c(e)}else _=null;return await (0,r.query)(`INSERT INTO user_addons (user_id, addon_slug, status, billing_type, activated_at, expires_at)
     VALUES (?, ?, 'active', ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       status = 'active',
       billing_type = VALUES(billing_type),
       activated_at = NOW(),
       expires_at = VALUES(expires_at)`,[i,s,a,_]),T(e.customerUid)}async function A(e){let s=String(e.slug||"").trim();if(!E(s))throw Error("Unknown add-on slug.");let i=await t(e.customerUid);if(!i)throw Error("Customer owner account not found.");return await (0,r.query)(`UPDATE user_addons
        SET status = 'revoked', updated_at = NOW()
      WHERE user_id = ? AND addon_slug = ?`,[i,s]),T(e.customerUid)}e.s(["KNOWN_ADDON_SLUGS",0,d,"getAddonsForCustomer",0,o,"getCustomerAddonLicenses",0,T,"getCustomerOwnerUserId",0,t,"grantUserAddon",0,L,"hasClientAddon",0,i,"hasTeamAddon",0,a,"isKnownAddonSlug",0,E,"isPlanEligibleForAddon",0,_,"listAddonLicenses",0,N,"listAllAddonModules",0,u,"revokeUserAddon",0,A,"updateAddonModule",0,n])},778359,e=>{e.v(e=>Promise.resolve().then(()=>e(232074)))},578878,e=>{e.v(r=>Promise.all(["server/chunks/src_lib_account_schema_ts_1j3_dqb._.js"].map(r=>e.l(r))).then(()=>r(540312)))},573857,e=>{e.v(r=>Promise.all(["server/chunks/src_lib_enterprise_schema_ts_1jy6kif._.js"].map(r=>e.l(r))).then(()=>r(16006)))},828945,e=>{e.v(r=>Promise.all(["server/chunks/src_server_billing_subscription_repository_ts_1jy9o2x._.js","server/chunks/[root-of-the-server]__0p1lzkm._.js","server/chunks/src_lib_billing_admin-plans_ts_0x3-cc7._.js","server/chunks/_19_dh32._.js"].map(r=>e.l(r))).then(()=>r(281579)))},871964,e=>{e.v(r=>Promise.all(["server/chunks/src_server_billing_0ly118q._.js","server/chunks/src_1a62-pf._.js","server/chunks/[root-of-the-server]__0m1ltgd._.js","server/chunks/src_lib_enterprise-sales_repository_ts_0pj3ujk._.js","server/chunks/src_lib_billing_admin-plans_ts_0x3-cc7._.js","server/chunks/_19_dh32._.js","server/chunks/[root-of-the-server]__0p1lzkm._.js","server/chunks/_0652v3l._.js"].map(r=>e.l(r))).then(()=>r(476188)))},283560,e=>{e.v(r=>Promise.all(["server/chunks/src_lib_account_01ev2lk._.js"].map(r=>e.l(r))).then(()=>r(441591)))},375938,e=>{e.v(r=>Promise.all(["server/chunks/src_lib_account_1dff8nx._.js"].map(r=>e.l(r))).then(()=>r(605766)))},436913,e=>{e.v(r=>Promise.all(["server/chunks/src_lib_account_notify_service_ts_14exmkl._.js"].map(r=>e.l(r))).then(()=>r(895619)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1ead40c._.js.map