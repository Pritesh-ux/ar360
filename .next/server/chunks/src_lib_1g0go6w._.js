module.exports=[232074,e=>{"use strict";var r=e.i(843793);async function t(e,t,i){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;let[{total:o=0}={total:0}]=await (0,r.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,t]);0===Number(o)&&await (0,r.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${t.replace(/`/g,"``")}\` ${i}`)}async function i(e,t,i){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;let[{total:o=0}={total:0}]=await (0,r.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,t]);0===Number(o)&&await (0,r.query)(i)}async function a(e,t){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:a=0}={total:0}]=await (0,r.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,t]);Number(a)>0&&await (0,r.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` DROP INDEX \`${t.replace(/`/g,"``")}\``)}async function o(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;await (0,r.query)(`
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
  `);let[o]=await (0,r.query)(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'category'
     LIMIT 1`);!o||o.COLUMN_TYPE.includes("'welcome'")&&o.COLUMN_TYPE.includes("'bandwidth'")||await (0,r.query)(`ALTER TABLE customer_notifications
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
  `),await t("products","tags","JSON NULL"),await t("products","deleted_at","DATETIME NULL"),await t("products","archived_at","DATETIME NULL"),await t("products","processing_error","VARCHAR(512) NULL"),await t("product_qr_codes","qr_uid","VARCHAR(64) NULL"),await t("product_qr_codes","name","VARCHAR(160) NOT NULL DEFAULT 'Main QR'"),await t("product_qr_codes","status","ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active'"),await t("product_qr_codes","expires_at","DATETIME NULL"),await t("product_qr_codes","deleted_at","DATETIME NULL"),await t("product_qr_codes","style_json","JSON NULL"),await (0,r.query)("UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = ''"),await a("product_qr_codes","uq_product_qr_product"),await i("product_qr_codes","idx_product_qr_product","CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)"),await i("product_qr_codes","uq_product_qr_uid","CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)"),await i("product_qr_codes","idx_product_qr_status","CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)"),await i("products","idx_products_customer_status","CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)"),await i("products","idx_products_customer_category","CREATE INDEX idx_products_customer_category ON products (customer_uid, category)"),await t("product_qr_codes","qr_code","VARCHAR(16) NULL"),await t("product_qr_codes","unique_scans","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await t("product_qr_codes","last_scan_at","DATETIME NULL"),await t("product_qr_codes","ar_launches","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await t("share_links","link_name","VARCHAR(160) NULL"),await (0,r.query)(`
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
  `),await i("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}e.s(["ensureUserPanelSchema",0,o])},895619,e=>{"use strict";var r=e.i(254799),t=e.i(843793),i=e.i(232074);async function a(e){await (0,i.ensureUserPanelSchema)();let a=`ntf-${(0,r.randomBytes)(8).toString("hex")}`,o=await (0,t.query)(`${e.dedupeKey?"INSERT IGNORE":"INSERT"} INTO customer_notifications
      (notification_uid, customer_uid, user_id, category, title, body, href, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[a,e.customerUid,e.userId??null,e.category,e.title,e.body,e.href??null,e.dedupeKey??null]);if(e.dedupeKey&&0===Number(o.affectedRows||0)){let r=await (0,t.query)(`SELECT notification_uid FROM customer_notifications
       WHERE customer_uid = ? AND dedupe_key = ? LIMIT 1`,[e.customerUid,e.dedupeKey]);return{skipped:!0,id:r[0]?.notification_uid||a}}return{created:!0,id:a}}let o={product:{inApp:!0,email:!0},billing:{inApp:!0,email:!0},subscription:{inApp:!0,email:!0},usage:{inApp:!0,email:!0},support:{inApp:!0,email:!0},security:{inApp:!0,email:!0},marketing:{inApp:!1,email:!1}};async function d(e){await (0,i.ensureUserPanelSchema)();let r=await (0,t.query)("SELECT email_notification_preferences_json FROM user_preferences WHERE user_id = ? LIMIT 1",[e]);if(!r[0]?.email_notification_preferences_json)return o;try{let e=JSON.parse(r[0].email_notification_preferences_json);return{product:{...o.product,...e.product},billing:{...o.billing,...e.billing},subscription:{...o.subscription,...e.subscription},usage:{...o.usage,...e.usage},support:{...o.support,...e.support},security:{...o.security,...e.security},marketing:{...o.marketing,...e.marketing}}}catch{return o}}async function n(e,r,a){await (0,i.ensureUserPanelSchema)();let o={...a,security:{inApp:!0,email:a.security.email}};return(await (0,t.query)("SELECT id FROM user_preferences WHERE user_id = ? LIMIT 1",[e])).length?await (0,t.query)("UPDATE user_preferences SET email_notification_preferences_json = ?, updated_at = NOW() WHERE user_id = ?",[JSON.stringify(o),e]):await (0,t.query)(`INSERT INTO user_preferences (user_id, customer_uid, email_notification_preferences_json)
       VALUES (?, ?, ?)`,[e,r,JSON.stringify(o)]),o}e.s(["createCustomerNotification",0,a,"getNotificationPreferences",0,d,"saveNotificationPreferences",0,n])},250376,e=>{"use strict";function r(e){return!!e.trialEndsAt&&Date.now()>new Date(e.trialEndsAt).getTime()}function t(e,t){if(!e.allowViewer)return{allowed:!1,reason:"Viewer is disabled for your current plan.",upgradeRequired:!0,limitType:"status"};if("free"===e.planId||"trial"===e.planId){if(r(t))return{allowed:!1,reason:"This trial viewer has expired. Upgrade to reactivate the public viewer.",upgradeRequired:!0,trialExpired:!0,limitType:"trial"};if(t.productsUsed>1)return{allowed:!1,reason:"Trial limit exceeded. You have more than 1 product. Upgrade to reactivate the viewer.",upgradeRequired:!0,limitType:"products"}}let i=function(e,r){if(e.unlimitedBandwidth)return{allowed:!0};let t=Number(e.bandwidthGb||0),i=Number(r.bandwidthUsedGb??0);return t>0&&i>=t?{allowed:!1,reason:"Monthly bandwidth limit reached. Upgrade your plan to restore viewer access.",upgradeRequired:!0,limitType:"bandwidth"}:{allowed:!0}}(e,t);return i.allowed?{allowed:!0}:i}e.s(["DEFAULT_PLAN_LIMITS",0,{trial:{planId:"trial",name:"Free Trial",products:1,storageMb:100,bandwidthGb:1,trialHours:24,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!1,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},starter:{planId:"starter",name:"Starter",products:5,storageMb:512,bandwidthGb:5,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!1,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},pro:{planId:"pro",name:"Pro",products:50,storageMb:5120,bandwidthGb:50,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},business:{planId:"business",name:"Business",products:250,storageMb:25600,bandwidthGb:250,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!0,unlimitedStorage:!1,unlimitedBandwidth:!1},enterprise:{planId:"enterprise",name:"Enterprise",products:250,storageMb:25600,bandwidthGb:250,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!0,unlimitedStorage:!1,unlimitedBandwidth:!1}},"checkArEntitlement",0,function(e,r){return!1===e.allowAr?{allowed:!1,reason:"AR is not included in your current plan. Upgrade to unlock AR.",upgradeRequired:!0,limitType:"status"}:t(e,r)},"checkEmbedEntitlement",0,function(e,r){return!1===e.allowEmbed?{allowed:!1,reason:"Embed viewer is not available on your current plan. Upgrade to Professional or higher.",upgradeRequired:!0,limitType:"status"}:t(e,r)},"checkEnterpriseArExperienceEntitlement",0,function(e,r){return!e.isEnterpriseCustom||null==e.arExperienceLimit||r<e.arExperienceLimit?{allowed:!0}:{allowed:!1,code:"AR_EXPERIENCE_LIMIT_REACHED",reason:`You have reached your ${e.arExperienceLimit}-AR-experience limit. Contact support to increase your Enterprise allowance.`,upgradeRequired:!0,limitType:"ar_experiences"}},"checkEnterpriseModelEntitlement",0,function(e,r){return!e.isEnterpriseCustom||null==e.modelLimit||r<e.modelLimit?{allowed:!0}:{allowed:!1,code:"MODEL_LIMIT_REACHED",reason:`You have reached your ${e.modelLimit}-model limit. Contact support to increase your Enterprise allowance.`,upgradeRequired:!0,limitType:"models"}},"checkQrEntitlement",0,function(e,r){if(!1===e.allowQr)return{allowed:!1,reason:"QR codes are not included in your current plan.",upgradeRequired:!0,limitType:"qr"};let i=t(e,r);if(!i.allowed)return i;let a=Number(r.qrCodesUsed??r.productsUsed??0);return null!=e.qrCodes&&a>=Number(e.qrCodes)?{allowed:!1,reason:`QR code limit reached (${e.qrCodes}). Upgrade your plan for more QR codes.`,upgradeRequired:!0,limitType:"qr"}:{allowed:!0}},"checkShareEntitlement",0,function(e,r){if(!1===e.allowShare)return{allowed:!1,reason:"Share links are not included in your current plan.",upgradeRequired:!0,limitType:"share"};let i=t(e,r);return i.allowed?null!=e.shareLinks&&Number(r.shareLinksUsed??0)>=Number(e.shareLinks)?{allowed:!1,reason:`Share link limit reached (${e.shareLinks}). Upgrade your plan for more share links.`,upgradeRequired:!0,limitType:"share"}:{allowed:!0}:i},"checkUploadEntitlement",0,function(e,t,i=!1,a=0){if(!e.allowUpload)return{allowed:!1,reason:"Upload is not available on your current plan.",upgradeRequired:!0,limitType:"status"};if("free"===e.planId||"trial"===e.planId){if(r(t))return{allowed:!1,reason:"Your 24 hours trial has expired. Upgrade to continue uploading or editing products.",upgradeRequired:!0,trialExpired:!0,limitType:"trial"};if(t.productsUsed>1)return{allowed:!1,reason:"Trial limit exceeded. You have more than 1 product. Upgrade to edit or manage products.",upgradeRequired:!0,limitType:"products"};if(!i&&t.productsUsed>=1)return{allowed:!1,code:"PRODUCT_LIMIT_REACHED",reason:"Trial limit reached. Your trial plan allows 1 product only. Upgrade to continue uploading.",upgradeRequired:!0,limitType:"products"}}if(!i&&null!==e.products&&t.productsUsed>=e.products)return{allowed:!1,code:"PRODUCT_LIMIT_REACHED",reason:`You have reached your ${e.products}-product limit. Upgrade your plan to create more products.`,upgradeRequired:!0,limitType:"products"};if(e.unlimitedStorage)return{allowed:!0};let o=t.storageUsedMb+a;return null!==e.storageMb&&o>e.storageMb?{allowed:!1,code:"STORAGE_LIMIT_REACHED",reason:"You do not have enough storage remaining for this file. Delete unused assets or upgrade your plan.",upgradeRequired:!0,limitType:"storage"}:{allowed:!0}},"checkViewerEntitlement",0,t,"mapLegacyPlanId",0,function(e){let r=e.toLowerCase().trim();return"free"===r?"trial":"basic"===r?"starter":"professional"===r?"pro":r}])},954116,e=>{"use strict";var r=e.i(250376);let t=[{id:"trial",name:"TRIAL",tagline:"Move your first steps with ARStudio360",description:"Free plan for testing your first 3D/AR product.",storageGb:.1,bandwidthGb:1,products:1,priceMonthlyInr:0,priceYearlyInr:0,trialHours:24,badge:"24 Hours Trial",icon:"paper",features:["1 Active Product","3D Viewer & AR","QR Code Sharing","Public Share Link","Basic Analytics","Auto delete after 24 hours if not upgraded"],limits:{customBranding:!1,advancedAnalytics:!1,embedViewer:!1,priorityProcessing:!1,prioritySupport:!1},qrLimit:3,shareLinkLimit:5},{id:"starter",name:"STARTER",tagline:"Upgrade your info-commerce",description:"For small sellers who need clean 3D viewer, QR and AR.",storageGb:.5,bandwidthGb:5,products:5,priceMonthlyInr:249,priceYearlyInr:2499,icon:"plane",features:["5 Active Products","All Free features","Download QR","Viewer Link","Basic Analytics","Email support"],limits:{customBranding:!1,advancedAnalytics:!1,embedViewer:!1,priorityProcessing:!1,prioritySupport:!1},qrLimit:20,shareLinkLimit:null},{id:"pro",name:"PRO",tagline:"Boost your e-commerce",description:"Best for Amazon, Flipkart, furniture, tile and product brands.",storageGb:5,bandwidthGb:50,products:50,priceMonthlyInr:999,priceYearlyInr:9999,popular:!0,badge:"Most Popular",icon:"rocket",features:["50 Active Products","All Basic features","Advanced Analytics","Custom Branding","Embed Viewer","Priority Processing"],limits:{customBranding:!0,advancedAnalytics:!0,embedViewer:!0,priorityProcessing:!0,prioritySupport:!1},qrLimit:100,shareLinkLimit:null},{id:"business",name:"BUSINESS",tagline:"If it’s digital, it’s your job",description:"For high-volume businesses and custom AR workflows.",storageGb:25,bandwidthGb:250,products:250,priceMonthlyInr:null,priceYearlyInr:null,icon:"planet",features:["250 Active Products","All Professional features","Custom Solution","Priority Support","High Usage","Dedicated Setup"],limits:{customBranding:!0,advancedAnalytics:!0,embedViewer:!0,priorityProcessing:!0,prioritySupport:!0,allowCustomDomain:!0},qrLimit:null,shareLinkLimit:null},{id:"enterprise",name:"ENTERPRISE",tagline:"Custom contracts for complex organizations",description:"Sales-assisted plans with negotiated limits, pricing, and support.",storageGb:25,bandwidthGb:250,products:250,priceMonthlyInr:null,priceYearlyInr:null,icon:"planet",features:["Custom limits and workflows","Dedicated onboarding","Priority support","Contract billing","White Label viewer","Custom Domain"],limits:{customBranding:!0,advancedAnalytics:!0,embedViewer:!0,priorityProcessing:!0,prioritySupport:!0,allowCustomDomain:!0},qrLimit:null,shareLinkLimit:null,salesChannel:"manual"}];e.s(["BILLING_PLANS",0,t,"computeYearlyFromPercent",0,function(e,r){let t=Math.min(100,Math.max(0,Number(r)||0));return Math.round(12*Number(e)*(1-t/100))},"getPlanById",0,function(e){let i=(0,r.mapLegacyPlanId)(e||"trial");return t.find(e=>e.id===i)||t[0]}])}];

//# sourceMappingURL=src_lib_1g0go6w._.js.map