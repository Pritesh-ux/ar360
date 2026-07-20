module.exports=[267965,e=>{"use strict";var t=e.i(843793),r=e.i(954116);async function i(n,a=!1){if(!n)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let s=(await (0,t.query)(`SELECT 
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
     LIMIT 1`,[n]).catch(e=>(console.error("checkSubscription query error:",e),[])))[0];if(!s)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let{getBillingPlans:d}=await e.A(828945),{mapLegacyPlanId:u}=await e.A(245551),l=await d({activeOnly:!1}).catch(()=>[]),o=e=>l.find(t=>t.id===u(e))||(0,r.getPlanById)(e);if("Suspended"===s.customer_status||"Suspended"===s.user_status||"Deleted"===s.customer_status||"Deleted"===s.user_status)return{active:!1,reason:"inactive",plan:s.plan_id?o(s.plan_id):null,expiresAt:null,daysRemaining:0};let c=s.plan_id;if(!c)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let _=o(c),E=s.sub_status?String(s.sub_status).toLowerCase().trim():"",S=null;S="trialing"===E||"trial"===E?s.trial_ends_at?new Date(s.trial_ends_at):null:"grace"===E||"past_due"===E?s.grace_ends_at?new Date(s.grace_ends_at):null:s.current_period_end?new Date(s.current_period_end):null;let p=new Date,m=S?S.toISOString():null,L=0;S&&(L=Math.max(0,Math.ceil((S.getTime()-p.getTime())/864e5)));let N=!!S&&p.getTime()>S.getTime();if("active"!==E&&"trialing"!==E&&"trial"!==E&&"grace"!==E&&"past_due"!==E){let e="inactive";return"cancelled"===E?e="cancelled":"expired"===E?e="expired":("past_due"===E||"failed"===E||"payment_failed"===E)&&(e="payment_failed"),{active:!1,reason:e,plan:_,expiresAt:m,daysRemaining:L}}if(N){if("razorpay"===s.provider&&!a)try{let{reconcileBeforeNativeExpiry:t}=await e.A(817691);return await t(n),i(n,!0)}catch(e){return console.error("Native subscription expiry reconciliation failed:",e),await (0,t.query)("UPDATE customer_subscriptions SET reconciliation_required = 1 WHERE customer_uid = ?",[n]).catch(()=>void 0),{active:!0,reason:"active",plan:_,expiresAt:m,daysRemaining:0}}return{active:!1,reason:"expired",plan:_,expiresAt:m,daysRemaining:0}}return{active:!0,reason:"active",plan:_,expiresAt:m,daysRemaining:L}}e.s(["checkSubscription",0,i])},48857,188180,159114,e=>{"use strict";e.i(254799);var t=e.i(843793),r=e.i(250376);function i(e){return e.toISOString()}function n(e,t){let r=e.toISOString().slice(0,10),i=t.toISOString().slice(0,10);return`${r}_${i}`}function a(e=new Date){let t=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),1,0,0,0,0)),r=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth()+1,0,23,59,59,999));return{periodStart:i(t),periodEnd:i(r),periodKey:n(t,r),source:"calendar_month"}}async function s(e){if(!e)return!1;let i=(0,r.mapLegacyPlanId)(e),n=await (0,t.query)(`SELECT bandwidth_resets_monthly
       FROM billing_plans
      WHERE id IN (?, ?)
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1`,[e,i,e]).catch(()=>[]);return!!n[0]?.bandwidth_resets_monthly}async function d(e){if(!e)return a();let r=(await (0,t.query)(`SELECT current_period_start, current_period_end, billing_period, plan_id
       FROM customer_subscriptions
      WHERE customer_uid = ?
      LIMIT 1`,[e]).catch(()=>[]))[0];if(!r)return a();let d=String(r.billing_period||"").toLowerCase(),u=await s(r.plan_id);if(("yearly"===d||"annual"===d)&&u)return a();if(r.current_period_start&&r.current_period_end){var l,o;let e,t,a=(l=r.current_period_start,o=r.current_period_end,e=new Date(l),t=new Date(o),Number.isFinite(e.getTime())&&Number.isFinite(t.getTime())?{periodStart:i(e),periodEnd:i(t),periodKey:n(e,t),source:"subscription"}:null);if(a)return a}return a()}e.s(["getCustomerBillingPeriod",0,d],188180);var u=e.i(502820),l=e.i(267965);function o(e,t){if(null==t||t<=0)return"normal";let r=e/t*100;return r>=100?"exceeded":r>=80?"warning":"normal"}e.s(["isExceeded",0,function(e,t){return null!=t&&e>=t},"normalizePlanLimit",0,function(e,t){return t||null==e||e<0?null:0===e&&!1===t?0:e>=0x3b9ac9ff?null:e},"percentUsed",0,function(e,t){return null==t||t<=0?null:Math.min(100,Math.round(e/t*100))},"remainingFromLimit",0,function(e,t){return null==e?null:Math.max(0,e-t)},"usageThresholdState",0,o],159114);let c=null;async function _(){if(!0===c)return!0;try{return await (0,t.query)(`
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
    `),c=!0,!0}catch{return c=!1,!1}}async function E(e){if(!e)return 0;let r=await (0,t.query)(`SELECT COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb, c.plan_id
       FROM customers c
      WHERE c.customer_uid = ?
      LIMIT 1`,[e]).catch(()=>[]);return Number(r[0]?.bandwidth_used_mb||0)}async function S(e){let t=await d(e);return Number((await p(e,t.periodKey)/0x40000000).toFixed(4))}async function p(e,r){if(!e)return 0;if(await _())try{let i=await (0,t.query)(`SELECT COALESCE(SUM(bytes_transferred), 0) AS total
           FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ?`,[e,r]),n=Number(i[0]?.total||0);if(n>0)return n}catch{}return Math.round(1024*await E(e)*1024)}async function m(e,r,i){if(!e||!Number.isFinite(r)||r<=0)return;let n=await d(e),a=i?.eventType||"other_asset_delivery",s=i?.sessionId||null,u=await _();if(u&&s)try{if((await (0,t.query)(`SELECT id FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ? AND session_id = ? AND event_type = ?
          LIMIT 1`,[e,n.periodKey,s,a]))[0])return}catch{}u&&await (0,t.query)(`INSERT INTO bandwidth_usage_events
         (customer_uid, product_id, asset_id, event_type, bytes_transferred, measurement_mode,
          viewer_type, share_link_id, qr_code_id, session_id, billing_period_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[e,i?.productId||null,i?.assetId||null,a,Math.round(r),i?.measurementMode||"recorded",i?.viewerType||null,i?.shareLinkId||null,i?.qrCodeId||null,s,n.periodKey]).catch(e=>console.warn("[bandwidth] event insert failed:",e)),await (0,t.query)(`UPDATE customers
        SET bandwidth_used_mb = COALESCE(bandwidth_used_mb, 0) + ?,
            updated_at = NOW()
      WHERE customer_uid = ?`,[r/1048576,e]).catch(e=>{console.warn("[bandwidth] Failed to record usage:",e)})}async function L(e){if(!(await (0,l.checkSubscription)(e)).active)return{allowed:!1,reason:"This AR experience is temporarily unavailable.",usedMb:0,usedBytes:0,limitGb:0,limitBytes:0,threshold:"exceeded"};let t=await (0,u.resolveCustomerPlanLimits)(e),r=await d(e),i=await p(e,r.periodKey),n=i/1048576,a=t.unlimitedBandwidth?null:Number(t.bandwidthGb??0)||null,s=null==a?null:Math.round(1024*a*1048576),c=o(i,s);return null!=a&&a>0&&n/1024>=a?{allowed:!1,reason:"Monthly bandwidth limit reached for this account.",usedMb:n,usedBytes:i,limitGb:a,limitBytes:s,threshold:"exceeded"}:{allowed:!0,usedMb:n,usedBytes:i,limitGb:a,limitBytes:s,threshold:c}}e.s(["checkCustomerBandwidth",0,L,"getBandwidthUsedBytesInPeriod",0,p,"getCustomerBandwidthUsedGb",0,S,"getCustomerBandwidthUsedMb",0,E,"recordBandwidthUsage",0,m],48857)},346164,e=>{"use strict";let t=`
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
`,i=`
  SELECT COALESCE(SUM(a.size_bytes), 0) AS total
    FROM product_assets a
   WHERE a.customer_uid = ?
     AND COALESCE(a.size_bytes, 0) > 0
     AND (a.deleted_at IS NULL)
     AND (a.status IS NULL OR a.status = 'active')
`,n=`
  SELECT COALESCE(SUM(a.size_bytes), 0) AS total
    FROM product_assets a
   WHERE a.customer_uid = ?
`,a=`
  SELECT COUNT(*) AS total
    FROM product_qr_codes q
   WHERE q.customer_uid = ?
     AND q.deleted_at IS NULL
`,s=`
  SELECT COUNT(*) AS total
    FROM share_links s
   WHERE s.customer_uid = ?
     AND s.deleted_at IS NULL
`;e.s(["PRODUCT_USAGE_COUNT_SQL",0,t,"PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS",0,r,"QR_USAGE_COUNT_SQL",0,a,"SHARE_LINK_USAGE_COUNT_SQL",0,s,"STORAGE_USAGE_SUM_SQL",0,i,"STORAGE_USAGE_SUM_SQL_LEGACY",0,n])},467214,e=>{"use strict";var t=e.i(843793),r=e.i(188180),i=e.i(358047),n=e.i(520952),a=e.i(250376),s=e.i(502820),d=e.i(159114),u=e.i(346164),l=e.i(48857),o=e.i(267965);async function c(e,r){try{let i=await (0,t.query)(e,r);return Number(i[0]?.total||0)}catch{return 0}}async function _(e,r){try{let i=await (0,t.query)(e,r);return Number(i[0]?.total||0)}catch{return 0}}async function E(e){try{let r=await (0,t.query)(u.PRODUCT_USAGE_COUNT_SQL,[e]);return Number(r[0]?.total||0)}catch{try{let r=await (0,t.query)(u.PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS,[e]);return Number(r[0]?.total||0)}catch{return c("SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",[e])}}}async function S(e){try{let r=await (0,t.query)(u.STORAGE_USAGE_SUM_SQL,[e]);return Number(r[0]?.total||0)}catch{return _(u.STORAGE_USAGE_SUM_SQL_LEGACY,[e])}}function p(e,t){return{used:e,limit:t,remaining:(0,d.remainingFromLimit)(t,e),exceeded:(0,d.isExceeded)(e,t),percentUsed:(0,d.percentUsed)(e,t),threshold:(0,d.usageThresholdState)(e,t)}}function m(e,t){return{usedBytes:e,limitBytes:t,remainingBytes:null==t?null:Math.max(0,t-e),percentUsed:(0,d.percentUsed)(e,t),exceeded:(0,d.isExceeded)(e,t),threshold:(0,d.usageThresholdState)(e,t)}}function L(e){if(!e)return null;try{return e instanceof Date?e.toISOString():new Date(e).toISOString()}catch{return null}}async function N(e){let[_,N,T]=await Promise.all([(0,t.query)(`SELECT plan_id, status, billing_period, current_period_start, current_period_end, cancel_at_period_end
         FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,[e]).catch(()=>[]),(0,o.checkSubscription)(e),(0,r.getCustomerBillingPeriod)(e)]),A=_[0],y=A?.plan_id||N.plan?.id||"trial",h=(0,a.mapLegacyPlanId)(y),[U,C,b,g,w,R,O]=await Promise.all([(0,s.resolvePlanLimits)(y),(0,n.getPlanBySlug)(h),E(e),S(e),(0,l.getBandwidthUsedBytesInPeriod)(e,T.periodKey),c(u.QR_USAGE_COUNT_SQL,[e]),c(u.SHARE_LINK_USAGE_COUNT_SQL,[e])]),I=(0,d.normalizePlanLimit)(U.products),f=U.unlimitedStorage||null==U.storageMb?null:Math.round(1024*Number(U.storageMb)*1024),D=U.unlimitedBandwidth||null==U.bandwidthGb?null:Math.round(1024*Number(U.bandwidthGb)*1048576),M=(0,d.normalizePlanLimit)(U.qrCodes??null),v=(0,d.normalizePlanLimit)(U.shareLinks??null),G=String(A?.status||N.reason||"trialing").toLowerCase();return{customerId:e,plan:{id:U.planId,name:C?.name||U.name||h,slug:String(U.planId),level:U.isEnterpriseCustom?(0,i.getPlanLevel)("enterprise"):(0,i.getPlanLevel)(h)},subscription:{status:G,active:N.active,billingPeriod:A?.billing_period||null,periodStart:L(A?.current_period_start)||T.periodStart,periodEnd:L(A?.current_period_end)||T.periodEnd,cancelAtPeriodEnd:!!A?.cancel_at_period_end},products:p(b,I),storage:m(g,f),bandwidth:{...m(w,D),periodStart:T.periodStart,periodEnd:T.periodEnd},qrCodes:p(R,M),shareLinks:p(O,v)}}e.s(["getCustomerUsage",0,N])}];

//# sourceMappingURL=src_lib_06og4hh._.js.map