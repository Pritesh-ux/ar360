module.exports=[522734,(a,b,c)=>{b.exports=a.x("fs",()=>require("fs"))},446786,(a,b,c)=>{b.exports=a.x("os",()=>require("os"))},233405,(a,b,c)=>{b.exports=a.x("child_process",()=>require("child_process"))},921517,(a,b,c)=>{b.exports=a.x("http",()=>require("http"))},524836,(a,b,c)=>{b.exports=a.x("https",()=>require("https"))},679594,(a,b,c)=>{b.exports=a.x("dns",()=>require("dns"))},449719,(a,b,c)=>{b.exports=a.x("assert",()=>require("assert"))},870722,(a,b,c)=>{b.exports=a.x("tty",()=>require("tty"))},925328,(a,b,c)=>{b.exports=a.x("http2",()=>require("http2"))},499190,495705,a=>{"use strict";var b=a.i(721093),c=a.i(749016);a.i(807074);let d={trial:0,free:0,starter:1,basic:1,pro:2,professional:2,business:3,enterprise:4,agency:4};function e(a){return d[(0,c.mapLegacyPlanId)(String(a||"trial").trim())]??0}function f(a,b){return e(b)>e(a)}async function g(a){var d;let f,g=(0,c.mapLegacyPlanId)(a),h=(d=(await (0,b.getBillingPlans)({activeOnly:!1})).filter(a=>(0,c.mapLegacyPlanId)(a.id)===g),d.length?d.reduce((a,b)=>b.id===g&&a.id!==g||b.isActive&&!a.isActive||b.id===g&&a.id===g&&b.sortOrder<a.sortOrder?b:a,d[0]):null);return h?(f=(0,c.mapLegacyPlanId)(h.id),{...h,slug:f,level:e(f)}):null}a.s(["canUpgradeTo",0,f,"getPlanLevel",0,e,"validatePlanUpgrade",0,function(a){let b=(0,c.mapLegacyPlanId)(a.currentPlanId),d=(0,c.mapLegacyPlanId)(a.targetPlanId);return d&&"trial"!==d?!1===a.targetActive?{ok:!1,error:"This plan is no longer available.",code:"inactive"}:!1===a.targetPublic?{ok:!1,error:"This plan is not available for self-service upgrade.",code:"not_public"}:!1===a.allowsOnlineCheckout?{ok:!1,error:"This plan cannot be purchased online. Contact sales.",code:"no_payment"}:e(d)===e(b)?{ok:!1,error:`You are already on the ${d} plan.`,code:"same_plan"}:f(b,d)?{ok:!0}:{ok:!1,error:`Downgrades are not supported. Current plan: ${b}, requested: ${d}.`,code:"downgrade"}:{ok:!1,error:"Selected plan is not available for upgrade.",code:"invalid_plan"}}],495705),a.s(["getPlanBySlug",0,g],499190)},502491,a=>{"use strict";var b=a.i(761469);function c(a){return a?a instanceof Date?a.toISOString().slice(0,19).replace("T"," "):new Date(a).toISOString().slice(0,19).replace("T"," "):null}function d(a){let b=String(a||"trialing").toLowerCase().trim();return"trial"===b?"trialing":b}async function e(a){let c,e="active"===(c=d(a.status))||"trialing"===c||"grace"===c||"past_due"===c?"Active":"Suspended",f=a.resetBandwidth?", bandwidth_used_mb = 0":"";await (0,b.query)(`UPDATE customers
        SET plan_id = ?,
            status = ?,
            updated_at = NOW()
            ${f}
      WHERE customer_uid = ?`,[a.planId,e,a.customerUid])}async function f(a){let f=d(a.status);return await (0,b.query)(`INSERT INTO customer_subscriptions (
       customer_uid, plan_id, status, billing_period,
       trial_started_at, trial_ends_at,
       current_period_start, current_period_end,
       cancel_at_period_end, provider, provider_subscription_id, provider_customer_id,
       grace_ends_at, cancelled_at, trial_used,
       product_limit, storage_limit_mb, bandwidth_limit_mb,
       unlimited_storage, unlimited_bandwidth
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       plan_id = VALUES(plan_id),
       status = VALUES(status),
       billing_period = COALESCE(VALUES(billing_period), billing_period),
       trial_started_at = VALUES(trial_started_at),
       trial_ends_at = VALUES(trial_ends_at),
       current_period_start = VALUES(current_period_start),
       current_period_end = VALUES(current_period_end),
       cancel_at_period_end = VALUES(cancel_at_period_end),
       provider = COALESCE(VALUES(provider), provider),
       provider_subscription_id = COALESCE(VALUES(provider_subscription_id), provider_subscription_id),
       provider_customer_id = COALESCE(VALUES(provider_customer_id), provider_customer_id),
       grace_ends_at = VALUES(grace_ends_at),
       cancelled_at = VALUES(cancelled_at),
       trial_used = COALESCE(VALUES(trial_used), trial_used),
       product_limit = VALUES(product_limit),
       storage_limit_mb = VALUES(storage_limit_mb),
       bandwidth_limit_mb = VALUES(bandwidth_limit_mb),
       unlimited_storage = VALUES(unlimited_storage),
       unlimited_bandwidth = VALUES(unlimited_bandwidth),
       updated_at = NOW()`,[a.customerUid,a.planId,f,a.billingPeriod||null,c(a.trialStartedAt),c(a.trialEndsAt),c(a.currentPeriodStart),c(a.currentPeriodEnd),+!!a.cancelAtPeriodEnd,a.provider||null,a.providerSubscriptionId||null,a.providerCustomerId||null,c(a.graceEndsAt),c(a.cancelledAt),null==a.trialUsed?0:+!!a.trialUsed,a.productLimit,a.storageLimitMb,a.bandwidthLimitMb,+!!a.unlimitedStorage,+!!a.unlimitedBandwidth]),await e({customerUid:a.customerUid,planId:a.planId,status:f,resetBandwidth:a.resetBandwidth}),g(a.customerUid)}async function g(a){return(await (0,b.query)(`SELECT id, customer_uid, plan_id, billing_period AS period, status,
            provider_subscription_id AS razorpay_subscription_id,
            provider_customer_id AS razorpay_customer_id,
            provider_plan_id, provider_mode, provider_status, mandate_status,
            price_version_id, checkout_session_uid,
            sales_channel, classification_status,
            term_mode, renewal_state, renewal_invited_at, renewal_consent_at,
            renewal_checkout_session_uid, renewal_provider_subscription_id,
            current_period_start, current_period_end, trial_ends_at,
            grace_ends_at, renewal_attempt_count, next_retry_at, halted_at,
            cancelled_at, cancel_at_period_end, unlimited_storage, unlimited_bandwidth, created_at, updated_at
     FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,[a]))[0]||null}async function h(a){await (0,b.query)(`INSERT INTO billing_history
      (customer_uid, subscription_id, event_type, title, description, amount_paise, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[a.customerUid,a.subscriptionId||null,a.eventType,a.title,a.description||null,a.amountPaise||null,a.meta?JSON.stringify(a.meta):null])}a.s(["addBillingHistory",0,h,"applySubscriptionChange",0,f])},417935,a=>{a.v(b=>Promise.all(["server/chunks/ssr/src_server_billing_subscription_repository_ts_18juj1c._.js"].map(b=>a.l(b))).then(()=>b(502491)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__018a1or._.js.map