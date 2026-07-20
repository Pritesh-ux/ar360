module.exports=[410281,323871,a=>{"use strict";a.i(254799);var b=a.i(761469),c=a.i(749016);function d(a){return a.toISOString()}function e(a,b){let c=a.toISOString().slice(0,10),d=b.toISOString().slice(0,10);return`${c}_${d}`}function f(a=new Date){let b=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1,0,0,0,0)),c=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,0,23,59,59,999));return{periodStart:d(b),periodEnd:d(c),periodKey:e(b,c),source:"calendar_month"}}async function g(a){if(!a)return!1;let d=(0,c.mapLegacyPlanId)(a),e=await (0,b.query)(`SELECT bandwidth_resets_monthly
       FROM billing_plans
      WHERE id IN (?, ?)
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1`,[a,d,a]).catch(()=>[]);return!!e[0]?.bandwidth_resets_monthly}async function h(a){if(!a)return f();let c=(await (0,b.query)(`SELECT current_period_start, current_period_end, billing_period, plan_id
       FROM customer_subscriptions
      WHERE customer_uid = ?
      LIMIT 1`,[a]).catch(()=>[]))[0];if(!c)return f();let h=String(c.billing_period||"").toLowerCase(),i=await g(c.plan_id);if(("yearly"===h||"annual"===h)&&i)return f();if(c.current_period_start&&c.current_period_end){var j,k;let a,b,f=(j=c.current_period_start,k=c.current_period_end,a=new Date(j),b=new Date(k),Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())?{periodStart:d(a),periodEnd:d(b),periodKey:e(a,b),source:"subscription"}:null);if(f)return f}return f()}a.s(["getCustomerBillingPeriod",0,h],323871),a.i(807074),a.i(630717);let i=null;async function j(){if(!0===i)return!0;try{return await (0,b.query)(`
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
    `),i=!0,!0}catch{return i=!1,!1}}async function k(a){if(!a)return 0;let c=await (0,b.query)(`SELECT COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb, c.plan_id
       FROM customers c
      WHERE c.customer_uid = ?
      LIMIT 1`,[a]).catch(()=>[]);return Number(c[0]?.bandwidth_used_mb||0)}async function l(a){let b=await h(a);return Number((await m(a,b.periodKey)/0x40000000).toFixed(4))}async function m(a,c){if(!a)return 0;if(await j())try{let d=await (0,b.query)(`SELECT COALESCE(SUM(bytes_transferred), 0) AS total
           FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ?`,[a,c]),e=Number(d[0]?.total||0);if(e>0)return e}catch{}return Math.round(1024*await k(a)*1024)}a.s(["getBandwidthUsedBytesInPeriod",0,m,"getCustomerBandwidthUsedGb",0,l,"getCustomerBandwidthUsedMb",0,k],410281)},306380,945725,250298,a=>{"use strict";var b=a.i(761469),c=a.i(323871),d=a.i(495705),e=a.i(499190),f=a.i(749016),g=a.i(807074);function h(a,b){return b||null==a||a<0?null:0===a&&!1===b?0:a>=0x3b9ac9ff?null:a}function i(a,b){return null==a?null:Math.max(0,a-b)}function j(a,b){return null==b||b<=0?null:Math.min(100,Math.round(a/b*100))}function k(a,b){return null!=b&&a>=b}function l(a,b){if(null==b||b<=0)return"normal";let c=a/b*100;return c>=100?"exceeded":c>=80?"warning":"normal"}a.s(["isExceeded",0,k,"normalizePlanLimit",0,h,"percentUsed",0,j,"remainingFromLimit",0,i,"usageThresholdState",0,l],945725);let m=`
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
`,n=`
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
`,o=`
  SELECT COALESCE(SUM(a.size_bytes), 0) AS total
    FROM product_assets a
   WHERE a.customer_uid = ?
     AND COALESCE(a.size_bytes, 0) > 0
     AND (a.deleted_at IS NULL)
     AND (a.status IS NULL OR a.status = 'active')
`,p=`
  SELECT COALESCE(SUM(a.size_bytes), 0) AS total
    FROM product_assets a
   WHERE a.customer_uid = ?
`,q=`
  SELECT COUNT(*) AS total
    FROM product_qr_codes q
   WHERE q.customer_uid = ?
     AND q.deleted_at IS NULL
`,r=`
  SELECT COUNT(*) AS total
    FROM share_links s
   WHERE s.customer_uid = ?
     AND s.deleted_at IS NULL
`;a.s(["PRODUCT_USAGE_COUNT_SQL",0,m,"PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS",0,n,"QR_USAGE_COUNT_SQL",0,q,"SHARE_LINK_USAGE_COUNT_SQL",0,r,"STORAGE_USAGE_SUM_SQL",0,o,"STORAGE_USAGE_SUM_SQL_LEGACY",0,p],250298);var s=a.i(410281),t=a.i(630717);async function u(a,c){try{let d=await (0,b.query)(a,c);return Number(d[0]?.total||0)}catch{return 0}}async function v(a,c){try{let d=await (0,b.query)(a,c);return Number(d[0]?.total||0)}catch{return 0}}async function w(a){try{let c=await (0,b.query)(m,[a]);return Number(c[0]?.total||0)}catch{try{let c=await (0,b.query)(n,[a]);return Number(c[0]?.total||0)}catch{return u("SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",[a])}}}async function x(a){try{let c=await (0,b.query)(o,[a]);return Number(c[0]?.total||0)}catch{return v(p,[a])}}function y(a,b){return{used:a,limit:b,remaining:i(b,a),exceeded:k(a,b),percentUsed:j(a,b),threshold:l(a,b)}}function z(a,b){return{usedBytes:a,limitBytes:b,remainingBytes:null==b?null:Math.max(0,b-a),percentUsed:j(a,b),exceeded:k(a,b),threshold:l(a,b)}}function A(a){if(!a)return null;try{return a instanceof Date?a.toISOString():new Date(a).toISOString()}catch{return null}}async function B(a){let[i,j,k]=await Promise.all([(0,b.query)(`SELECT plan_id, status, billing_period, current_period_start, current_period_end, cancel_at_period_end
         FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,[a]).catch(()=>[]),(0,t.checkSubscription)(a),(0,c.getCustomerBillingPeriod)(a)]),l=i[0],m=l?.plan_id||j.plan?.id||"trial",n=(0,f.mapLegacyPlanId)(m),[o,p,v,B,C,D,E]=await Promise.all([(0,g.resolvePlanLimits)(m),(0,e.getPlanBySlug)(n),w(a),x(a),(0,s.getBandwidthUsedBytesInPeriod)(a,k.periodKey),u(q,[a]),u(r,[a])]),F=h(o.products),G=o.unlimitedStorage||null==o.storageMb?null:Math.round(1024*Number(o.storageMb)*1024),H=o.unlimitedBandwidth||null==o.bandwidthGb?null:Math.round(1024*Number(o.bandwidthGb)*1048576),I=h(o.qrCodes??null),J=h(o.shareLinks??null),K=String(l?.status||j.reason||"trialing").toLowerCase();return{customerId:a,plan:{id:o.planId,name:p?.name||o.name||n,slug:String(o.planId),level:o.isEnterpriseCustom?(0,d.getPlanLevel)("enterprise"):(0,d.getPlanLevel)(n)},subscription:{status:K,active:j.active,billingPeriod:l?.billing_period||null,periodStart:A(l?.current_period_start)||k.periodStart,periodEnd:A(l?.current_period_end)||k.periodEnd,cancelAtPeriodEnd:!!l?.cancel_at_period_end},products:y(v,F),storage:z(B,G),bandwidth:{...z(C,H),periodStart:k.periodStart,periodEnd:k.periodEnd},qrCodes:y(D,I),shareLinks:y(E,J)}}a.s(["getCustomerUsage",0,B],306380)},377774,779727,623749,a=>{"use strict";var b=a.i(807074),c=a.i(306380),d=a.i(761469),e=a.i(250298);async function f(a){try{let b=await (0,d.query)(e.PRODUCT_USAGE_COUNT_SQL,[a]);return Number(b[0]?.total||0)}catch{try{let b=await (0,d.query)(e.PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS,[a]);return Number(b[0]?.total||0)}catch{return 0}}}async function g(a){try{let b=await (0,d.query)(e.STORAGE_USAGE_SUM_SQL,[a]);return Number(b[0]?.total||0)}catch{try{let b=await (0,d.query)(e.STORAGE_USAGE_SUM_SQL_LEGACY,[a]);return Number(b[0]?.total||0)}catch{return 0}}}async function h(a,b){try{let c=await (0,d.query)(a,[b]);return Number(c[0]?.total||0)}catch{return 0}}async function i(a){let[b,d,i,j,k,l,m]=await Promise.all([(0,c.getCustomerUsage)(a),f(a),g(a),h(e.QR_USAGE_COUNT_SQL,a),h(e.SHARE_LINK_USAGE_COUNT_SQL,a),h(`SELECT COUNT(*) AS total FROM products
          WHERE customer_uid = ? AND deleted_at IS NULL
            AND (COALESCE(model_url, '') <> '' OR LOWER(COALESCE(file_name, '')) LIKE '%.glb')`,a),h(`SELECT COUNT(*) AS total FROM products
          WHERE customer_uid = ? AND deleted_at IS NULL
            AND LOWER(COALESCE(status, '')) IN ('published', 'active')`,a)]);return{productsUsed:d,storageUsedBytes:i,storageUsedMb:i/1024/1024,qrCodesUsed:j,shareLinksUsed:k,modelsUsed:l,arExperiencesUsed:m,customerUsage:b}}var j=a.i(630717);function k(a){if(!a)return null;try{return a instanceof Date?a.toISOString():new Date(a).toISOString()}catch{return null}}async function l(a){let[c,e,f,g]=await Promise.all([(0,j.checkSubscription)(a),(0,b.resolveCustomerPlanLimits)(a),i(a),(0,d.query)(`SELECT plan_id, billing_period, current_period_end, trial_ends_at, grace_ends_at, cancel_at_period_end
         FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,[a]).catch(()=>[])]),h=g[0],l=String(h?.plan_id||e.planId||c.plan?.id||"trial"),m=k(c.expiresAt)||k(h?.grace_ends_at)||k(h?.current_period_end)||k(h?.trial_ends_at),n=k(h?.current_period_end);return{customerUid:a,subscription:c,planId:l,limits:e,usage:f,daysRemaining:c.daysRemaining,renewAt:n,expiresAt:m,billingPeriod:h?.billing_period||null,cancelAtPeriodEnd:!!h?.cancel_at_period_end,isEnterpriseCustom:!!e.isEnterpriseCustom}}a.s(["getSubscriptionContext",0,l],779727);var m=a.i(749016),n=a.i(945725);async function o(a){try{let b=await (0,d.query)(e.PRODUCT_USAGE_COUNT_SQL,[a]);return Number(b[0]?.total||0)}catch{let b=await (0,d.query)(e.PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS,[a]);return Number(b[0]?.total||0)}}async function p(a){try{let b=await (0,d.query)(e.STORAGE_USAGE_SUM_SQL,[a]);return Number(b[0]?.total||0)}catch{let b=await (0,d.query)(e.STORAGE_USAGE_SUM_SQL_LEGACY,[a]);return Number(b[0]?.total||0)}}async function q(a,c){let d=await (0,b.resolvePlanLimits)(c||"trial"),e=(0,n.normalizePlanLimit)(d.products);return null==e?{ok:!0}:await o(a)>=e?{ok:!1,code:"PRODUCT_LIMIT_REACHED",message:`You have reached your ${e}-product limit. Upgrade your plan to create more products.`}:{ok:!0}}async function r(a,c,d=0,e){let f=await (0,b.resolvePlanLimits)(e||"trial");if(f.unlimitedStorage||null==f.storageMb)return{ok:!0};let g=Math.round(1024*Number(f.storageMb)*1024);return await p(a)-Math.max(0,d)+Math.max(0,c)>g?{ok:!1,code:"STORAGE_LIMIT_REACHED",message:"You do not have enough storage remaining for this file. Delete unused assets or upgrade your plan."}:{ok:!0}}async function s(a,c){let f=await (0,b.resolvePlanLimits)(c||"trial"),g=(0,n.normalizePlanLimit)(f.qrCodes??null);if(null==g)return{ok:!0};let h=await (0,d.query)(e.QR_USAGE_COUNT_SQL,[a]).catch(()=>[{total:0}]);return Number(h[0]?.total||0)>=g?{ok:!1,code:"QR_LIMIT_REACHED",message:`You have reached your ${g} QR code limit. Upgrade your plan to create more QR codes.`}:{ok:!0}}async function t(a,c){let f=await (0,b.resolvePlanLimits)(c||"trial"),g=(0,n.normalizePlanLimit)(f.shareLinks??null);if(null==g)return{ok:!0};let h=await (0,d.query)(e.SHARE_LINK_USAGE_COUNT_SQL,[a]).catch(()=>[{total:0}]);return Number(h[0]?.total||0)>=g?{ok:!1,code:"SHARE_LINK_LIMIT_REACHED",message:`You have reached your ${g} share link limit. Upgrade your plan to create more links.`}:{ok:!0}}a.s(["checkProductLimit",0,q,"checkQrLimit",0,s,"checkShareLinkLimit",0,t,"checkStorageLimit",0,r],623749);var u=a.i(410281);function v(a,b){return{allowed:!1,context:a,code:b.code||b.limitType||"PERMISSION_DENIED",message:b.reason||"This action is not allowed on your current plan.",upgradeRequired:!!b.upgradeRequired,trialExpired:b.trialExpired,limitType:b.limitType}}function w(a,b){return{allowed:!1,context:a,code:b.code,message:b.message,upgradeRequired:!0,limitType:String(b.code).toLowerCase()}}function x(a,b){return{allowed:!1,context:a,code:"SUBSCRIPTION_INACTIVE",message:b||"Your plan is not active. Please upgrade or renew to continue.",upgradeRequired:!0,limitType:"status"}}async function y(a,b,c){let d=c?.context||await l(a),e=d.limits,f=d.planId;if("access_dashboard"===b)return d.subscription.active?{allowed:!0,context:d}:x(d);if(!d.subscription.active)return x(d);let g=await (0,u.getCustomerBandwidthUsedGb)(a).catch(()=>0),h={productsUsed:d.usage.productsUsed,storageUsedMb:d.usage.storageUsedMb,bandwidthUsedGb:g,modelsUsed:d.usage.modelsUsed,arExperiencesUsed:d.usage.arExperiencesUsed,qrCodesUsed:d.usage.qrCodesUsed,shareLinksUsed:d.usage.shareLinksUsed,trialStartedAt:null,trialEndsAt:d.expiresAt,subscriptionStatus:d.subscription.reason};if(h.productsUsed=d.usage.productsUsed,"custom_branding"===b)return e.allowCustomBranding?{allowed:!0,context:d}:v(d,{allowed:!1,reason:"Custom branding is not included in your current plan.",upgradeRequired:!0,limitType:"status"});if("custom_domain"===b)return e.allowCustomDomain?{allowed:!0,context:d}:v(d,{allowed:!1,reason:"Custom domains are not included in your current plan. Upgrade to Business or Enterprise.",upgradeRequired:!0,limitType:"status"});if("analytics"===b)return e.advancedAnalytics?{allowed:!0,context:d}:v(d,{allowed:!1,reason:"Advanced analytics is not included in your current plan.",upgradeRequired:!0,limitType:"status"});if("object_capture"===b)return!1===e.allowObjectCapture?v(d,{allowed:!1,reason:"Object Capture is not included in your current plan.",upgradeRequired:!0,limitType:"status"}):{allowed:!0,context:d};if("viewer"===b){let a=(0,m.checkViewerEntitlement)(e,h);return a.allowed?{allowed:!0,context:d}:v(d,a)}if("ar"===b){let a=(0,m.checkArEntitlement)(e,h);return a.allowed?{allowed:!0,context:d}:v(d,a)}if("embed"===b){let a=(0,m.checkEmbedEntitlement)(e,h);return a.allowed?{allowed:!0,context:d}:v(d,a)}if("qr"===b){if(!1===e.allowQr)return v(d,{allowed:!1,reason:"QR codes are not included in your current plan.",upgradeRequired:!0,limitType:"qr"});let b=(0,m.checkViewerEntitlement)(e,h);if(!b.allowed)return v(d,b);let c=await s(a,f);if(!1===c.ok)return w(d,c);let g=(0,m.checkQrEntitlement)(e,h);return g.allowed?{allowed:!0,context:d}:v(d,g)}if("share"===b){if(!1===e.allowShare)return v(d,{allowed:!1,reason:"Share links are not included in your current plan.",upgradeRequired:!0,limitType:"share"});let b=(0,m.checkViewerEntitlement)(e,h);if(!b.allowed)return v(d,b);let c=await t(a,f);if(!1===c.ok)return w(d,c);let g=(0,m.checkShareEntitlement)(e,h);return g.allowed?{allowed:!0,context:d}:v(d,g)}if("create_product"===b||"upload"===b){let g=!!c?.isEdit&&"upload"===b;if(!g){let b=await q(a,f);if(!1===b.ok)return w(d,b)}if(c?.incomingBytes&&c.incomingBytes>0){let b=await r(a,c.incomingBytes,c.replaceBytes||0,f);if(!1===b.ok)return w(d,b)}let i=(0,m.checkUploadEntitlement)(e,h,g,(c?.incomingBytes||0)/1024/1024);if(!i.allowed)return v(d,i);if(e.isEnterpriseCustom&&"create_product"===b){let a=(0,m.checkEnterpriseModelEntitlement)(e,d.usage.modelsUsed);if(!a.allowed)return v(d,a)}return{allowed:!0,context:d}}return v(d,{allowed:!1,reason:`Unknown permission action: ${b}`,upgradeRequired:!1,limitType:"status"})}a.s(["assertCan",0,y],377774)}];

//# sourceMappingURL=src_lib_billing_1z1ujda._.js.map