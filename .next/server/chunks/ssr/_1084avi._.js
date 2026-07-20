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
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[a.customerUid,a.subscriptionId||null,a.eventType,a.title,a.description||null,a.amountPaise||null,a.meta?JSON.stringify(a.meta):null])}a.s(["addBillingHistory",0,h,"applySubscriptionChange",0,f])},499190,495705,a=>{"use strict";var b=a.i(721093),c=a.i(749016);a.i(807074);let d={trial:0,free:0,starter:1,basic:1,pro:2,professional:2,business:3,enterprise:4,agency:4};function e(a){return d[(0,c.mapLegacyPlanId)(String(a||"trial").trim())]??0}function f(a,b){return e(b)>e(a)}async function g(a){var d;let f,g=(0,c.mapLegacyPlanId)(a),h=(d=(await (0,b.getBillingPlans)({activeOnly:!1})).filter(a=>(0,c.mapLegacyPlanId)(a.id)===g),d.length?d.reduce((a,b)=>b.id===g&&a.id!==g||b.isActive&&!a.isActive||b.id===g&&a.id===g&&b.sortOrder<a.sortOrder?b:a,d[0]):null);return h?(f=(0,c.mapLegacyPlanId)(h.id),{...h,slug:f,level:e(f)}):null}a.s(["canUpgradeTo",0,f,"getPlanLevel",0,e,"validatePlanUpgrade",0,function(a){let b=(0,c.mapLegacyPlanId)(a.currentPlanId),d=(0,c.mapLegacyPlanId)(a.targetPlanId);return d&&"trial"!==d?!1===a.targetActive?{ok:!1,error:"This plan is no longer available.",code:"inactive"}:!1===a.targetPublic?{ok:!1,error:"This plan is not available for self-service upgrade.",code:"not_public"}:!1===a.allowsOnlineCheckout?{ok:!1,error:"This plan cannot be purchased online. Contact sales.",code:"no_payment"}:e(d)===e(b)?{ok:!1,error:`You are already on the ${d} plan.`,code:"same_plan"}:f(b,d)?{ok:!0}:{ok:!1,error:`Downgrades are not supported. Current plan: ${b}, requested: ${d}.`,code:"downgrade"}:{ok:!1,error:"Selected plan is not available for upgrade.",code:"invalid_plan"}}],495705),a.s(["getPlanBySlug",0,g],499190)},962065,a=>{"use strict";var b=a.i(254799),c=a.i(761469);function d(a){return a?a instanceof Date?a.toISOString():new Date(a).toISOString():null}async function e(){await (0,c.query)(`
    CREATE TABLE IF NOT EXISTS customer_onboarding (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_uid VARCHAR(64) NOT NULL,
      status ENUM('not_started','in_progress','completed','skipped') NOT NULL DEFAULT 'not_started',
      current_step TINYINT UNSIGNED NOT NULL DEFAULT 1,
      completed_at DATETIME NULL,
      skipped_at DATETIME NULL,
      business_type VARCHAR(80) NULL,
      primary_goal VARCHAR(120) NULL,
      secondary_goals_json JSON NULL,
      preferred_creation_method VARCHAR(40) NULL,
      sample_product_created TINYINT(1) NOT NULL DEFAULT 0,
      sample_product_id VARCHAR(160) NULL,
      checklist_dismissed_at DATETIME NULL,
      signup_source VARCHAR(40) NOT NULL DEFAULT 'signup',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_onboarding_customer (customer_uid),
      INDEX idx_onboarding_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);try{await (0,c.query)("ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_website VARCHAR(255) NULL")}catch{}}async function f(a){var b;await e();let f=await (0,c.query)(`SELECT customer_uid, status, current_step, completed_at, skipped_at, business_type, primary_goal,
            secondary_goals_json, preferred_creation_method, sample_product_created, sample_product_id,
            checklist_dismissed_at
       FROM customer_onboarding WHERE customer_uid = ? LIMIT 1`,[a]);return f[0]?{customerUid:(b=f[0]).customer_uid,status:b.status,currentStep:Number(b.current_step||1),completedAt:d(b.completed_at),skippedAt:d(b.skipped_at),businessType:b.business_type,primaryGoal:b.primary_goal,secondaryGoals:function(a){if(!a)return[];try{let b=JSON.parse(a);return Array.isArray(b)?b.map(String):[]}catch{return[]}}(b.secondary_goals_json),preferredCreationMethod:b.preferred_creation_method,sampleProductCreated:!!b.sample_product_created,sampleProductId:b.sample_product_id,checklistDismissedAt:d(b.checklist_dismissed_at)}:null}async function g(a,d="signup"){return await e(),Date.now(),(0,b.randomBytes)(4).toString("hex"),await (0,c.query)(`INSERT INTO customer_onboarding (customer_uid, status, current_step, signup_source)
     VALUES (?, 'not_started', 1, ?)
     ON DUPLICATE KEY UPDATE customer_uid = customer_uid`,[a,d]),f(a)}async function h(a,b){await e();let d=[],g=[];return b.status&&(d.push("status = ?"),g.push(b.status)),null!=b.currentStep&&(d.push("current_step = ?"),g.push(b.currentStep)),void 0!==b.businessType&&(d.push("business_type = ?"),g.push(b.businessType)),void 0!==b.primaryGoal&&(d.push("primary_goal = ?"),g.push(b.primaryGoal)),void 0!==b.secondaryGoals&&(d.push("secondary_goals_json = ?"),g.push(JSON.stringify(b.secondaryGoals))),void 0!==b.preferredCreationMethod&&(d.push("preferred_creation_method = ?"),g.push(b.preferredCreationMethod)),void 0!==b.sampleProductCreated&&(d.push("sample_product_created = ?"),g.push(+!!b.sampleProductCreated)),void 0!==b.sampleProductId&&(d.push("sample_product_id = ?"),g.push(b.sampleProductId)),b.checklistDismissed&&d.push("checklist_dismissed_at = NOW()"),b.completed&&d.push("status = 'completed', completed_at = NOW(), current_step = 5"),b.skipped&&d.push("status = 'skipped', skipped_at = NOW()"),d.length&&(g.push(a),await (0,c.query)(`UPDATE customer_onboarding SET ${d.join(", ")}, updated_at = NOW() WHERE customer_uid = ?`,g)),f(a)}async function i(a){let b=await f(a);return(b||await g(a),b?.status==="completed"||b?.status==="skipped")?b:h(a,{status:"in_progress",currentStep:Math.max(b?.currentStep||1,1)})}a.s(["ensureOnboardingSchema",0,e,"getCustomerOnboarding",0,f,"initializeCustomerOnboarding",0,g,"isOnboardingComplete",0,function(a){return!a||"completed"===a.status||"skipped"===a.status},"markOnboardingStarted",0,i,"updateCustomerOnboarding",0,h])},475082,a=>{"use strict";var b=a.i(903769);a.s([],706129),a.i(706129),a.s(["005e23f0a216045ebb41f7e46ed883c98cbd4fd977",()=>b.logoutAction],475082)},999686,a=>{a.v(b=>Promise.all(["server/chunks/ssr/[externals]__1p0n8kz._.js","server/chunks/ssr/node_modules_13e2z_1._.js"].map(b=>a.l(b))).then(()=>b(743221)))},885589,a=>{a.v(b=>Promise.all(["server/chunks/ssr/src_lib_1wsf76_._.js"].map(b=>a.l(b))).then(()=>b(816928)))}];

//# sourceMappingURL=_1084avi._.js.map