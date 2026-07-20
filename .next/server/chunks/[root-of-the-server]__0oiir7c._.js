module.exports=[232074,e=>{"use strict";var t=e.i(843793);async function r(e,r,i){let s=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===s||"1"===s||"false"!==s&&"0"!==s)return;let[{total:a=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,r]);0===Number(a)&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${r.replace(/`/g,"``")}\` ${i}`)}async function i(e,r,i){let s=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===s||"1"===s||"false"!==s&&"0"!==s)return;let[{total:a=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);0===Number(a)&&await (0,t.query)(i)}async function s(e,r){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:s=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);Number(s)>0&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` DROP INDEX \`${r.replace(/`/g,"``")}\``)}async function a(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;await (0,t.query)(`
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
  `);let[a]=await (0,t.query)(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'category'
     LIMIT 1`);!a||a.COLUMN_TYPE.includes("'welcome'")&&a.COLUMN_TYPE.includes("'bandwidth'")||await (0,t.query)(`ALTER TABLE customer_notifications
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
  `),await i("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}e.s(["ensureUserPanelSchema",0,a])},895619,e=>{"use strict";var t=e.i(254799),r=e.i(843793),i=e.i(232074);async function s(e){await (0,i.ensureUserPanelSchema)();let s=`ntf-${(0,t.randomBytes)(8).toString("hex")}`,a=await (0,r.query)(`${e.dedupeKey?"INSERT IGNORE":"INSERT"} INTO customer_notifications
      (notification_uid, customer_uid, user_id, category, title, body, href, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[s,e.customerUid,e.userId??null,e.category,e.title,e.body,e.href??null,e.dedupeKey??null]);if(e.dedupeKey&&0===Number(a.affectedRows||0)){let t=await (0,r.query)(`SELECT notification_uid FROM customer_notifications
       WHERE customer_uid = ? AND dedupe_key = ? LIMIT 1`,[e.customerUid,e.dedupeKey]);return{skipped:!0,id:t[0]?.notification_uid||s}}return{created:!0,id:s}}let a={product:{inApp:!0,email:!0},billing:{inApp:!0,email:!0},subscription:{inApp:!0,email:!0},usage:{inApp:!0,email:!0},support:{inApp:!0,email:!0},security:{inApp:!0,email:!0},marketing:{inApp:!1,email:!1}};async function n(e){await (0,i.ensureUserPanelSchema)();let t=await (0,r.query)("SELECT email_notification_preferences_json FROM user_preferences WHERE user_id = ? LIMIT 1",[e]);if(!t[0]?.email_notification_preferences_json)return a;try{let e=JSON.parse(t[0].email_notification_preferences_json);return{product:{...a.product,...e.product},billing:{...a.billing,...e.billing},subscription:{...a.subscription,...e.subscription},usage:{...a.usage,...e.usage},support:{...a.support,...e.support},security:{...a.security,...e.security},marketing:{...a.marketing,...e.marketing}}}catch{return a}}async function o(e,t,s){await (0,i.ensureUserPanelSchema)();let a={...s,security:{inApp:!0,email:s.security.email}};return(await (0,r.query)("SELECT id FROM user_preferences WHERE user_id = ? LIMIT 1",[e])).length?await (0,r.query)("UPDATE user_preferences SET email_notification_preferences_json = ?, updated_at = NOW() WHERE user_id = ?",[JSON.stringify(a),e]):await (0,r.query)(`INSERT INTO user_preferences (user_id, customer_uid, email_notification_preferences_json)
       VALUES (?, ?, ?)`,[e,t,JSON.stringify(a)]),a}e.s(["createCustomerNotification",0,s,"getNotificationPreferences",0,n,"saveNotificationPreferences",0,o])},814747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},120635,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},224361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},427699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},677652,(e,t,r)=>{t.exports=e.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},792509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},504446,(e,t,r)=>{t.exports=e.x("net",()=>require("net"))},688947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},500874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},406461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},254799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},951615,(e,t,r)=>{t.exports=e.x("node:buffer",()=>require("node:buffer"))},605365,(e,t,r)=>{t.exports=e.x("process",()=>require("process"))},755004,(e,t,r)=>{t.exports=e.x("tls",()=>require("tls"))},137464,(e,t,r)=>{t.exports=e.x("timers",()=>require("timers"))},99348,(e,t,r)=>{t.exports=e.x("string_decoder",()=>require("string_decoder"))},522734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},446786,(e,t,r)=>{t.exports=e.x("os",()=>require("os"))},233405,(e,t,r)=>{t.exports=e.x("child_process",()=>require("child_process"))},921517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},524836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},679594,(e,t,r)=>{t.exports=e.x("dns",()=>require("dns"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},832578,e=>{"use strict";var t=e.i(254799),r=e.i(843793);let i={companyName:"AR360",supportEmail:"support@ar360.com",gstNumber:"",currency:"INR",razorpayKeyId:"rzp_test_TAuEWF3IaCSVMp",razorpayKeySecret:process.env.RAZORPAY_KEY_SECRET||"",razorpayWebhookSecret:process.env.RAZORPAY_WEBHOOK_SECRET||"",razorpayMode:"live"===process.env.RAZORPAY_MODE?"live":"test",razorpayReconciliationEnabled:"false"!==process.env.RAZORPAY_RECONCILIATION_ENABLED,razorpayRolloutAllowlist:process.env.RAZORPAY_ROLLOUT_ALLOWLIST||"",razorpayKillSwitch:"true"===process.env.RAZORPAY_CHECKOUT_KILL_SWITCH,nativeSubscriptionCheckoutEnabled:"true"===process.env.RAZORPAY_NATIVE_SUBSCRIPTIONS,nativeSubscriptionRolloutPercent:Number(process.env.RAZORPAY_NATIVE_SUBSCRIPTION_ROLLOUT||0),legacyOneTimeRenewalsEnabled:"true"===process.env.RAZORPAY_LEGACY_RENEWALS,stripeKey:"",smtpHost:"",smtpEmail:"",smtpPort:587,smtpPassword:"",smtpEnabled:!0,resendEnabled:!!process.env.RESEND_API_KEY,resendApiKey:"",resendFromEmail:"",resendReplyTo:"",storageProvider:"Local",maxLoginAttempts:5,lockMinutes:30,autoDeleteExpiredData:!1,expiryWarningDays:7,storageWarningPercent:80,bandwidthWarningPercent:80,maintenanceMode:!1,emailNotifications:!0},s=new Set(["maxLoginAttempts","lockMinutes","expiryWarningDays","storageWarningPercent","bandwidthWarningPercent","smtpPort","nativeSubscriptionRolloutPercent"]),a=new Set(["autoDeleteExpiredData","maintenanceMode","emailNotifications","smtpEnabled","resendEnabled","nativeSubscriptionCheckoutEnabled","legacyOneTimeRenewalsEnabled","razorpayReconciliationEnabled","razorpayKillSwitch"]),n=new Set(["razorpayKeySecret","razorpayWebhookSecret","smtpPassword","resendApiKey","stripeKey"]);function o(){let e=process.env.BILLING_SETTINGS_ENCRYPTION_KEY||"";return e?t.default.createHash("sha256").update(e,"utf8").digest():null}function _(e){if(!e)return"";let r=o();if(!r)throw Error("BILLING_SETTINGS_ENCRYPTION_KEY is required before secrets can be persisted.");let i=t.default.randomBytes(12),s=t.default.createCipheriv("aes-256-gcm",r,i),a=Buffer.concat([s.update(e,"utf8"),s.final()]),n=s.getAuthTag();return`enc:v1:${i.toString("base64")}:${n.toString("base64")}:${a.toString("base64")}`}async function E(){await (0,r.ensureAppSchema)();let e=await (0,r.query)("SELECT setting_key, setting_value FROM platform_settings").catch(()=>[]),E={...i};for(let d of e)if(d.setting_key in E){var u,N;E[d.setting_key]=(u=d.setting_key,null==(N=d.setting_value)?i[u]:n.has(u)?function(e){if(!e.startsWith("enc:v1:"))return e;let r=o();if(!r)throw Error("BILLING_SETTINGS_ENCRYPTION_KEY is unavailable; encrypted billing settings cannot be read.");let[,,i,s,a]=e.split(":"),n=t.default.createDecipheriv("aes-256-gcm",r,Buffer.from(i,"base64"));return n.setAuthTag(Buffer.from(s,"base64")),Buffer.concat([n.update(Buffer.from(a,"base64")),n.final()]).toString("utf8")}(N):s.has(u)?Number(N||0):a.has(u)?"true"===N||"1"===N:N),n.has(d.setting_key)&&d.setting_value&&!d.setting_value.startsWith("enc:v1:")&&o()&&await (0,r.query)("UPDATE platform_settings SET setting_value = ?, is_secret = 1 WHERE setting_key = ?",[_(d.setting_value),d.setting_key])}return E}async function u(e){for(let[t,s]of(await (0,r.ensureAppSchema)(),Object.entries(e).filter(([e])=>e in i))){let e=n.has(t)?_(String(s??"")):String(s??"");await (0,r.query)(`INSERT INTO platform_settings (setting_key, setting_value, is_secret) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), is_secret=VALUES(is_secret), updated_at=NOW()`,[t,e,n.has(t)])}}async function N(){let e=await E();return{keyId:e.razorpayKeyId||process.env.RAZORPAY_KEY_ID||"rzp_test_TAuEWF3IaCSVMp",keySecret:e.razorpayKeySecret||process.env.RAZORPAY_KEY_SECRET||"",webhookSecret:e.razorpayWebhookSecret||process.env.RAZORPAY_WEBHOOK_SECRET||"",mode:e.razorpayMode}}e.s(["getPlatformSettings",0,E,"getRazorpayKeys",0,N,"savePlatformSettings",0,u])},576919,e=>{"use strict";var t=e.i(843793);async function r(){await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      recipient VARCHAR(191) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      template VARCHAR(120) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'sent',
      provider_message_id VARCHAR(191) NULL,
      error_message TEXT NULL,
      metadata JSON NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_email_logs_recipient (recipient),
      INDEX idx_email_logs_status (status),
      INDEX idx_email_logs_created (created_at),
      INDEX idx_email_logs_template (template)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)}async function i(e){try{await r(),await (0,t.query)(`INSERT INTO email_logs (recipient, subject, template, status, provider_message_id, error_message, metadata, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[e.recipient,e.subject,e.template||null,e.status,e.providerMessageId||null,e.errorMessage||null,JSON.stringify(e.metadata||{}),"sent"===e.status||"console"===e.status?new Date:null])}catch(e){console.warn("[email_log insert skipped]",e)}}e.s(["buildEmailLogWhere",0,function(e){let t=[],r=[],i=(e.search||"").trim().toLowerCase();if(i){t.push("(LOWER(recipient) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(COALESCE(template, '')) LIKE ?)");let e=`%${i}%`;r.push(e,e,e)}return e.status&&"all"!==e.status&&(t.push("status = ?"),r.push(e.status)),e.template&&"all"!==e.template&&(t.push("template = ?"),r.push(e.template)),e.dateFrom&&(t.push("DATE(created_at) >= ?"),r.push(e.dateFrom)),e.dateTo&&(t.push("DATE(created_at) <= ?"),r.push(e.dateTo)),{where:t.length?`WHERE ${t.join(" AND ")}`:"",values:r}},"ensureEmailLogsSchema",0,r,"writeEmailLog",0,i])},706424,e=>{"use strict";var t=e.i(832578);async function r(e){let r=void 0===e?await (0,t.getPlatformSettings)().catch(()=>null):e;if(r?.smtpEnabled===!1)return null;let i=process.env.SMTP_HOST?.trim()||r?.smtpHost?.trim()||"",s=process.env.SMTP_USER?.trim()||r?.smtpEmail?.trim()||"",a=process.env.SMTP_PASSWORD?.trim()||r?.smtpPassword?.trim()||"",n=process.env.SMTP_FROM?.trim()||r?.smtpEmail?.trim()||s||r?.supportEmail?.trim()||"";if(!i||!s||!a)return null;let o=Number(process.env.SMTP_PORT||r?.smtpPort||(i.includes("gmail"),587)),_="true"===String(process.env.SMTP_SECURE||"").toLowerCase()||465===o;return{host:i,port:o,secure:_,user:s,password:a,from:n||s}}async function i(){var e;let i=await (0,t.getPlatformSettings)(),[s,a]=await Promise.all([r(i),Promise.resolve(function(e){if(!e.resendEnabled)return null;let t=process.env.RESEND_API_KEY?.trim()||e.resendApiKey.trim(),r=process.env.RESEND_FROM_EMAIL?.trim()||process.env.EMAIL_FROM?.trim()||e.resendFromEmail.trim(),i=process.env.RESEND_REPLY_TO?.trim()||e.resendReplyTo.trim()||e.supportEmail.trim();return t&&r?{apiKey:t,from:r,replyTo:i||void 0}:null}(i))]),n=(e={emailEnabled:i.emailNotifications,smtpEnabled:i.smtpEnabled,smtpConfigured:!!s,resendEnabled:i.resendEnabled,resendConfigured:!!a}).emailEnabled?e.smtpEnabled&&e.smtpConfigured?"smtp":e.resendEnabled&&e.resendConfigured?"resend":"unconfigured":"disabled";return{settings:i,smtp:s,resend:a,activeProvider:n}}async function s(){let{smtp:e,resend:t,activeProvider:r}=await i();return"smtp"===r&&e?{provider:"smtp",smtp:e}:"resend"===r&&t?{provider:"resend",resend:t}:{provider:"disabled",reason:"disabled"===r?"disabled":"unconfigured"}}async function a(){let{settings:e,smtp:t,resend:r,activeProvider:s}=await i();return{emailEnabled:e.emailNotifications,activeProvider:s,smtp:{enabled:e.smtpEnabled,configured:!!t},resend:{enabled:e.resendEnabled,configured:!!r}}}e.s(["getEmailDeliveryStatus",0,a,"resolveEmailDeliveryConfig",0,s],706424)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0oiir7c._.js.map