module.exports=[577087,t=>{"use strict";var i=t.i(843793);function e(t){return t?t instanceof Date?t.toISOString().slice(0,19).replace("T"," "):new Date(t).toISOString().slice(0,19).replace("T"," "):null}function r(t){let i=String(t||"trialing").toLowerCase().trim();return"trial"===i?"trialing":i}async function d(t){let e,d="active"===(e=r(t.status))||"trialing"===e||"grace"===e||"past_due"===e?"Active":"Suspended",a=t.resetBandwidth?", bandwidth_used_mb = 0":"";await (0,i.query)(`UPDATE customers
        SET plan_id = ?,
            status = ?,
            updated_at = NOW()
            ${a}
      WHERE customer_uid = ?`,[t.planId,d,t.customerUid])}async function a(t){let a=r(t.status);return await (0,i.query)(`INSERT INTO customer_subscriptions (
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
       updated_at = NOW()`,[t.customerUid,t.planId,a,t.billingPeriod||null,e(t.trialStartedAt),e(t.trialEndsAt),e(t.currentPeriodStart),e(t.currentPeriodEnd),+!!t.cancelAtPeriodEnd,t.provider||null,t.providerSubscriptionId||null,t.providerCustomerId||null,e(t.graceEndsAt),e(t.cancelledAt),null==t.trialUsed?0:+!!t.trialUsed,t.productLimit,t.storageLimitMb,t.bandwidthLimitMb,+!!t.unlimitedStorage,+!!t.unlimitedBandwidth]),await d({customerUid:t.customerUid,planId:t.planId,status:a,resetBandwidth:t.resetBandwidth}),n(t.customerUid)}async function n(t){return(await (0,i.query)(`SELECT id, customer_uid, plan_id, billing_period AS period, status,
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
     FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1`,[t]))[0]||null}async function _(t){await (0,i.query)(`INSERT INTO billing_history
      (customer_uid, subscription_id, event_type, title, description, amount_paise, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[t.customerUid,t.subscriptionId||null,t.eventType,t.title,t.description||null,t.amountPaise||null,t.meta?JSON.stringify(t.meta):null])}async function s(t,e=50){return(0,i.query)("SELECT * FROM billing_history WHERE customer_uid = ? ORDER BY created_at DESC LIMIT ?",[t,e])}t.s(["addBillingHistory",0,_,"applySubscriptionChange",0,a,"getSubscriptionByCustomer",0,n,"listBillingHistory",0,s,"syncCustomerPlanMirror",0,d])}];

//# sourceMappingURL=src_server_billing_subscription_repository_ts_1cy_145._.js.map