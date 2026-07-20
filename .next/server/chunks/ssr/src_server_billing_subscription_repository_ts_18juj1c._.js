module.exports=[502491,a=>{"use strict";var b=a.i(761469);function c(a){return a?a instanceof Date?a.toISOString().slice(0,19).replace("T"," "):new Date(a).toISOString().slice(0,19).replace("T"," "):null}function d(a){let b=String(a||"trialing").toLowerCase().trim();return"trial"===b?"trialing":b}async function e(a){let c,e="active"===(c=d(a.status))||"trialing"===c||"grace"===c||"past_due"===c?"Active":"Suspended",f=a.resetBandwidth?", bandwidth_used_mb = 0":"";await (0,b.query)(`UPDATE customers
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
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[a.customerUid,a.subscriptionId||null,a.eventType,a.title,a.description||null,a.amountPaise||null,a.meta?JSON.stringify(a.meta):null])}a.s(["addBillingHistory",0,h,"applySubscriptionChange",0,f])}];

//# sourceMappingURL=src_server_billing_subscription_repository_ts_18juj1c._.js.map