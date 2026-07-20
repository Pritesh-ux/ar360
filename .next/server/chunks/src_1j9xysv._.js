module.exports=[267965,e=>{"use strict";var t=e.i(843793),a=e.i(954116);async function i(r,s=!1){if(!r)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let n=(await (0,t.query)(`SELECT 
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
     LIMIT 1`,[r]).catch(e=>(console.error("checkSubscription query error:",e),[])))[0];if(!n)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let{getBillingPlans:u}=await e.A(828945),{mapLegacyPlanId:l}=await e.A(245551),c=await u({activeOnly:!1}).catch(()=>[]),d=e=>c.find(t=>t.id===l(e))||(0,a.getPlanById)(e);if("Suspended"===n.customer_status||"Suspended"===n.user_status||"Deleted"===n.customer_status||"Deleted"===n.user_status)return{active:!1,reason:"inactive",plan:n.plan_id?d(n.plan_id):null,expiresAt:null,daysRemaining:0};let _=n.plan_id;if(!_)return{active:!1,reason:"missing_plan",plan:null,expiresAt:null,daysRemaining:0};let o=d(_),p=n.sub_status?String(n.sub_status).toLowerCase().trim():"",m=null;m="trialing"===p||"trial"===p?n.trial_ends_at?new Date(n.trial_ends_at):null:"grace"===p||"past_due"===p?n.grace_ends_at?new Date(n.grace_ends_at):null:n.current_period_end?new Date(n.current_period_end):null;let v=new Date,g=m?m.toISOString():null,y=0;m&&(y=Math.max(0,Math.ceil((m.getTime()-v.getTime())/864e5)));let f=!!m&&v.getTime()>m.getTime();if("active"!==p&&"trialing"!==p&&"trial"!==p&&"grace"!==p&&"past_due"!==p){let e="inactive";return"cancelled"===p?e="cancelled":"expired"===p?e="expired":("past_due"===p||"failed"===p||"payment_failed"===p)&&(e="payment_failed"),{active:!1,reason:e,plan:o,expiresAt:g,daysRemaining:y}}if(f){if("razorpay"===n.provider&&!s)try{let{reconcileBeforeNativeExpiry:t}=await e.A(817691);return await t(r),i(r,!0)}catch(e){return console.error("Native subscription expiry reconciliation failed:",e),await (0,t.query)("UPDATE customer_subscriptions SET reconciliation_required = 1 WHERE customer_uid = ?",[r]).catch(()=>void 0),{active:!0,reason:"active",plan:o,expiresAt:g,daysRemaining:0}}return{active:!1,reason:"expired",plan:o,expiresAt:g,daysRemaining:0}}return{active:!0,reason:"active",plan:o,expiresAt:g,daysRemaining:y}}e.s(["checkSubscription",0,i])},245551,e=>{e.v(e=>Promise.resolve().then(()=>e(250376)))},817691,e=>{e.v(t=>Promise.all(["server/chunks/src_1715reo._.js","server/chunks/src_server_billing_1e-14nn._.js"].map(t=>e.l(t))).then(()=>t(809844)))}];

//# sourceMappingURL=src_1j9xysv._.js.map