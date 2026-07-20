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
          WHERE customer_uid = ? AND billing_period_key = ?`,[a,c]),e=Number(d[0]?.total||0);if(e>0)return e}catch{}return Math.round(1024*await k(a)*1024)}a.s(["getBandwidthUsedBytesInPeriod",0,m,"getCustomerBandwidthUsedGb",0,l,"getCustomerBandwidthUsedMb",0,k],410281)}];

//# sourceMappingURL=src_lib_billing_bandwidth_ts_1lkfsz2._.js.map