module.exports=[820820,t=>{"use strict";var e=t.i(254799),s=t.i(843793);function r(t){return t?t instanceof Date?t.toISOString():new Date(t).toISOString():null}async function a(){await (0,s.query)(`
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
  `);try{await (0,s.query)("ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_website VARCHAR(255) NULL")}catch{}}async function u(t){var e;await a();let u=await (0,s.query)(`SELECT customer_uid, status, current_step, completed_at, skipped_at, business_type, primary_goal,
            secondary_goals_json, preferred_creation_method, sample_product_created, sample_product_id,
            checklist_dismissed_at
       FROM customer_onboarding WHERE customer_uid = ? LIMIT 1`,[t]);return u[0]?{customerUid:(e=u[0]).customer_uid,status:e.status,currentStep:Number(e.current_step||1),completedAt:r(e.completed_at),skippedAt:r(e.skipped_at),businessType:e.business_type,primaryGoal:e.primary_goal,secondaryGoals:function(t){if(!t)return[];try{let e=JSON.parse(t);return Array.isArray(e)?e.map(String):[]}catch{return[]}}(e.secondary_goals_json),preferredCreationMethod:e.preferred_creation_method,sampleProductCreated:!!e.sample_product_created,sampleProductId:e.sample_product_id,checklistDismissedAt:r(e.checklist_dismissed_at)}:null}async function o(t,r="signup"){return await a(),Date.now(),(0,e.randomBytes)(4).toString("hex"),await (0,s.query)(`INSERT INTO customer_onboarding (customer_uid, status, current_step, signup_source)
     VALUES (?, 'not_started', 1, ?)
     ON DUPLICATE KEY UPDATE customer_uid = customer_uid`,[t,r]),u(t)}async function i(t,e){await a();let r=[],o=[];return e.status&&(r.push("status = ?"),o.push(e.status)),null!=e.currentStep&&(r.push("current_step = ?"),o.push(e.currentStep)),void 0!==e.businessType&&(r.push("business_type = ?"),o.push(e.businessType)),void 0!==e.primaryGoal&&(r.push("primary_goal = ?"),o.push(e.primaryGoal)),void 0!==e.secondaryGoals&&(r.push("secondary_goals_json = ?"),o.push(JSON.stringify(e.secondaryGoals))),void 0!==e.preferredCreationMethod&&(r.push("preferred_creation_method = ?"),o.push(e.preferredCreationMethod)),void 0!==e.sampleProductCreated&&(r.push("sample_product_created = ?"),o.push(+!!e.sampleProductCreated)),void 0!==e.sampleProductId&&(r.push("sample_product_id = ?"),o.push(e.sampleProductId)),e.checklistDismissed&&r.push("checklist_dismissed_at = NOW()"),e.completed&&r.push("status = 'completed', completed_at = NOW(), current_step = 5"),e.skipped&&r.push("status = 'skipped', skipped_at = NOW()"),r.length&&(o.push(t),await (0,s.query)(`UPDATE customer_onboarding SET ${r.join(", ")}, updated_at = NOW() WHERE customer_uid = ?`,o)),u(t)}async function d(t){let e=await u(t);return(e||await o(t),e?.status==="completed"||e?.status==="skipped")?e:i(t,{status:"in_progress",currentStep:Math.max(e?.currentStep||1,1)})}t.s(["ensureOnboardingSchema",0,a,"getCustomerOnboarding",0,u,"initializeCustomerOnboarding",0,o,"isOnboardingComplete",0,function(t){return!t||"completed"===t.status||"skipped"===t.status},"markOnboardingStarted",0,d,"updateCustomerOnboarding",0,i])}];

//# sourceMappingURL=src_lib_onboarding_onboarding_service_ts_0fbin34._.js.map