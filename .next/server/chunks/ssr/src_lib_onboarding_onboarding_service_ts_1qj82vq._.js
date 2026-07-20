module.exports=[962065,a=>{"use strict";var b=a.i(254799),c=a.i(761469);function d(a){return a?a instanceof Date?a.toISOString():new Date(a).toISOString():null}async function e(){await (0,c.query)(`
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
     ON DUPLICATE KEY UPDATE customer_uid = customer_uid`,[a,d]),f(a)}async function h(a,b){await e();let d=[],g=[];return b.status&&(d.push("status = ?"),g.push(b.status)),null!=b.currentStep&&(d.push("current_step = ?"),g.push(b.currentStep)),void 0!==b.businessType&&(d.push("business_type = ?"),g.push(b.businessType)),void 0!==b.primaryGoal&&(d.push("primary_goal = ?"),g.push(b.primaryGoal)),void 0!==b.secondaryGoals&&(d.push("secondary_goals_json = ?"),g.push(JSON.stringify(b.secondaryGoals))),void 0!==b.preferredCreationMethod&&(d.push("preferred_creation_method = ?"),g.push(b.preferredCreationMethod)),void 0!==b.sampleProductCreated&&(d.push("sample_product_created = ?"),g.push(+!!b.sampleProductCreated)),void 0!==b.sampleProductId&&(d.push("sample_product_id = ?"),g.push(b.sampleProductId)),b.checklistDismissed&&d.push("checklist_dismissed_at = NOW()"),b.completed&&d.push("status = 'completed', completed_at = NOW(), current_step = 5"),b.skipped&&d.push("status = 'skipped', skipped_at = NOW()"),d.length&&(g.push(a),await (0,c.query)(`UPDATE customer_onboarding SET ${d.join(", ")}, updated_at = NOW() WHERE customer_uid = ?`,g)),f(a)}async function i(a){let b=await f(a);return(b||await g(a),b?.status==="completed"||b?.status==="skipped")?b:h(a,{status:"in_progress",currentStep:Math.max(b?.currentStep||1,1)})}a.s(["ensureOnboardingSchema",0,e,"getCustomerOnboarding",0,f,"initializeCustomerOnboarding",0,g,"isOnboardingComplete",0,function(a){return!a||"completed"===a.status||"skipped"===a.status},"markOnboardingStarted",0,i,"updateCustomerOnboarding",0,h])}];

//# sourceMappingURL=src_lib_onboarding_onboarding_service_ts_1qj82vq._.js.map