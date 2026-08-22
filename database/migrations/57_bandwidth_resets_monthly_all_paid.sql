-- Yearly billing: monthly bandwidth reset on all self-service paid plans.
UPDATE billing_plans
   SET bandwidth_resets_monthly = 1
 WHERE id IN ('starter', 'intermediate', 'pro', 'business');
