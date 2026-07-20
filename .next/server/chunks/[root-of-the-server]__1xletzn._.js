module.exports=[232074,e=>{"use strict";var t=e.i(843793);async function r(e,r,i){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;let[{total:n=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,r]);0===Number(n)&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${r.replace(/`/g,"``")}\` ${i}`)}async function i(e,r,i){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===a||"1"===a||"false"!==a&&"0"!==a)return;let[{total:n=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);0===Number(n)&&await (0,t.query)(i)}async function a(e,r){let i=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===i||"1"===i||"false"!==i&&"0"!==i)return;let[{total:a=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",[e,r]);Number(a)>0&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` DROP INDEX \`${r.replace(/`/g,"``")}\``)}async function n(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if("true"===e||"1"===e||"false"!==e&&"0"!==e)return;await (0,t.query)(`
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
  `);let[n]=await (0,t.query)(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_notifications' AND COLUMN_NAME = 'category'
     LIMIT 1`);!n||n.COLUMN_TYPE.includes("'welcome'")&&n.COLUMN_TYPE.includes("'bandwidth'")||await (0,t.query)(`ALTER TABLE customer_notifications
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
  `),await r("products","tags","JSON NULL"),await r("products","deleted_at","DATETIME NULL"),await r("products","archived_at","DATETIME NULL"),await r("products","processing_error","VARCHAR(512) NULL"),await r("product_qr_codes","qr_uid","VARCHAR(64) NULL"),await r("product_qr_codes","name","VARCHAR(160) NOT NULL DEFAULT 'Main QR'"),await r("product_qr_codes","status","ENUM('active','expired','archived','processing') NOT NULL DEFAULT 'active'"),await r("product_qr_codes","expires_at","DATETIME NULL"),await r("product_qr_codes","deleted_at","DATETIME NULL"),await r("product_qr_codes","style_json","JSON NULL"),await (0,t.query)("UPDATE product_qr_codes SET qr_uid = public_id WHERE qr_uid IS NULL OR qr_uid = ''"),await a("product_qr_codes","uq_product_qr_product"),await i("product_qr_codes","idx_product_qr_product","CREATE INDEX idx_product_qr_product ON product_qr_codes (product_id)"),await i("product_qr_codes","uq_product_qr_uid","CREATE UNIQUE INDEX uq_product_qr_uid ON product_qr_codes (qr_uid)"),await i("product_qr_codes","idx_product_qr_status","CREATE INDEX idx_product_qr_status ON product_qr_codes (customer_uid, status, created_at)"),await i("products","idx_products_customer_status","CREATE INDEX idx_products_customer_status ON products (customer_uid, status, deleted_at)"),await i("products","idx_products_customer_category","CREATE INDEX idx_products_customer_category ON products (customer_uid, category)"),await r("product_qr_codes","qr_code","VARCHAR(16) NULL"),await r("product_qr_codes","unique_scans","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await r("product_qr_codes","last_scan_at","DATETIME NULL"),await r("product_qr_codes","ar_launches","BIGINT UNSIGNED NOT NULL DEFAULT 0"),await r("share_links","link_name","VARCHAR(160) NULL"),await (0,t.query)(`
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
  `),await i("product_qr_codes","idx_product_qr_code","CREATE UNIQUE INDEX idx_product_qr_code ON product_qr_codes (qr_code)")}e.s(["ensureUserPanelSchema",0,n])},895619,e=>{"use strict";var t=e.i(254799),r=e.i(843793),i=e.i(232074);async function a(e){await (0,i.ensureUserPanelSchema)();let a=`ntf-${(0,t.randomBytes)(8).toString("hex")}`,n=await (0,r.query)(`${e.dedupeKey?"INSERT IGNORE":"INSERT"} INTO customer_notifications
      (notification_uid, customer_uid, user_id, category, title, body, href, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[a,e.customerUid,e.userId??null,e.category,e.title,e.body,e.href??null,e.dedupeKey??null]);if(e.dedupeKey&&0===Number(n.affectedRows||0)){let t=await (0,r.query)(`SELECT notification_uid FROM customer_notifications
       WHERE customer_uid = ? AND dedupe_key = ? LIMIT 1`,[e.customerUid,e.dedupeKey]);return{skipped:!0,id:t[0]?.notification_uid||a}}return{created:!0,id:a}}let n={product:{inApp:!0,email:!0},billing:{inApp:!0,email:!0},subscription:{inApp:!0,email:!0},usage:{inApp:!0,email:!0},support:{inApp:!0,email:!0},security:{inApp:!0,email:!0},marketing:{inApp:!1,email:!1}};async function o(e){await (0,i.ensureUserPanelSchema)();let t=await (0,r.query)("SELECT email_notification_preferences_json FROM user_preferences WHERE user_id = ? LIMIT 1",[e]);if(!t[0]?.email_notification_preferences_json)return n;try{let e=JSON.parse(t[0].email_notification_preferences_json);return{product:{...n.product,...e.product},billing:{...n.billing,...e.billing},subscription:{...n.subscription,...e.subscription},usage:{...n.usage,...e.usage},support:{...n.support,...e.support},security:{...n.security,...e.security},marketing:{...n.marketing,...e.marketing}}}catch{return n}}async function s(e,t,a){await (0,i.ensureUserPanelSchema)();let n={...a,security:{inApp:!0,email:a.security.email}};return(await (0,r.query)("SELECT id FROM user_preferences WHERE user_id = ? LIMIT 1",[e])).length?await (0,r.query)("UPDATE user_preferences SET email_notification_preferences_json = ?, updated_at = NOW() WHERE user_id = ?",[JSON.stringify(n),e]):await (0,r.query)(`INSERT INTO user_preferences (user_id, customer_uid, email_notification_preferences_json)
       VALUES (?, ?, ?)`,[e,t,JSON.stringify(n)]),n}e.s(["createCustomerNotification",0,a,"getNotificationPreferences",0,o,"saveNotificationPreferences",0,s])},250376,e=>{"use strict";function t(e){return!!e.trialEndsAt&&Date.now()>new Date(e.trialEndsAt).getTime()}function r(e,r){if(!e.allowViewer)return{allowed:!1,reason:"Viewer is disabled for your current plan.",upgradeRequired:!0,limitType:"status"};if("free"===e.planId||"trial"===e.planId){if(t(r))return{allowed:!1,reason:"This trial viewer has expired. Upgrade to reactivate the public viewer.",upgradeRequired:!0,trialExpired:!0,limitType:"trial"};if(r.productsUsed>1)return{allowed:!1,reason:"Trial limit exceeded. You have more than 1 product. Upgrade to reactivate the viewer.",upgradeRequired:!0,limitType:"products"}}let i=function(e,t){if(e.unlimitedBandwidth)return{allowed:!0};let r=Number(e.bandwidthGb||0),i=Number(t.bandwidthUsedGb??0);return r>0&&i>=r?{allowed:!1,reason:"Monthly bandwidth limit reached. Upgrade your plan to restore viewer access.",upgradeRequired:!0,limitType:"bandwidth"}:{allowed:!0}}(e,r);return i.allowed?{allowed:!0}:i}e.s(["DEFAULT_PLAN_LIMITS",0,{trial:{planId:"trial",name:"Free Trial",products:1,storageMb:100,bandwidthGb:1,trialHours:24,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!1,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},starter:{planId:"starter",name:"Starter",products:5,storageMb:512,bandwidthGb:5,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!1,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},pro:{planId:"pro",name:"Pro",products:50,storageMb:5120,bandwidthGb:50,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!1,unlimitedStorage:!1,unlimitedBandwidth:!1},business:{planId:"business",name:"Business",products:250,storageMb:25600,bandwidthGb:250,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!0,unlimitedStorage:!1,unlimitedBandwidth:!1},enterprise:{planId:"enterprise",name:"Enterprise",products:250,storageMb:25600,bandwidthGb:250,allowViewer:!0,allowUpload:!0,allowAr:!0,allowCustomBranding:!0,allowCustomDomain:!0,unlimitedStorage:!1,unlimitedBandwidth:!1}},"checkArEntitlement",0,function(e,t){return!1===e.allowAr?{allowed:!1,reason:"AR is not included in your current plan. Upgrade to unlock AR.",upgradeRequired:!0,limitType:"status"}:r(e,t)},"checkEmbedEntitlement",0,function(e,t){return!1===e.allowEmbed?{allowed:!1,reason:"Embed viewer is not available on your current plan. Upgrade to Professional or higher.",upgradeRequired:!0,limitType:"status"}:r(e,t)},"checkEnterpriseArExperienceEntitlement",0,function(e,t){return!e.isEnterpriseCustom||null==e.arExperienceLimit||t<e.arExperienceLimit?{allowed:!0}:{allowed:!1,code:"AR_EXPERIENCE_LIMIT_REACHED",reason:`You have reached your ${e.arExperienceLimit}-AR-experience limit. Contact support to increase your Enterprise allowance.`,upgradeRequired:!0,limitType:"ar_experiences"}},"checkEnterpriseModelEntitlement",0,function(e,t){return!e.isEnterpriseCustom||null==e.modelLimit||t<e.modelLimit?{allowed:!0}:{allowed:!1,code:"MODEL_LIMIT_REACHED",reason:`You have reached your ${e.modelLimit}-model limit. Contact support to increase your Enterprise allowance.`,upgradeRequired:!0,limitType:"models"}},"checkQrEntitlement",0,function(e,t){if(!1===e.allowQr)return{allowed:!1,reason:"QR codes are not included in your current plan.",upgradeRequired:!0,limitType:"qr"};let i=r(e,t);if(!i.allowed)return i;let a=Number(t.qrCodesUsed??t.productsUsed??0);return null!=e.qrCodes&&a>=Number(e.qrCodes)?{allowed:!1,reason:`QR code limit reached (${e.qrCodes}). Upgrade your plan for more QR codes.`,upgradeRequired:!0,limitType:"qr"}:{allowed:!0}},"checkShareEntitlement",0,function(e,t){if(!1===e.allowShare)return{allowed:!1,reason:"Share links are not included in your current plan.",upgradeRequired:!0,limitType:"share"};let i=r(e,t);return i.allowed?null!=e.shareLinks&&Number(t.shareLinksUsed??0)>=Number(e.shareLinks)?{allowed:!1,reason:`Share link limit reached (${e.shareLinks}). Upgrade your plan for more share links.`,upgradeRequired:!0,limitType:"share"}:{allowed:!0}:i},"checkUploadEntitlement",0,function(e,r,i=!1,a=0){if(!e.allowUpload)return{allowed:!1,reason:"Upload is not available on your current plan.",upgradeRequired:!0,limitType:"status"};if("free"===e.planId||"trial"===e.planId){if(t(r))return{allowed:!1,reason:"Your 24 hours trial has expired. Upgrade to continue uploading or editing products.",upgradeRequired:!0,trialExpired:!0,limitType:"trial"};if(r.productsUsed>1)return{allowed:!1,reason:"Trial limit exceeded. You have more than 1 product. Upgrade to edit or manage products.",upgradeRequired:!0,limitType:"products"};if(!i&&r.productsUsed>=1)return{allowed:!1,code:"PRODUCT_LIMIT_REACHED",reason:"Trial limit reached. Your trial plan allows 1 product only. Upgrade to continue uploading.",upgradeRequired:!0,limitType:"products"}}if(!i&&null!==e.products&&r.productsUsed>=e.products)return{allowed:!1,code:"PRODUCT_LIMIT_REACHED",reason:`You have reached your ${e.products}-product limit. Upgrade your plan to create more products.`,upgradeRequired:!0,limitType:"products"};if(e.unlimitedStorage)return{allowed:!0};let n=r.storageUsedMb+a;return null!==e.storageMb&&n>e.storageMb?{allowed:!1,code:"STORAGE_LIMIT_REACHED",reason:"You do not have enough storage remaining for this file. Delete unused assets or upgrade your plan.",upgradeRequired:!0,limitType:"storage"}:{allowed:!0}},"checkViewerEntitlement",0,r,"mapLegacyPlanId",0,function(e){let t=e.toLowerCase().trim();return"free"===t?"trial":"basic"===t?"starter":"professional"===t?"pro":t}])},954116,e=>{"use strict";var t=e.i(250376);let r=[{id:"trial",name:"TRIAL",tagline:"Move your first steps with ARStudio360",description:"Free plan for testing your first 3D/AR product.",storageGb:.1,bandwidthGb:1,products:1,priceMonthlyInr:0,priceYearlyInr:0,trialHours:24,badge:"24 Hours Trial",icon:"paper",features:["1 Active Product","3D Viewer & AR","QR Code Sharing","Public Share Link","Basic Analytics","Auto delete after 24 hours if not upgraded"],limits:{customBranding:!1,advancedAnalytics:!1,embedViewer:!1,priorityProcessing:!1,prioritySupport:!1},qrLimit:3,shareLinkLimit:5},{id:"starter",name:"STARTER",tagline:"Upgrade your info-commerce",description:"For small sellers who need clean 3D viewer, QR and AR.",storageGb:.5,bandwidthGb:5,products:5,priceMonthlyInr:249,priceYearlyInr:2499,icon:"plane",features:["5 Active Products","All Free features","Download QR","Viewer Link","Basic Analytics","Email support"],limits:{customBranding:!1,advancedAnalytics:!1,embedViewer:!1,priorityProcessing:!1,prioritySupport:!1},qrLimit:20,shareLinkLimit:null},{id:"pro",name:"PRO",tagline:"Boost your e-commerce",description:"Best for Amazon, Flipkart, furniture, tile and product brands.",storageGb:5,bandwidthGb:50,products:50,priceMonthlyInr:999,priceYearlyInr:9999,popular:!0,badge:"Most Popular",icon:"rocket",features:["50 Active Products","All Basic features","Advanced Analytics","Custom Branding","Embed Viewer","Priority Processing"],limits:{customBranding:!0,advancedAnalytics:!0,embedViewer:!0,priorityProcessing:!0,prioritySupport:!1},qrLimit:100,shareLinkLimit:null},{id:"business",name:"BUSINESS",tagline:"If it’s digital, it’s your job",description:"For high-volume businesses and custom AR workflows.",storageGb:25,bandwidthGb:250,products:250,priceMonthlyInr:null,priceYearlyInr:null,icon:"planet",features:["250 Active Products","All Professional features","Custom Solution","Priority Support","High Usage","Dedicated Setup"],limits:{customBranding:!0,advancedAnalytics:!0,embedViewer:!0,priorityProcessing:!0,prioritySupport:!0,allowCustomDomain:!0},qrLimit:null,shareLinkLimit:null},{id:"enterprise",name:"ENTERPRISE",tagline:"Custom contracts for complex organizations",description:"Sales-assisted plans with negotiated limits, pricing, and support.",storageGb:25,bandwidthGb:250,products:250,priceMonthlyInr:null,priceYearlyInr:null,icon:"planet",features:["Custom limits and workflows","Dedicated onboarding","Priority support","Contract billing","White Label viewer","Custom Domain"],limits:{customBranding:!0,advancedAnalytics:!0,embedViewer:!0,priorityProcessing:!0,prioritySupport:!0,allowCustomDomain:!0},qrLimit:null,shareLinkLimit:null,salesChannel:"manual"}];e.s(["BILLING_PLANS",0,r,"computeYearlyFromPercent",0,function(e,t){let r=Math.min(100,Math.max(0,Number(t)||0));return Math.round(12*Number(e)*(1-r/100))},"getPlanById",0,function(e){let i=(0,t.mapLegacyPlanId)(e||"trial");return r.find(e=>e.id===i)||r[0]}])},446786,(e,t,r)=>{t.exports=e.x("os",()=>require("os"))},233405,(e,t,r)=>{t.exports=e.x("child_process",()=>require("child_process"))},921517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},524836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},679594,(e,t,r)=>{t.exports=e.x("dns",()=>require("dns"))},832578,e=>{"use strict";var t=e.i(254799),r=e.i(843793);let i={companyName:"AR360",supportEmail:"support@ar360.com",gstNumber:"",currency:"INR",razorpayKeyId:"rzp_test_TAuEWF3IaCSVMp",razorpayKeySecret:process.env.RAZORPAY_KEY_SECRET||"",razorpayWebhookSecret:process.env.RAZORPAY_WEBHOOK_SECRET||"",razorpayMode:"live"===process.env.RAZORPAY_MODE?"live":"test",razorpayReconciliationEnabled:"false"!==process.env.RAZORPAY_RECONCILIATION_ENABLED,razorpayRolloutAllowlist:process.env.RAZORPAY_ROLLOUT_ALLOWLIST||"",razorpayKillSwitch:"true"===process.env.RAZORPAY_CHECKOUT_KILL_SWITCH,nativeSubscriptionCheckoutEnabled:"true"===process.env.RAZORPAY_NATIVE_SUBSCRIPTIONS,nativeSubscriptionRolloutPercent:Number(process.env.RAZORPAY_NATIVE_SUBSCRIPTION_ROLLOUT||0),legacyOneTimeRenewalsEnabled:"true"===process.env.RAZORPAY_LEGACY_RENEWALS,stripeKey:"",smtpHost:"",smtpEmail:"",smtpPort:587,smtpPassword:"",smtpEnabled:!0,resendEnabled:!!process.env.RESEND_API_KEY,resendApiKey:"",resendFromEmail:"",resendReplyTo:"",storageProvider:"Local",maxLoginAttempts:5,lockMinutes:30,autoDeleteExpiredData:!1,expiryWarningDays:7,storageWarningPercent:80,bandwidthWarningPercent:80,maintenanceMode:!1,emailNotifications:!0},a=new Set(["maxLoginAttempts","lockMinutes","expiryWarningDays","storageWarningPercent","bandwidthWarningPercent","smtpPort","nativeSubscriptionRolloutPercent"]),n=new Set(["autoDeleteExpiredData","maintenanceMode","emailNotifications","smtpEnabled","resendEnabled","nativeSubscriptionCheckoutEnabled","legacyOneTimeRenewalsEnabled","razorpayReconciliationEnabled","razorpayKillSwitch"]),o=new Set(["razorpayKeySecret","razorpayWebhookSecret","smtpPassword","resendApiKey","stripeKey"]);function s(){let e=process.env.BILLING_SETTINGS_ENCRYPTION_KEY||"";return e?t.default.createHash("sha256").update(e,"utf8").digest():null}function d(e){if(!e)return"";let r=s();if(!r)throw Error("BILLING_SETTINGS_ENCRYPTION_KEY is required before secrets can be persisted.");let i=t.default.randomBytes(12),a=t.default.createCipheriv("aes-256-gcm",r,i),n=Buffer.concat([a.update(e,"utf8"),a.final()]),o=a.getAuthTag();return`enc:v1:${i.toString("base64")}:${o.toString("base64")}:${n.toString("base64")}`}async function l(){await (0,r.ensureAppSchema)();let e=await (0,r.query)("SELECT setting_key, setting_value FROM platform_settings").catch(()=>[]),l={...i};for(let p of e)if(p.setting_key in l){var u,c;l[p.setting_key]=(u=p.setting_key,null==(c=p.setting_value)?i[u]:o.has(u)?function(e){if(!e.startsWith("enc:v1:"))return e;let r=s();if(!r)throw Error("BILLING_SETTINGS_ENCRYPTION_KEY is unavailable; encrypted billing settings cannot be read.");let[,,i,a,n]=e.split(":"),o=t.default.createDecipheriv("aes-256-gcm",r,Buffer.from(i,"base64"));return o.setAuthTag(Buffer.from(a,"base64")),Buffer.concat([o.update(Buffer.from(n,"base64")),o.final()]).toString("utf8")}(c):a.has(u)?Number(c||0):n.has(u)?"true"===c||"1"===c:c),o.has(p.setting_key)&&p.setting_value&&!p.setting_value.startsWith("enc:v1:")&&s()&&await (0,r.query)("UPDATE platform_settings SET setting_value = ?, is_secret = 1 WHERE setting_key = ?",[d(p.setting_value),p.setting_key])}return l}async function u(e){for(let[t,a]of(await (0,r.ensureAppSchema)(),Object.entries(e).filter(([e])=>e in i))){let e=o.has(t)?d(String(a??"")):String(a??"");await (0,r.query)(`INSERT INTO platform_settings (setting_key, setting_value, is_secret) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), is_secret=VALUES(is_secret), updated_at=NOW()`,[t,e,o.has(t)])}}async function c(){let e=await l();return{keyId:e.razorpayKeyId||process.env.RAZORPAY_KEY_ID||"rzp_test_TAuEWF3IaCSVMp",keySecret:e.razorpayKeySecret||process.env.RAZORPAY_KEY_SECRET||"",webhookSecret:e.razorpayWebhookSecret||process.env.RAZORPAY_WEBHOOK_SECRET||"",mode:e.razorpayMode}}e.s(["getPlatformSettings",0,l,"getRazorpayKeys",0,c,"savePlatformSettings",0,u])},576919,e=>{"use strict";var t=e.i(843793);async function r(){await (0,t.query)(`
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[e.recipient,e.subject,e.template||null,e.status,e.providerMessageId||null,e.errorMessage||null,JSON.stringify(e.metadata||{}),"sent"===e.status||"console"===e.status?new Date:null])}catch(e){console.warn("[email_log insert skipped]",e)}}e.s(["buildEmailLogWhere",0,function(e){let t=[],r=[],i=(e.search||"").trim().toLowerCase();if(i){t.push("(LOWER(recipient) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(COALESCE(template, '')) LIKE ?)");let e=`%${i}%`;r.push(e,e,e)}return e.status&&"all"!==e.status&&(t.push("status = ?"),r.push(e.status)),e.template&&"all"!==e.template&&(t.push("template = ?"),r.push(e.template)),e.dateFrom&&(t.push("DATE(created_at) >= ?"),r.push(e.dateFrom)),e.dateTo&&(t.push("DATE(created_at) <= ?"),r.push(e.dateTo)),{where:t.length?`WHERE ${t.join(" AND ")}`:"",values:r}},"ensureEmailLogsSchema",0,r,"writeEmailLog",0,i])},706424,e=>{"use strict";var t=e.i(832578);async function r(e){let r=void 0===e?await (0,t.getPlatformSettings)().catch(()=>null):e;if(r?.smtpEnabled===!1)return null;let i=process.env.SMTP_HOST?.trim()||r?.smtpHost?.trim()||"",a=process.env.SMTP_USER?.trim()||r?.smtpEmail?.trim()||"",n=process.env.SMTP_PASSWORD?.trim()||r?.smtpPassword?.trim()||"",o=process.env.SMTP_FROM?.trim()||r?.smtpEmail?.trim()||a||r?.supportEmail?.trim()||"";if(!i||!a||!n)return null;let s=Number(process.env.SMTP_PORT||r?.smtpPort||(i.includes("gmail"),587)),d="true"===String(process.env.SMTP_SECURE||"").toLowerCase()||465===s;return{host:i,port:s,secure:d,user:a,password:n,from:o||a}}async function i(){var e;let i=await (0,t.getPlatformSettings)(),[a,n]=await Promise.all([r(i),Promise.resolve(function(e){if(!e.resendEnabled)return null;let t=process.env.RESEND_API_KEY?.trim()||e.resendApiKey.trim(),r=process.env.RESEND_FROM_EMAIL?.trim()||process.env.EMAIL_FROM?.trim()||e.resendFromEmail.trim(),i=process.env.RESEND_REPLY_TO?.trim()||e.resendReplyTo.trim()||e.supportEmail.trim();return t&&r?{apiKey:t,from:r,replyTo:i||void 0}:null}(i))]),o=(e={emailEnabled:i.emailNotifications,smtpEnabled:i.smtpEnabled,smtpConfigured:!!a,resendEnabled:i.resendEnabled,resendConfigured:!!n}).emailEnabled?e.smtpEnabled&&e.smtpConfigured?"smtp":e.resendEnabled&&e.resendConfigured?"resend":"unconfigured":"disabled";return{settings:i,smtp:a,resend:n,activeProvider:o}}async function a(){let{smtp:e,resend:t,activeProvider:r}=await i();return"smtp"===r&&e?{provider:"smtp",smtp:e}:"resend"===r&&t?{provider:"resend",resend:t}:{provider:"disabled",reason:"disabled"===r?"disabled":"unconfigured"}}async function n(){let{settings:e,smtp:t,resend:r,activeProvider:a}=await i();return{emailEnabled:e.emailNotifications,activeProvider:a,smtp:{enabled:e.smtpEnabled,configured:!!t},resend:{enabled:e.resendEnabled,configured:!!r}}}e.s(["getEmailDeliveryStatus",0,n,"resolveEmailDeliveryConfig",0,a],706424)},420483,e=>{"use strict";function t(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function r(e){let t="http://localhost:3000".replace(/\/$/,"");return`${t}${e.startsWith("/")?e:`/${e}`}`}function i(e){return`<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.7;">${t(e)}</p>`}e.s(["absoluteAppUrl",0,r,"emailButton",0,function(e,r){return`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td style="border-radius:8px;background:#18181b;">
      <a href="${t(r)}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">${t(e)}</a>
    </td>
  </tr>
</table>`},"emailDetails",0,function(e){if(!e.length)return"";let r=e.map((r,i)=>`
      <tr>
        <td style="padding:12px 0;${i<e.length-1?"border-bottom:1px solid #f4f4f5;":""}width:40%;color:#71717a;font-size:14px;line-height:1.5;vertical-align:top;">${t(r.label)}</td>
        <td style="padding:12px 0;${i<e.length-1?"border-bottom:1px solid #f4f4f5;":""}color:#18181b;font-size:14px;line-height:1.5;font-weight:500;text-align:right;vertical-align:top;">${t(r.value)}</td>
      </tr>`).join("");return`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border-top:1px solid #ececee;border-bottom:1px solid #ececee;">${r}</table>`},"emailGreeting",0,function(e){return i(`Hi ${e||"there"},`)},"emailHeading",0,function(e){return`<p style="margin:0 0 16px;color:#18181b;font-size:22px;line-height:1.35;font-weight:600;">${t(e)}</p>`},"emailParagraph",0,i,"emailSignOff",0,function(){return'<p style="margin:24px 0 0;color:#3f3f46;font-size:15px;line-height:1.7;">Best,<br />AR360 Team</p>'},"escapeHtml",0,t,"renderPremiumEmail",0,function(e){let i=t(e.preheader||""),a=new Date().getFullYear(),n=r("/"),o=r("/contact");return`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AR360</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${i?`<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${i}</div>`:""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #ececee;">
          <tr>
            <td style="padding:32px 40px 24px;">
              <a href="${t(n)}" style="text-decoration:none;color:#0A0B14;display:inline-block;line-height:0;">
                <img
                  src="data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='118' height='28' viewBox='0 0 118 28' fill='none'><path d='M14 2.4C19.6 2.4 22.4 3.4 24 5C25.6 6.6 26.6 9.4 26.6 14C26.6 18.6 25.6 21.4 24 23C22.4 24.6 19.6 25.6 14 25.6C8.4 25.6 5.6 24.6 4 23C2.4 21.4 1.4 18.6 1.4 14C1.4 9.4 2.4 6.6 4 5C5.6 3.4 8.4 2.4 14 2.4Z' stroke='%23B9FF2C' stroke-width='2.4' stroke-linejoin='round'/><text x='34' y='20.5' fill='%230A0B14' font-family='system-ui,Segoe UI,Arial,sans-serif' font-size='18' font-weight='700' letter-spacing='-0.5'>AR<tspan fill='%23B9FF2C'>360</tspan></text></svg>")}"
                  width="118"
                  height="28"
                  alt="AR360"
                  style="display:block;width:118px;height:28px;border:0;"
                />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 36px;font-size:15px;line-height:1.7;color:#3f3f46;">
              ${e.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#ececee;line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#a1a1aa;">
                <a href="${t(n)}" style="color:#71717a;text-decoration:underline;">Dashboard</a>
                &nbsp;&nbsp;\xb7&nbsp;&nbsp;
                <a href="${t(o)}" style="color:#71717a;text-decoration:underline;">Support</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">
                \xa9 ${a} AR360 Studio<br />
                3D and AR product experiences
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`}])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1xletzn._.js.map