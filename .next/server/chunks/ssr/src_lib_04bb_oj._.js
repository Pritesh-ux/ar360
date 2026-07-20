module.exports=[749016,a=>{"use strict";function b(a){return!!a.trialEndsAt&&Date.now()>new Date(a.trialEndsAt).getTime()}function c(a,c){if(!a.allowViewer)return{allowed:!1,reason:"Viewer is disabled for your current plan.",upgradeRequired:!0,limitType:"status"};if("free"===a.planId||"trial"===a.planId){if(b(c))return{allowed:!1,reason:"This trial viewer has expired. Upgrade to reactivate the public viewer.",upgradeRequired:!0,trialExpired:!0,limitType:"trial"};if(c.productsUsed>1)return{allowed:!1,reason:"Trial limit exceeded. You have more than 1 product. Upgrade to reactivate the viewer.",upgradeRequired:!0,limitType:"products"}}let d=function(a,b){if(a.unlimitedBandwidth)return{allowed:!0};let c=Number(a.bandwidthGb||0),d=Number(b.bandwidthUsedGb??0);return c>0&&d>=c?{allowed:!1,reason:"Monthly bandwidth limit reached. Upgrade your plan to restore viewer access.",upgradeRequired:!0,limitType:"bandwidth"}:{allowed:!0}}(a,c);return d.allowed?{allowed:!0}:d}a.s(["DEFAULT_PLAN_LIMITS",0,{trial:{planId:"trial",name:"Free Trial",products:1,storageMb:100,bandwidthGb:1,trialHours:24,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!1,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},starter:{planId:"starter",name:"Starter",products:5,storageMb:512,bandwidthGb:5,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!1,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},pro:{planId:"pro",name:"Pro",products:50,storageMb:5120,bandwidthGb:50,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},business:{planId:"business",name:"Business",products:250,storageMb:25600,bandwidthGb:250,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!0,unlimitedStorage:!1,unlimitedBandwidth:!1},enterprise:{planId:"enterprise",name:"Enterprise",products:250,storageMb:25600,bandwidthGb:250,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!0,unlimitedStorage:!1,unlimitedBandwidth:!1}},"checkArEntitlement",0,function(a,b){return!1===a.allowAr?{allowed:!1,reason:"AR is not included in your current plan. Upgrade to unlock AR.",upgradeRequired:!0,limitType:"status"}:c(a,b)},"checkEmbedEntitlement",0,function(a,b){return!1===a.allowEmbed?{allowed:!1,reason:"Embed viewer is not available on your current plan. Upgrade to Professional or higher.",upgradeRequired:!0,limitType:"status"}:c(a,b)},"checkEnterpriseArExperienceEntitlement",0,function(a,b){return!a.isEnterpriseCustom||null==a.arExperienceLimit||b<a.arExperienceLimit?{allowed:!0}:{allowed:!1,code:"AR_EXPERIENCE_LIMIT_REACHED",reason:`You have reached your ${a.arExperienceLimit}-AR-experience limit. Contact support to increase your Enterprise allowance.`,upgradeRequired:!0,limitType:"ar_experiences"}},"checkEnterpriseModelEntitlement",0,function(a,b){return!a.isEnterpriseCustom||null==a.modelLimit||b<a.modelLimit?{allowed:!0}:{allowed:!1,code:"MODEL_LIMIT_REACHED",reason:`You have reached your ${a.modelLimit}-model limit. Contact support to increase your Enterprise allowance.`,upgradeRequired:!0,limitType:"models"}},"checkQrEntitlement",0,function(a,b){if(!1===a.allowQr)return{allowed:!1,reason:"QR codes are not included in your current plan.",upgradeRequired:!0,limitType:"qr"};let d=c(a,b);if(!d.allowed)return d;let e=Number(b.qrCodesUsed??b.productsUsed??0);return null!=a.qrCodes&&e>=Number(a.qrCodes)?{allowed:!1,reason:`QR code limit reached (${a.qrCodes}). Upgrade your plan for more QR codes.`,upgradeRequired:!0,limitType:"qr"}:{allowed:!0}},"checkShareEntitlement",0,function(a,b){if(!1===a.allowShare)return{allowed:!1,reason:"Share links are not included in your current plan.",upgradeRequired:!0,limitType:"share"};let d=c(a,b);return d.allowed?null!=a.shareLinks&&Number(b.shareLinksUsed??0)>=Number(a.shareLinks)?{allowed:!1,reason:`Share link limit reached (${a.shareLinks}). Upgrade your plan for more share links.`,upgradeRequired:!0,limitType:"share"}:{allowed:!0}:d},"checkUploadEntitlement",0,function(a,c,d=!1,e=0){if(!a.allowUpload)return{allowed:!1,reason:"Upload is not available on your current plan.",upgradeRequired:!0,limitType:"status"};if("free"===a.planId||"trial"===a.planId){if(b(c))return{allowed:!1,reason:"Your 24 hours trial has expired. Upgrade to continue uploading or editing products.",upgradeRequired:!0,trialExpired:!0,limitType:"trial"};if(c.productsUsed>1)return{allowed:!1,reason:"Trial limit exceeded. You have more than 1 product. Upgrade to edit or manage products.",upgradeRequired:!0,limitType:"products"};if(!d&&c.productsUsed>=1)return{allowed:!1,code:"PRODUCT_LIMIT_REACHED",reason:"Trial limit reached. Your trial plan allows 1 product only. Upgrade to continue uploading.",upgradeRequired:!0,limitType:"products"}}if(!d&&null!==a.products&&c.productsUsed>=a.products)return{allowed:!1,code:"PRODUCT_LIMIT_REACHED",reason:`You have reached your ${a.products}-product limit. Upgrade your plan to create more products.`,upgradeRequired:!0,limitType:"products"};if(a.unlimitedStorage)return{allowed:!0};let f=c.storageUsedMb+e;return null!==a.storageMb&&f>a.storageMb?{allowed:!1,code:"STORAGE_LIMIT_REACHED",reason:"You do not have enough storage remaining for this file. Delete unused assets or upgrade your plan.",upgradeRequired:!0,limitType:"storage"}:{allowed:!0}},"checkViewerEntitlement",0,c,"mapLegacyPlanId",0,function(a){let b=a.toLowerCase().trim();return"free"===b?"trial":"basic"===b?"starter":"professional"===b?"pro":b}])},408309,a=>{"use strict";var b=a.i(761469);async function c(a,c,d){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;let[{total:f=0}={total:0}]=await (0,b.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[a,c]);0===Number(f)&&await (0,b.query)(`ALTER TABLE \`${a.replace(/`/g,"``")}\` ADD COLUMN \`${c.replace(/`/g,"``")}\` ${d}`)}async function d(a,c,d){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;let[{total:f=0}={total:0}]=await (0,b.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[a,c]);0===Number(f)&&await (0,b.query)(d)}async function e(a,c){let d=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===d||"1"===d||"false"!==d&&"0"!==d)return;let[{total:e=0}={total:0}]=await (0,b.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[a,c]);Number(e)>0&&await (0,b.query)(`ALTER TABLE \`${a.replace(/`/g,"``")}\` DROP INDEX \`${c.replace(/`/g,"``")}\``)}async function f(){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;await (0,b.query)(`
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
  `);let[f]=await (0,b.query)(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'category'
     LIMIT 1`);!f||f.COLUMN_TYPE.includes("'welcome'")&&f.COLUMN_TYPE.includes("'bandwidth'")||await (0,b.query)(`ALTER TABLE customer_notifications
       MODIFY COLUMN category ENUM('billing','support','product','subscription','storage','bandwidth','system','security','welcome')
       NOT NULL DEFAULT 'system'`),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await c("products","tags","JSON NULL"),await c("products","deleted_at","DATETIME NULL"),await c("products","archived_at","DATETIME NULL"),await c("products","processing_error","VARCHAR(512) NULL"),await c("product_qr_codes","qr_uid","VARCHAR(64) NULL"),await c("product_qr_codes","name","VARCHAR(160) NOT NULL DEFAULT 'Main QR'"),await c("product_qr_codes","status","ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active'"),await c("product_qr_codes","expires_at","DATETIME NULL"),await c("product_qr_codes","deleted_at","DATETIME NULL"),await c("product_qr_codes","style_json","JSON NULL"),await (0,b.query)("UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = ''"),await e("product_qr_codes","uq_product_qr_product"),await d("product_qr_codes","idx_product_qr_product","CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)"),await d("product_qr_codes","uq_product_qr_uid","CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)"),await d("product_qr_codes","idx_product_qr_status","CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)"),await d("products","idx_products_customer_status","CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)"),await d("products","idx_products_customer_category","CREATE INDEX idx_products_customer_category ON products (customer_uid, category)"),await c("product_qr_codes","qr_code","VARCHAR(16) NULL"),await c("product_qr_codes","unique_scans","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await c("product_qr_codes","last_scan_at","DATETIME NULL"),await c("product_qr_codes","ar_launches","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await c("share_links","link_name","VARCHAR(160) NULL"),await (0,b.query)(`
    CREATE TABLE IF NOT EXISTS qr_code_sequence (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      next_val INT UNSIGNED NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,b.query)("INSERT IGNORE INTO qr_code_sequence (id, next_val) VALUES (1, 1)"),await (0,b.query)(`
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
  `),await (0,b.query)(`
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
  `),await d("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}a.s(["ensureUserPanelSchema",0,f])},480936,a=>{"use strict";var b=a.i(254799),c=a.i(761469),d=a.i(408309);async function e(a){await (0,d.ensureUserPanelSchema)();let e=`ntf-${(0,b.randomBytes)(8).toString("hex")}`,f=await (0,c.query)(`${a.dedupeKey?"INSERT IGNORE":"INSERT"} INTO customer_notifications
      (notification_uid, customer_uid, user_id, category, title, body, href, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[e,a.customerUid,a.userId??null,a.category,a.title,a.body,a.href??null,a.dedupeKey??null]);if(a.dedupeKey&&0===Number(f.affectedRows||0)){let b=await (0,c.query)(`SELECT notification_uid FROM customer_notifications
       WHERE customer_uid = ? AND dedupe_key = ? LIMIT 1`,[a.customerUid,a.dedupeKey]);return{skipped:!0,id:b[0]?.notification_uid||e}}return{created:!0,id:e}}let f={product:{inApp:!0,email:!0},billing:{inApp:!0,email:!0},subscription:{inApp:!0,email:!0},usage:{inApp:!0,email:!0},support:{inApp:!0,email:!0},security:{inApp:!0,email:!0},marketing:{inApp:!1,email:!1}};async function g(a){await (0,d.ensureUserPanelSchema)();let b=await (0,c.query)("SELECT email_notification_preferences_json FROM user_preferences WHERE user_id = ? LIMIT 1",[a]);if(!b[0]?.email_notification_preferences_json)return f;try{let a=JSON.parse(b[0].email_notification_preferences_json);return{product:{...f.product,...a.product},billing:{...f.billing,...a.billing},subscription:{...f.subscription,...a.subscription},usage:{...f.usage,...a.usage},support:{...f.support,...a.support},security:{...f.security,...a.security},marketing:{...f.marketing,...a.marketing}}}catch{return f}}a.s(["createCustomerNotification",0,e,"getNotificationPreferences",0,g])}];

//# sourceMappingURL=src_lib_04bb_oj._.js.map