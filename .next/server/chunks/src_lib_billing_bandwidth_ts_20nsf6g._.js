module.exports=[48857,188180,159114,e=>{"use strict";e.i(254799);var t=e.i(843793),i=e.i(250376);function r(e){return e.toISOString()}function n(e,t){let i=e.toISOString().slice(0,10),r=t.toISOString().slice(0,10);return`${i}_${r}`}function d(e=new Date){let t=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),1,0,0,0,0)),i=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth()+1,0,23,59,59,999));return{periodStart:r(t),periodEnd:r(i),periodKey:n(t,i),source:"calendar_month"}}async function a(e){if(!e)return!1;let r=(0,i.mapLegacyPlanId)(e),n=await (0,t.query)(`SELECT bandwidth_resets_monthly
       FROM billing_plans
      WHERE id IN (?, ?)
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1`,[e,r,e]).catch(()=>[]);return!!n[0]?.bandwidth_resets_monthly}async function u(e){if(!e)return d();let i=(await (0,t.query)(`SELECT current_period_start, current_period_end, billing_period, plan_id
       FROM customer_subscriptions
      WHERE customer_uid = ?
      LIMIT 1`,[e]).catch(()=>[]))[0];if(!i)return d();let u=String(i.billing_period||"").toLowerCase(),s=await a(i.plan_id);if(("yearly"===u||"annual"===u)&&s)return d();if(i.current_period_start&&i.current_period_end){var o,l;let e,t,d=(o=i.current_period_start,l=i.current_period_end,e=new Date(o),t=new Date(l),Number.isFinite(e.getTime())&&Number.isFinite(t.getTime())?{periodStart:r(e),periodEnd:r(t),periodKey:n(e,t),source:"subscription"}:null);if(d)return d}return d()}e.s(["getCustomerBillingPeriod",0,u],188180);var s=e.i(502820),o=e.i(267965);function l(e,t){if(null==t||t<=0)return"normal";let i=e/t*100;return i>=100?"exceeded":i>=80?"warning":"normal"}e.s(["isExceeded",0,function(e,t){return null!=t&&e>=t},"normalizePlanLimit",0,function(e,t){return t||null==e||e<0?null:0===e&&!1===t?0:e>=0x3b9ac9ff?null:e},"percentUsed",0,function(e,t){return null==t||t<=0?null:Math.min(100,Math.round(e/t*100))},"remainingFromLimit",0,function(e,t){return null==e?null:Math.max(0,e-t)},"usageThresholdState",0,l],159114);let c=null;async function _(){if(!0===c)return!0;try{return await (0,t.query)(`
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
    `),c=!0,!0}catch{return c=!1,!1}}async function E(e){if(!e)return 0;let i=await (0,t.query)(`SELECT COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb, c.plan_id
       FROM customers c
      WHERE c.customer_uid = ?
      LIMIT 1`,[e]).catch(()=>[]);return Number(i[0]?.bandwidth_used_mb||0)}async function N(e){let t=await u(e);return Number((await m(e,t.periodKey)/0x40000000).toFixed(4))}async function m(e,i){if(!e)return 0;if(await _())try{let r=await (0,t.query)(`SELECT COALESCE(SUM(bytes_transferred), 0) AS total
           FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ?`,[e,i]),n=Number(r[0]?.total||0);if(n>0)return n}catch{}return Math.round(1024*await E(e)*1024)}async function h(e,i,r){if(!e||!Number.isFinite(i)||i<=0)return;let n=await u(e),d=r?.eventType||"other_asset_delivery",a=r?.sessionId||null,s=await _();if(s&&a)try{if((await (0,t.query)(`SELECT id FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ? AND session_id = ? AND event_type = ?
          LIMIT 1`,[e,n.periodKey,a,d]))[0])return}catch{}s&&await (0,t.query)(`INSERT INTO bandwidth_usage_events
         (customer_uid, product_id, asset_id, event_type, bytes_transferred, measurement_mode,
          viewer_type, share_link_id, qr_code_id, session_id, billing_period_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[e,r?.productId||null,r?.assetId||null,d,Math.round(i),r?.measurementMode||"recorded",r?.viewerType||null,r?.shareLinkId||null,r?.qrCodeId||null,a,n.periodKey]).catch(e=>console.warn("[bandwidth] event insert failed:",e)),await (0,t.query)(`UPDATE customers
        SET bandwidth_used_mb = COALESCE(bandwidth_used_mb, 0) + ?,
            updated_at = NOW()
      WHERE customer_uid = ?`,[i/1048576,e]).catch(e=>{console.warn("[bandwidth] Failed to record usage:",e)})}async function w(e){if(!(await (0,o.checkSubscription)(e)).active)return{allowed:!1,reason:"This AR experience is temporarily unavailable.",usedMb:0,usedBytes:0,limitGb:0,limitBytes:0,threshold:"exceeded"};let t=await (0,s.resolveCustomerPlanLimits)(e),i=await u(e),r=await m(e,i.periodKey),n=r/1048576,d=t.unlimitedBandwidth?null:Number(t.bandwidthGb??0)||null,a=null==d?null:Math.round(1024*d*1048576),c=l(r,a);return null!=d&&d>0&&n/1024>=d?{allowed:!1,reason:"Monthly bandwidth limit reached for this account.",usedMb:n,usedBytes:r,limitGb:d,limitBytes:a,threshold:"exceeded"}:{allowed:!0,usedMb:n,usedBytes:r,limitGb:d,limitBytes:a,threshold:c}}e.s(["checkCustomerBandwidth",0,w,"getBandwidthUsedBytesInPeriod",0,m,"getCustomerBandwidthUsedGb",0,N,"getCustomerBandwidthUsedMb",0,E,"recordBandwidthUsage",0,h],48857)}];

//# sourceMappingURL=src_lib_billing_bandwidth_ts_20nsf6g._.js.map