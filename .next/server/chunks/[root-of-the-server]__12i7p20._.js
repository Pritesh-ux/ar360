module.exports=[814747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},120635,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},224361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},427699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},677652,(e,t,r)=>{t.exports=e.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},504446,(e,t,r)=>{t.exports=e.x("net",()=>require("net"))},792509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},688947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},500874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},406461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},254799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},951615,(e,t,r)=>{t.exports=e.x("node:buffer",()=>require("node:buffer"))},605365,(e,t,r)=>{t.exports=e.x("process",()=>require("process"))},755004,(e,t,r)=>{t.exports=e.x("tls",()=>require("tls"))},137464,(e,t,r)=>{t.exports=e.x("timers",()=>require("timers"))},99348,(e,t,r)=>{t.exports=e.x("string_decoder",()=>require("string_decoder"))},522734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},446786,(e,t,r)=>{t.exports=e.x("os",()=>require("os"))},233405,(e,t,r)=>{t.exports=e.x("child_process",()=>require("child_process"))},921517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},524836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},679594,(e,t,r)=>{t.exports=e.x("dns",()=>require("dns"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},832578,e=>{"use strict";var t=e.i(254799),r=e.i(843793);let a={companyName:"AR360",supportEmail:"support@ar360.com",gstNumber:"",currency:"INR",razorpayKeyId:"rzp_test_TAuEWF3IaCSVMp",razorpayKeySecret:process.env.RAZORPAY_KEY_SECRET||"",razorpayWebhookSecret:process.env.RAZORPAY_WEBHOOK_SECRET||"",razorpayMode:"live"===process.env.RAZORPAY_MODE?"live":"test",razorpayReconciliationEnabled:"false"!==process.env.RAZORPAY_RECONCILIATION_ENABLED,razorpayRolloutAllowlist:process.env.RAZORPAY_ROLLOUT_ALLOWLIST||"",razorpayKillSwitch:"true"===process.env.RAZORPAY_CHECKOUT_KILL_SWITCH,nativeSubscriptionCheckoutEnabled:"true"===process.env.RAZORPAY_NATIVE_SUBSCRIPTIONS,nativeSubscriptionRolloutPercent:Number(process.env.RAZORPAY_NATIVE_SUBSCRIPTION_ROLLOUT||0),legacyOneTimeRenewalsEnabled:"true"===process.env.RAZORPAY_LEGACY_RENEWALS,stripeKey:"",smtpHost:"",smtpEmail:"",smtpPort:587,smtpPassword:"",smtpEnabled:!0,resendEnabled:!!process.env.RESEND_API_KEY,resendApiKey:"",resendFromEmail:"",resendReplyTo:"",storageProvider:"Local",maxLoginAttempts:5,lockMinutes:30,autoDeleteExpiredData:!1,expiryWarningDays:7,storageWarningPercent:80,bandwidthWarningPercent:80,maintenanceMode:!1,emailNotifications:!0},i=new Set(["maxLoginAttempts","lockMinutes","expiryWarningDays","storageWarningPercent","bandwidthWarningPercent","smtpPort","nativeSubscriptionRolloutPercent"]),s=new Set(["autoDeleteExpiredData","maintenanceMode","emailNotifications","smtpEnabled","resendEnabled","nativeSubscriptionCheckoutEnabled","legacyOneTimeRenewalsEnabled","razorpayReconciliationEnabled","razorpayKillSwitch"]),n=new Set(["razorpayKeySecret","razorpayWebhookSecret","smtpPassword","resendApiKey","stripeKey"]);function l(){let e=process.env.BILLING_SETTINGS_ENCRYPTION_KEY||"";return e?t.default.createHash("sha256").update(e,"utf8").digest():null}function o(e){if(!e)return"";let r=l();if(!r)throw Error("BILLING_SETTINGS_ENCRYPTION_KEY is required before secrets can be persisted.");let a=t.default.randomBytes(12),i=t.default.createCipheriv("aes-256-gcm",r,a),s=Buffer.concat([i.update(e,"utf8"),i.final()]),n=i.getAuthTag();return`enc:v1:${a.toString("base64")}:${n.toString("base64")}:${s.toString("base64")}`}async function u(){await (0,r.ensureAppSchema)();let e=await (0,r.query)("SELECT setting_key, setting_value FROM platform_settings").catch(()=>[]),u={...a};for(let _ of e)if(_.setting_key in u){var d,c;u[_.setting_key]=(d=_.setting_key,null==(c=_.setting_value)?a[d]:n.has(d)?function(e){if(!e.startsWith("enc:v1:"))return e;let r=l();if(!r)throw Error("BILLING_SETTINGS_ENCRYPTION_KEY is unavailable; encrypted billing settings cannot be read.");let[,,a,i,s]=e.split(":"),n=t.default.createDecipheriv("aes-256-gcm",r,Buffer.from(a,"base64"));return n.setAuthTag(Buffer.from(i,"base64")),Buffer.concat([n.update(Buffer.from(s,"base64")),n.final()]).toString("utf8")}(c):i.has(d)?Number(c||0):s.has(d)?"true"===c||"1"===c:c),n.has(_.setting_key)&&_.setting_value&&!_.setting_value.startsWith("enc:v1:")&&l()&&await (0,r.query)("UPDATE platform_settings SET setting_value = ?, is_secret = 1 WHERE setting_key = ?",[o(_.setting_value),_.setting_key])}return u}async function d(e){for(let[t,i]of(await (0,r.ensureAppSchema)(),Object.entries(e).filter(([e])=>e in a))){let e=n.has(t)?o(String(i??"")):String(i??"");await (0,r.query)(`INSERT INTO platform_settings (setting_key, setting_value, is_secret) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), is_secret=VALUES(is_secret), updated_at=NOW()`,[t,e,n.has(t)])}}async function c(){let e=await u();return{keyId:e.razorpayKeyId||process.env.RAZORPAY_KEY_ID||"rzp_test_TAuEWF3IaCSVMp",keySecret:e.razorpayKeySecret||process.env.RAZORPAY_KEY_SECRET||"",webhookSecret:e.razorpayWebhookSecret||process.env.RAZORPAY_WEBHOOK_SECRET||"",mode:e.razorpayMode}}e.s(["getPlatformSettings",0,u,"getRazorpayKeys",0,c,"savePlatformSettings",0,d])},576919,e=>{"use strict";var t=e.i(843793);async function r(){await (0,t.query)(`
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
  `)}async function a(e){try{await r(),await (0,t.query)(`INSERT INTO email_logs (recipient, subject, template, status, provider_message_id, error_message, metadata, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[e.recipient,e.subject,e.template||null,e.status,e.providerMessageId||null,e.errorMessage||null,JSON.stringify(e.metadata||{}),"sent"===e.status||"console"===e.status?new Date:null])}catch(e){console.warn("[email_log insert skipped]",e)}}e.s(["buildEmailLogWhere",0,function(e){let t=[],r=[],a=(e.search||"").trim().toLowerCase();if(a){t.push("(LOWER(recipient) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(COALESCE(template, '')) LIKE ?)");let e=`%${a}%`;r.push(e,e,e)}return e.status&&"all"!==e.status&&(t.push("status = ?"),r.push(e.status)),e.template&&"all"!==e.template&&(t.push("template = ?"),r.push(e.template)),e.dateFrom&&(t.push("DATE(created_at) >= ?"),r.push(e.dateFrom)),e.dateTo&&(t.push("DATE(created_at) <= ?"),r.push(e.dateTo)),{where:t.length?`WHERE ${t.join(" AND ")}`:"",values:r}},"ensureEmailLogsSchema",0,r,"writeEmailLog",0,a])},706424,e=>{"use strict";var t=e.i(832578);async function r(e){let r=void 0===e?await (0,t.getPlatformSettings)().catch(()=>null):e;if(r?.smtpEnabled===!1)return null;let a=process.env.SMTP_HOST?.trim()||r?.smtpHost?.trim()||"",i=process.env.SMTP_USER?.trim()||r?.smtpEmail?.trim()||"",s=process.env.SMTP_PASSWORD?.trim()||r?.smtpPassword?.trim()||"",n=process.env.SMTP_FROM?.trim()||r?.smtpEmail?.trim()||i||r?.supportEmail?.trim()||"";if(!a||!i||!s)return null;let l=Number(process.env.SMTP_PORT||r?.smtpPort||(a.includes("gmail"),587)),o="true"===String(process.env.SMTP_SECURE||"").toLowerCase()||465===l;return{host:a,port:l,secure:o,user:i,password:s,from:n||i}}async function a(){var e;let a=await (0,t.getPlatformSettings)(),[i,s]=await Promise.all([r(a),Promise.resolve(function(e){if(!e.resendEnabled)return null;let t=process.env.RESEND_API_KEY?.trim()||e.resendApiKey.trim(),r=process.env.RESEND_FROM_EMAIL?.trim()||process.env.EMAIL_FROM?.trim()||e.resendFromEmail.trim(),a=process.env.RESEND_REPLY_TO?.trim()||e.resendReplyTo.trim()||e.supportEmail.trim();return t&&r?{apiKey:t,from:r,replyTo:a||void 0}:null}(a))]),n=(e={emailEnabled:a.emailNotifications,smtpEnabled:a.smtpEnabled,smtpConfigured:!!i,resendEnabled:a.resendEnabled,resendConfigured:!!s}).emailEnabled?e.smtpEnabled&&e.smtpConfigured?"smtp":e.resendEnabled&&e.resendConfigured?"resend":"unconfigured":"disabled";return{settings:a,smtp:i,resend:s,activeProvider:n}}async function i(){let{smtp:e,resend:t,activeProvider:r}=await a();return"smtp"===r&&e?{provider:"smtp",smtp:e}:"resend"===r&&t?{provider:"resend",resend:t}:{provider:"disabled",reason:"disabled"===r?"disabled":"unconfigured"}}async function s(){let{settings:e,smtp:t,resend:r,activeProvider:i}=await a();return{emailEnabled:e.emailNotifications,activeProvider:i,smtp:{enabled:e.smtpEnabled,configured:!!t},resend:{enabled:e.resendEnabled,configured:!!r}}}e.s(["getEmailDeliveryStatus",0,s,"resolveEmailDeliveryConfig",0,i],706424)},502820,e=>{"use strict";var t=e.i(281579),r=e.i(250376),a=e.i(843793),i=e.i(563796);async function s(e){var s;let n=String(e||"trial").trim(),l=(0,r.mapLegacyPlanId)(n),o=(await (0,t.getBillingPlans)({activeOnly:!1}).catch(()=>[])).find(e=>e.id===l);if(o)return{planId:o.id,name:o.name,products:o.products,storageMb:Math.round(1024*Number(o.storageGb||0)),bandwidthGb:Number(o.bandwidthGb||0),qrCodes:o.qrLimit??null,shareLinks:o.shareLinkLimit??null,trialHours:o.trialHours,allowViewer:o.limits?.allowViewer!==!1,allowUpload:o.limits?.allowUpload!==!1,allowAr:o.limits?.allowAr!==!1,allowQr:o.limits?.allowQr!==!1,allowShare:o.limits?.allowShare!==!1,allowCustomBranding:!!o.limits?.customBranding,allowEmbed:!!o.limits?.embedViewer,advancedAnalytics:!!o.limits?.advancedAnalytics,priorityProcessing:!!o.limits?.priorityProcessing,prioritySupport:!!o.limits?.prioritySupport,unlimitedStorage:!!o.unlimitedStorage,unlimitedBandwidth:!!o.unlimitedBandwidth,allowObjectCapture:o.limits?.allowObjectCapture!==!1,ocCapturesPerMonth:o.ocCapturesPerMonth??null,ocComputeSecondsPerMonth:o.ocComputeSecondsPerMonth??null,ocConcurrentJobs:o.ocConcurrentJobs??null,ocMaxRetries:o.ocMaxRetries??null,allowCustomDomain:!!o.limits?.allowCustomDomain};if(r.DEFAULT_PLAN_LIMITS[l])return r.DEFAULT_PLAN_LIMITS[l];await (0,i.ensureEnterpriseCustomPlanFeatureGates)().catch(()=>{});let u=await (0,a.query)(`SELECT custom_plan_uid, name, storage_limit_bytes, bandwidth_limit_bytes, product_limit,
            model_limit, ar_experience_limit, team_member_limit, custom_branding,
            allow_viewer, allow_upload, allow_ar, allow_qr, allow_share, allow_embed,
            allow_object_capture, allow_custom_domain, advanced_analytics, qr_limit, share_link_limit,
            oc_captures_per_month, oc_compute_seconds_per_month, oc_concurrent_jobs, oc_max_retries,
            priority_support, dedicated_infrastructure, sla_support, support_level
       FROM enterprise_custom_plans
      WHERE BINARY custom_plan_uid = BINARY ? AND is_active = 1
      LIMIT 1`,[n]).catch(()=>[]);if(u[0]){let e,t;return e=null==(s=u[0]).storage_limit_bytes?null:Number(s.storage_limit_bytes),t=null==s.bandwidth_limit_bytes?null:Number(s.bandwidth_limit_bytes),{planId:s.custom_plan_uid,name:s.name,products:null==s.product_limit?null:Number(s.product_limit),storageMb:null==e?null:e/1024/1024,bandwidthGb:null==t?null:t/1024/1024/1024,qrCodes:0===s.allow_qr||!1===s.allow_qr?0:null==s.qr_limit?null:Number(s.qr_limit),shareLinks:0===s.allow_share||!1===s.allow_share?0:null==s.share_link_limit?null:Number(s.share_link_limit),allowViewer:null==s.allow_viewer||!!s.allow_viewer,allowUpload:null==s.allow_upload||!!s.allow_upload,allowAr:null==s.allow_ar||!!s.allow_ar,allowQr:null==s.allow_qr||!!s.allow_qr,allowShare:null==s.allow_share||!!s.allow_share,allowCustomBranding:!!s.custom_branding,allowEmbed:null==s.allow_embed||!!s.allow_embed,advancedAnalytics:!!s.advanced_analytics,unlimitedStorage:null==e,unlimitedBandwidth:null==t,isEnterpriseCustom:!0,modelLimit:null==s.model_limit?null:Number(s.model_limit),arExperienceLimit:null==s.ar_experience_limit?null:Number(s.ar_experience_limit),teamMemberLimit:null==s.team_member_limit?null:Number(s.team_member_limit),prioritySupport:!!s.priority_support,dedicatedInfrastructure:!!s.dedicated_infrastructure,slaSupport:!!s.sla_support,supportLevel:s.support_level,allowObjectCapture:null==s.allow_object_capture||!!s.allow_object_capture,ocCapturesPerMonth:null==s.oc_captures_per_month?null:Number(s.oc_captures_per_month),ocComputeSecondsPerMonth:null==s.oc_compute_seconds_per_month?null:Number(s.oc_compute_seconds_per_month),ocConcurrentJobs:null==s.oc_concurrent_jobs?null:Number(s.oc_concurrent_jobs),ocMaxRetries:null==s.oc_max_retries?null:Number(s.oc_max_retries),allowCustomDomain:!!s.allow_custom_domain}}return r.DEFAULT_PLAN_LIMITS.trial}async function n(e){let t=await (0,a.query)("SELECT plan_id FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1",[e]).catch(()=>[]);return s(t[0]?.plan_id||"trial")}e.s(["resolveCustomerPlanLimits",0,n,"resolvePlanLimits",0,s])},267965,e=>{"use strict";var t=e.i(843793),r=e.i(954116);async function a(i,s=!1){if(!i)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let n=(await (0,t.query)(`SELECT 
      c.status AS customer_status,
      u.status AS user_status,
      s.plan_id,
      s.status AS sub_status,
      s.current_period_end,
      s.trial_ends_at,
      s.grace_ends_at
      ,s.provider
     FROM customers c
     LEFT JOIN users u ON u.id = c.user_id
     LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
     WHERE c.customer_uid = ?
     LIMIT 1`,[i]).catch(e=>(console.error("checkSubscription query error:",e),[])))[0];if(!n)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let{getBillingPlans:l}=await e.A(828945),{mapLegacyPlanId:o}=await e.A(245551),u=await l({activeOnly:!1}).catch(()=>[]),d=e=>u.find(t=>t.id===o(e))||(0,r.getPlanById)(e);if("Suspended"===n.customer_status||"Suspended"===n.user_status||"Deleted"===n.customer_status||"Deleted"===n.user_status)return{active:!1,reason:"inactive",plan:n.plan_id?d(n.plan_id):null,expiresAt:null,daysRemaining:0};let c=n.plan_id;if(!c)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let _=d(c),p=n.sub_status?String(n.sub_status).toLowerCase().trim():"",m=null;m="trialing"===p||"trial"===p?n.trial_ends_at?new Date(n.trial_ends_at):null:"grace"===p||"past_due"===p?n.grace_ends_at?new Date(n.grace_ends_at):null:n.current_period_end?new Date(n.current_period_end):null;let E=new Date,S=m?m.toISOString():null,b=0;m&&(b=Math.max(0,Math.ceil((m.getTime()-E.getTime())/864e5)));let L=!!m&&E.getTime()>m.getTime();if("active"!==p&&"trialing"!==p&&"trial"!==p&&"grace"!==p&&"past_due"!==p){let e="inactive";return"cancelled"===p?e="cancelled":"expired"===p?e="expired":("past_due"===p||"failed"===p||"payment_failed"===p)&&(e="payment_failed"),{active:!1,reason:e,plan:_,expiresAt:S,daysRemaining:b}}if(L){if("razorpay"===n.provider&&!s)try{let{reconcileBeforeNativeExpiry:t}=await e.A(817691);return await t(i),a(i,!0)}catch(e){return console.error("Native subscription expiry reconciliation failed:",e),await (0,t.query)("UPDATE customer_subscriptions SET reconciliation_required = 1 WHERE customer_uid = ?",[i]).catch(()=>void 0),{active:!0,reason:"active",plan:_,expiresAt:S,daysRemaining:0}}return{active:!1,reason:"expired",plan:_,expiresAt:S,daysRemaining:0}}return{active:!0,reason:"active",plan:_,expiresAt:S,daysRemaining:b}}e.s(["checkSubscription",0,a])},48857,188180,159114,e=>{"use strict";e.i(254799);var t=e.i(843793),r=e.i(250376);function a(e){return e.toISOString()}function i(e,t){let r=e.toISOString().slice(0,10),a=t.toISOString().slice(0,10);return`${r}_${a}`}function s(e=new Date){let t=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),1,0,0,0,0)),r=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth()+1,0,23,59,59,999));return{periodStart:a(t),periodEnd:a(r),periodKey:i(t,r),source:"calendar_month"}}async function n(e){if(!e)return!1;let a=(0,r.mapLegacyPlanId)(e),i=await (0,t.query)(`SELECT bandwidth_resets_monthly
       FROM billing_plans
      WHERE id IN (?, ?)
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1`,[e,a,e]).catch(()=>[]);return!!i[0]?.bandwidth_resets_monthly}async function l(e){if(!e)return s();let r=(await (0,t.query)(`SELECT current_period_start, current_period_end, billing_period, plan_id
       FROM customer_subscriptions
      WHERE customer_uid = ?
      LIMIT 1`,[e]).catch(()=>[]))[0];if(!r)return s();let l=String(r.billing_period||"").toLowerCase(),o=await n(r.plan_id);if(("yearly"===l||"annual"===l)&&o)return s();if(r.current_period_start&&r.current_period_end){var u,d;let e,t,s=(u=r.current_period_start,d=r.current_period_end,e=new Date(u),t=new Date(d),Number.isFinite(e.getTime())&&Number.isFinite(t.getTime())?{periodStart:a(e),periodEnd:a(t),periodKey:i(e,t),source:"subscription"}:null);if(s)return s}return s()}e.s(["getCustomerBillingPeriod",0,l],188180);var o=e.i(502820),u=e.i(267965);function d(e,t){if(null==t||t<=0)return"normal";let r=e/t*100;return r>=100?"exceeded":r>=80?"warning":"normal"}e.s(["isExceeded",0,function(e,t){return null!=t&&e>=t},"normalizePlanLimit",0,function(e,t){return t||null==e||e<0?null:0===e&&!1===t?0:e>=0x3b9ac9ff?null:e},"percentUsed",0,function(e,t){return null==t||t<=0?null:Math.min(100,Math.round(e/t*100))},"remainingFromLimit",0,function(e,t){return null==e?null:Math.max(0,e-t)},"usageThresholdState",0,d],159114);let c=null;async function _(){if(!0===c)return!0;try{return await (0,t.query)(`
      CREATE TABLE IF NOT EXISTS bandwidth_usage_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        customer_uid VARCHAR(64) NOT NULL,
        product_id VARCHAR(160) NULL,
        asset_id BIGINT UNSIGNED NULL,
        event_type VARCHAR(40) NOT NULL,
        bytes_transferred BIGINT UNSIGNED NOT NULL DEFAULT 0,
        measurement_mode ENUM('recorded','estimated') NOT NULL DEFAULT 'recorded',
        viewer_type VARCHAR(40) NULL,
        share_link_id BIGINT UNSIGNED NULL,
        qr_code_id BIGINT UNSIGNED NULL,
        session_id VARCHAR(64) NULL,
        billing_period_key VARCHAR(32) NOT NULL,
        occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bandwidth_events_customer_period (customer_uid, billing_period_key),
        INDEX idx_bandwidth_events_occurred (occurred_at),
        INDEX idx_bandwidth_events_session (session_id, event_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),c=!0,!0}catch{return c=!1,!1}}async function p(e){if(!e)return 0;let r=await (0,t.query)(`SELECT COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb, c.plan_id
       FROM customers c
      WHERE c.customer_uid = ?
      LIMIT 1`,[e]).catch(()=>[]);return Number(r[0]?.bandwidth_used_mb||0)}async function m(e){let t=await l(e);return Number((await E(e,t.periodKey)/0x40000000).toFixed(4))}async function E(e,r){if(!e)return 0;if(await _())try{let a=await (0,t.query)(`SELECT COALESCE(SUM(bytes_transferred), 0) AS total
           FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ?`,[e,r]),i=Number(a[0]?.total||0);if(i>0)return i}catch{}return Math.round(1024*await p(e)*1024)}async function S(e,r,a){if(!e||!Number.isFinite(r)||r<=0)return;let i=await l(e),s=a?.eventType||"other_asset_delivery",n=a?.sessionId||null,o=await _();if(o&&n)try{if((await (0,t.query)(`SELECT id FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ? AND session_id = ? AND event_type = ?
          LIMIT 1`,[e,i.periodKey,n,s]))[0])return}catch{}o&&await (0,t.query)(`INSERT INTO bandwidth_usage_events
         (customer_uid, product_id, asset_id, event_type, bytes_transferred, measurement_mode,
          viewer_type, share_link_id, qr_code_id, session_id, billing_period_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[e,a?.productId||null,a?.assetId||null,s,Math.round(r),a?.measurementMode||"recorded",a?.viewerType||null,a?.shareLinkId||null,a?.qrCodeId||null,n,i.periodKey]).catch(e=>console.warn("[bandwidth] event insert failed:",e)),await (0,t.query)(`UPDATE customers
        SET bandwidth_used_mb = COALESCE(bandwidth_used_mb, 0) + ?,
            updated_at = NOW()
      WHERE customer_uid = ?`,[r/1048576,e]).catch(e=>{console.warn("[bandwidth] Failed to record usage:",e)})}async function b(e){if(!(await (0,u.checkSubscription)(e)).active)return{allowed:!1,reason:"This AR experience is temporarily unavailable.",usedMb:0,usedBytes:0,limitGb:0,limitBytes:0,threshold:"exceeded"};let t=await (0,o.resolveCustomerPlanLimits)(e),r=await l(e),a=await E(e,r.periodKey),i=a/1048576,s=t.unlimitedBandwidth?null:Number(t.bandwidthGb??0)||null,n=null==s?null:Math.round(1024*s*1048576),c=d(a,n);return null!=s&&s>0&&i/1024>=s?{allowed:!1,reason:"Monthly bandwidth limit reached for this account.",usedMb:i,usedBytes:a,limitGb:s,limitBytes:n,threshold:"exceeded"}:{allowed:!0,usedMb:i,usedBytes:a,limitGb:s,limitBytes:n,threshold:c}}e.s(["checkCustomerBandwidth",0,b,"getBandwidthUsedBytesInPeriod",0,E,"getCustomerBandwidthUsedGb",0,m,"getCustomerBandwidthUsedMb",0,p,"recordBandwidthUsage",0,S],48857)},346164,e=>{"use strict";let t=`
  SELECT COUNT(*) AS total
    FROM products p
   WHERE p.customer_uid = ?
     AND p.deleted_at IS NULL
     AND (
       LOWER(COALESCE(p.status, 'draft')) <> 'failed'
       OR EXISTS (
         SELECT 1 FROM product_assets a
          WHERE a.product_uid = p.id
            AND a.customer_uid = p.customer_uid
            AND COALESCE(a.size_bytes, 0) > 0
            AND (a.deleted_at IS NULL OR a.status IS NULL OR a.status = 'active')
       )
     )
`,r=`
  SELECT COUNT(*) AS total
    FROM products p
   WHERE p.customer_uid = ?
     AND p.deleted_at IS NULL
     AND (
       LOWER(COALESCE(p.status, 'draft')) <> 'failed'
       OR EXISTS (
         SELECT 1 FROM product_assets a
          WHERE a.product_uid = p.id
            AND a.customer_uid = p.customer_uid
            AND COALESCE(a.size_bytes, 0) > 0
       )
     )
`,a=`
  SELECT COALESCE(SUM(a.size_bytes), 0) AS total
    FROM product_assets a
   WHERE a.customer_uid = ?
     AND COALESCE(a.size_bytes, 0) > 0
     AND (a.deleted_at IS NULL)
     AND (a.status IS NULL OR a.status = 'active')
`,i=`
  SELECT COALESCE(SUM(a.size_bytes), 0) AS total
    FROM product_assets a
   WHERE a.customer_uid = ?
`,s=`
  SELECT COUNT(*) AS total
    FROM product_qr_codes q
   WHERE q.customer_uid = ?
     AND q.deleted_at IS NULL
`,n=`
  SELECT COUNT(*) AS total
    FROM share_links s
   WHERE s.customer_uid = ?
     AND s.deleted_at IS NULL
`;e.s(["PRODUCT_USAGE_COUNT_SQL",0,t,"PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS",0,r,"QR_USAGE_COUNT_SQL",0,s,"SHARE_LINK_USAGE_COUNT_SQL",0,n,"STORAGE_USAGE_SUM_SQL",0,a,"STORAGE_USAGE_SUM_SQL_LEGACY",0,i])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__12i7p20._.js.map