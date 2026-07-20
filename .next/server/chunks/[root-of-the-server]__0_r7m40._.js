module.exports=[449719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},814747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},120635,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},224361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},427699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},677652,(e,t,r)=>{t.exports=e.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},792509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},504446,(e,t,r)=>{t.exports=e.x("net",()=>require("net"))},688947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},500874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},406461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},254799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},951615,(e,t,r)=>{t.exports=e.x("node:buffer",()=>require("node:buffer"))},605365,(e,t,r)=>{t.exports=e.x("process",()=>require("process"))},755004,(e,t,r)=>{t.exports=e.x("tls",()=>require("tls"))},137464,(e,t,r)=>{t.exports=e.x("timers",()=>require("timers"))},99348,(e,t,r)=>{t.exports=e.x("string_decoder",()=>require("string_decoder"))},522734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},232074,e=>{"use strict";var t=e.i(843793);async function r(e,r,i){let s=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===s||"1"===s||"false"!==s&&"0"!==s)return;let[{total:u=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,r]);0===Number(u)&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${r.replace(/`/g,"``")}\` ${i}`)}async function i(e,r,i){let s=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===s||"1"===s||"false"!==s&&"0"!==s)return;let[{total:u=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);0===Number(u)&&await (0,t.query)(i)}async function s(e,r){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:s=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);Number(s)>0&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` DROP INDEX \`${r.replace(/`/g,"``")}\``)}async function u(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;await (0,t.query)(`
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
  `);let[u]=await (0,t.query)(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'category'
     LIMIT 1`);!u||u.COLUMN_TYPE.includes("'welcome'")&&u.COLUMN_TYPE.includes("'bandwidth'")||await (0,t.query)(`ALTER TABLE customer_notifications
       MODIFY COLUMN category ENUM('billing','support','product','subscription','storage','bandwidth','system','security','welcome')
       NOT NULL DEFAULT 'system'`),await (0,t.query)(`
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
  `),await (0,t.query)(`
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
  `),await (0,t.query)(`
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
  `),await (0,t.query)(`
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
  `),await (0,t.query)(`
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
  `),await r("products","tags","JSON NULL"),await r("products","deleted_at","DATETIME NULL"),await r("products","archived_at","DATETIME NULL"),await r("products","processing_error","VARCHAR(512) NULL"),await r("product_qr_codes","qr_uid","VARCHAR(64) NULL"),await r("product_qr_codes","name","VARCHAR(160) NOT NULL DEFAULT 'Main QR'"),await r("product_qr_codes","status","ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active'"),await r("product_qr_codes","expires_at","DATETIME NULL"),await r("product_qr_codes","deleted_at","DATETIME NULL"),await r("product_qr_codes","style_json","JSON NULL"),await (0,t.query)("UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = ''"),await s("product_qr_codes","uq_product_qr_product"),await i("product_qr_codes","idx_product_qr_product","CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)"),await i("product_qr_codes","uq_product_qr_uid","CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)"),await i("product_qr_codes","idx_product_qr_status","CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)"),await i("products","idx_products_customer_status","CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)"),await i("products","idx_products_customer_category","CREATE INDEX idx_products_customer_category ON products (customer_uid, category)"),await r("product_qr_codes","qr_code","VARCHAR(16) NULL"),await r("product_qr_codes","unique_scans","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await r("product_qr_codes","last_scan_at","DATETIME NULL"),await r("product_qr_codes","ar_launches","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await r("share_links","link_name","VARCHAR(160) NULL"),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS qr_code_sequence (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      next_val INT UNSIGNED NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)("INSERT IGNORE INTO qr_code_sequence (id, next_val) VALUES (1, 1)"),await (0,t.query)(`
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
  `),await (0,t.query)(`
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
  `),await i("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}e.s(["ensureUserPanelSchema",0,u])},895619,e=>{"use strict";var t=e.i(254799),r=e.i(843793),i=e.i(232074);async function s(e){await (0,i.ensureUserPanelSchema)();let s=`ntf-${(0,t.randomBytes)(8).toString("hex")}`,u=await (0,r.query)(`${e.dedupeKey?"INSERT IGNORE":"INSERT"} INTO customer_notifications
      (notification_uid, customer_uid, user_id, category, title, body, href, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[s,e.customerUid,e.userId??null,e.category,e.title,e.body,e.href??null,e.dedupeKey??null]);if(e.dedupeKey&&0===Number(u.affectedRows||0)){let t=await (0,r.query)(`SELECT notification_uid FROM customer_notifications
       WHERE customer_uid = ? AND dedupe_key = ? LIMIT 1`,[e.customerUid,e.dedupeKey]);return{skipped:!0,id:t[0]?.notification_uid||s}}return{created:!0,id:s}}let u={product:{inApp:!0,email:!0},billing:{inApp:!0,email:!0},subscription:{inApp:!0,email:!0},usage:{inApp:!0,email:!0},support:{inApp:!0,email:!0},security:{inApp:!0,email:!0},marketing:{inApp:!1,email:!1}};async function a(e){await (0,i.ensureUserPanelSchema)();let t=await (0,r.query)("SELECT email_notification_preferences_json FROM user_preferences WHERE user_id = ? LIMIT 1",[e]);if(!t[0]?.email_notification_preferences_json)return u;try{let e=JSON.parse(t[0].email_notification_preferences_json);return{product:{...u.product,...e.product},billing:{...u.billing,...e.billing},subscription:{...u.subscription,...e.subscription},usage:{...u.usage,...e.usage},support:{...u.support,...e.support},security:{...u.security,...e.security},marketing:{...u.marketing,...e.marketing}}}catch{return u}}async function o(e,t,s){await (0,i.ensureUserPanelSchema)();let u={...s,security:{inApp:!0,email:s.security.email}};return(await (0,r.query)("SELECT id FROM user_preferences WHERE user_id = ? LIMIT 1",[e])).length?await (0,r.query)("UPDATE user_preferences SET email_notification_preferences_json = ?, updated_at = NOW() WHERE user_id = ?",[JSON.stringify(u),e]):await (0,r.query)(`INSERT INTO user_preferences (user_id, customer_uid, email_notification_preferences_json)
       VALUES (?, ?, ?)`,[e,t,JSON.stringify(u)]),u}e.s(["createCustomerNotification",0,s,"getNotificationPreferences",0,a,"saveNotificationPreferences",0,o])},924868,(e,t,r)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},729698,e=>{"use strict";var t=e.i(522734),r=e.i(814747);let i=r.default.resolve(process.cwd(),"storage","Customers"),s=r.default.resolve(process.cwd(),"public","Storage","Customers");function u(e){try{return t.default.readdirSync(e).length>0}catch{return!1}}e.s(["DEFAULT_STORAGE_ROOT",0,i,"LEGACY_STORAGE_ROOT",0,s,"STORAGE_PUBLIC_PREFIX",0,"/Storage/Customers","resolveStorageRoot",0,function(){let e=process.env.STORAGE_ROOT?.trim();return e?r.default.resolve(e):u(i)?i:u(s)?s:i}])},345733,e=>{"use strict";var t=e.i(924868),r=e.i(814747),i=e.i(843793),s=e.i(578464);let u=/^[A-Za-z0-9_-]{1,180}$/;function a(e){let t=String(e||"").trim();return!t||!u.test(t)||t.includes("..")||t.includes("/")||t.includes("\\")?"":t}function o(e){return a(e.customerUid)}async function N(e,i){if(!a(e)||!a(i))return!1;try{let u=r.default.join((0,s.getProductFolder)(e,i),"product.json");return await t.default.access(u),!0}catch{return!1}}async function _(e){let t=o(e.user),r=a(e.productUid);if(!t||!r)return{ok:!1,customerUid:t,productUid:r,reason:"Invalid customer or product scope."};await (0,i.ensureProductSchema)();let s=await (0,i.query)(`SELECT id, customer_uid, user_id, status, deleted_at
     FROM products
     WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL)
     LIMIT 1`,[r,t,e.user.id]).catch(()=>[]);return s[0]?.deleted_at?{ok:!1,customerUid:t,productUid:r,reason:"Product is deleted."}:s[0]?{ok:!0,customerUid:t,productUid:r,product:s[0]}:!e.requireDbRow&&await N(t,r)?{ok:!0,customerUid:t,productUid:r,product:null}:{ok:!1,customerUid:t,productUid:r,reason:"Product ownership could not be verified."}}async function d(e){let t=a(e.customerUid),r=a(e.productUid);t&&r&&await (0,i.query)(`UPDATE products SET ${e.sqlSet}, updated_at = NOW() WHERE id = ? AND customer_uid = ?`,[...e.values,r,t])}e.s(["ACTIVE_PRODUCT_SQL",0,"deleted_at IS NULL","clientCustomerScopeIsValid",0,function(e,t){let r=o(e),i=a(t||"");return!!(r&&(!i||i===r))},"getSessionCustomerUid",0,o,"normalizeScopedId",0,a,"updateScopedProductRow",0,d,"verifyCustomerProductAccess",0,_])},533704,e=>{"use strict";var t=e.i(89171),r=e.i(666663),i=e.i(843793),s=e.i(345733);async function u(){let e=await (0,r.requireApiUser)();if(!e)return null;let t=(0,s.getSessionCustomerUid)(e);if(!t)return null;let u=(await (0,i.query)(`SELECT u.status AS user_status, c.status AS customer_status
     FROM users u
     INNER JOIN customers c ON c.user_id = u.id
     WHERE u.id = ? AND c.customer_uid = ?
     LIMIT 1`,[e.id,t]))[0];return u&&"Active"===u.user_status&&"Suspended"!==u.customer_status&&"Deleted"!==u.customer_status?{...e,customerUid:t,status:e.status??"Active"}:null}e.s(["rejectScopedApiUser",0,function(e="Login required."){return t.NextResponse.json({error:e},{status:401})},"requireScopedApiUser",0,u])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0_r7m40._.js.map