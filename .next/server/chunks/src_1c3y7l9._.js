module.exports=[809844,i=>{"use strict";var e=i.i(254799),t=i.i(843793),r=i.i(6588),a=i.i(42176),s=i.i(502820);function d(){return{fetchSubscription:async i=>(await (0,r.getRazorpayClient)()).subscriptions.fetch(i),async listPayments(i){let e=await (0,r.getRazorpayClient)();return(await e.payments.all({subscription_id:i})).items||[]},async listRefunds(i){let e=await (0,r.getRazorpayClient)();return(await e.payments.fetchMultipleRefund(i)).items||[]}}}function n(i){return i?new Date(1e3*i).toISOString().slice(0,19).replace("T"," "):null}async function o(i,r,a,s){let d=i.provider_subscription_id;await (0,t.query)(`INSERT INTO billing_reconciliation_issues
      (issue_uid, issue_type, severity, customer_uid, subscription_id, provider,
       provider_object_type, provider_object_id, local_object_type, local_object_id, summary, details)
     VALUES (?, ?, 'warning', ?, ?, 'razorpay', 'subscription', ?,
       'customer_subscription', ?, ?, ?)
     ON DUPLICATE KEY UPDATE last_seen_at = NOW(), summary = VALUES(summary), details = VALUES(details),
       status = IF(status = 'resolved', 'open', status), resolved_at = NULL`,[`bri_${e.default.randomUUID().replace(/-/g,"")}`,r,i.customer_uid,i.id,d,String(i.id),a,JSON.stringify(s)])}async function _(i,e=d()){var r;let c=await e.fetchSubscription(i.provider_subscription_id);if(!c?.id||c.id!==i.provider_subscription_id||!c.status)throw Error("Invalid Razorpay reconciliation response.");let u=0,p=["active","authenticated"].includes(r=c.status)?"active":"paused"===r?"paused":"pending"===r?"past_due":"halted"===r?"halted":"cancelled"===r?"cancelled":"completed"===r?"completed":null;for(let e of(p&&(i.status!==p||i.provider_status!==c.status)?(await o(i,"subscription_status_mismatch","Provider/local subscription status mismatch.",{local:i.status,provider:c.status}),await (0,t.query)(`UPDATE customer_subscriptions SET status = ?, provider_status = ?,
          current_period_start = COALESCE(?, current_period_start),
          current_period_end = COALESCE(?, current_period_end),
          cancelled_at = IF(? IN ('cancelled','completed'), COALESCE(?, NOW()), cancelled_at),
          last_reconciled_at = NOW(), reconciliation_required = 0, updated_at = NOW()
        WHERE id = ?`,[p,c.status,n(c.current_start),n(c.current_end),p,n(c.ended_at),i.id]),await (0,t.query)("UPDATE customers SET plan_id = ?, status = ?, updated_at = NOW() WHERE customer_uid = ?",[i.plan_id,["active","past_due"].includes(p)?"Active":"Suspended",i.customer_uid]),u+=1):await (0,t.query)("UPDATE customer_subscriptions SET provider_status = ?, last_reconciled_at = NOW(), reconciliation_required = 0 WHERE id = ?",[c.status,i.id]),["cancelled","completed"].includes(c.status)&&await (0,t.query)(`UPDATE billing_scheduled_changes SET status = 'applied', applied_at = NOW()
        WHERE subscription_id = ? AND change_type = 'cancellation' AND status = 'scheduled'`,[i.id]),await (0,t.query)(`SELECT sc.id, sc.to_plan_id, sc.to_price_version_id, pv.provider_plan_id
       FROM billing_scheduled_changes sc
       JOIN billing_plan_price_versions pv ON pv.id = sc.to_price_version_id
      WHERE sc.subscription_id = ? AND sc.status = 'scheduled' AND sc.effective_at <= NOW()`,[i.id]))){if(!e.to_plan_id||c.plan_id!==e.provider_plan_id){await o(i,"scheduled_change_mismatch","Scheduled plan change is due but not effective at provider.",{remotePlanId:c.plan_id,expectedProviderPlanId:e.provider_plan_id});continue}let r=await (0,s.resolvePlanLimits)(e.to_plan_id);await (0,t.query)(`UPDATE customer_subscriptions SET plan_id = ?, price_version_id = ?, provider_plan_id = ?,
          product_limit = ?, storage_limit_mb = ?, bandwidth_limit_mb = ?, updated_at = NOW()
        WHERE id = ?`,[e.to_plan_id,e.to_price_version_id,e.provider_plan_id,r.products,r.storageMb,r.unlimitedBandwidth?null:Math.round(1024*Number(r.bandwidthGb||0)),i.id]),await (0,t.query)("UPDATE customers SET plan_id = ?, updated_at = NOW() WHERE customer_uid = ?",[e.to_plan_id,i.customer_uid]),await (0,t.query)("UPDATE billing_scheduled_changes SET status = 'applied', applied_at = NOW() WHERE id = ?",[e.id]),u+=1}for(let r of(await e.listPayments(i.provider_subscription_id)).filter(i=>"captured"===i.status))for(let s of((await (0,t.query)("SELECT id, invoice_uid FROM billing_payments WHERE razorpay_payment_id = ? LIMIT 1",[r.id]))[0]||(await o(i,"missed_payment_webhook","Captured provider payment was missing locally.",r),await (0,t.query)(`INSERT INTO billing_payments
          (payment_uid, customer_uid, order_uid, razorpay_order_id, razorpay_payment_id,
           amount_paise, currency, status, raw_payload, subscription_id, provider,
           provider_subscription_id, captured_at)
         VALUES (?, ?, ?, '', ?, ?, ?, 'captured', ?, ?, 'razorpay', ?, ?)`,[`pay_rzp_${r.id}`,i.customer_uid,`subscription:${i.provider_subscription_id}`,r.id,r.amount,r.currency||"INR",JSON.stringify(r),i.id,i.provider_subscription_id,n(r.captured_at)]),u+=1),(await (0,t.query)("SELECT id FROM billing_invoices WHERE razorpay_payment_id = ? LIMIT 1",[r.id]))[0]||(await o(i,"missing_invoice","Captured provider payment had no local invoice.",r),await (0,a.finalizePaymentInvoice)({customerUid:i.customer_uid,planId:i.plan_id,period:i.billing_period,amountPaise:Number(r.amount),razorpayPaymentId:r.id,subscriptionId:i.id,paidAt:n(r.captured_at)}),u+=1),await e.listRefunds(r.id).catch(()=>[])))await (0,t.query)(`INSERT INTO billing_refunds
          (refund_uid, customer_uid, billing_payment_id, provider, provider_mode,
           provider_payment_id, provider_refund_id, amount_paise, currency, status, raw_payload, processed_at)
         SELECT ?, ?, bp.id, 'razorpay', COALESCE(bp.provider_mode, 'test'), ?, ?, ?, ?, ?, ?, ?
           FROM billing_payments bp WHERE bp.razorpay_payment_id = ? LIMIT 1
         ON DUPLICATE KEY UPDATE status = VALUES(status), raw_payload = VALUES(raw_payload),
           processed_at = COALESCE(processed_at, VALUES(processed_at))`,[`refund_rzp_${s.id}`,i.customer_uid,r.id,s.id,s.amount,s.currency||"INR","processed"===s.status?"processed":"pending",JSON.stringify(s),"processed"===s.status?n(s.created_at):null,r.id]);return{repaired:u}}async function c(i=50,r=d()){let a=`brr_${e.default.randomUUID().replace(/-/g,"")}`;await (0,t.query)("INSERT INTO billing_reconciliation_runs (run_uid) VALUES (?)",[a]);let s=0,n=0,u=await (0,t.query)(`SELECT id, customer_uid, plan_id, billing_period, status, provider_status,
            provider_subscription_id, current_period_end
       FROM customer_subscriptions
      WHERE provider = 'razorpay' AND provider_subscription_id IS NOT NULL
        AND (reconciliation_required = 1 OR last_reconciled_at IS NULL
          OR last_reconciled_at < DATE_SUB(NOW(), INTERVAL 6 HOUR)
          OR current_period_end < NOW())
      ORDER BY reconciliation_required DESC, COALESCE(last_reconciled_at, '1970-01-01')
      LIMIT ?`,[i]);for(let i of u)try{let e=await _(i,r);s+=e.repaired}catch(e){n+=1,await o(i,"provider_reconciliation_failed","Provider reconciliation failed.",{error:e instanceof Error?e.message:String(e)}),await (0,t.query)("UPDATE customer_subscriptions SET reconciliation_required = 1 WHERE id = ?",[i.id])}return await (0,t.query)(`UPDATE billing_reconciliation_runs SET status = 'completed', scanned_count = ?,
        repaired_count = ?, issue_count = ?, completed_at = NOW() WHERE run_uid = ?`,[u.length,s,n,a]),{runUid:a,scanned:u.length,repaired:s,issues:n}}async function u(i,e){let r=await (0,t.query)(`SELECT id, customer_uid, plan_id, billing_period, status, provider_status,
            provider_subscription_id, current_period_end
       FROM customer_subscriptions
      WHERE customer_uid = ? AND provider = 'razorpay' AND provider_subscription_id IS NOT NULL LIMIT 1`,[i]);return r[0]?_(r[0],e):null}i.s(["reconcileBeforeNativeExpiry",0,u,"runProviderReconciliationBatch",0,c])},989186,i=>{i.v(i=>Promise.resolve().then(()=>i(843793)))},856299,i=>{i.v(e=>Promise.all(["server/chunks/src_server_billing_invoice_repository_ts_0iy2rwy._.js"].map(e=>i.l(e))).then(()=>e(823337)))}];

//# sourceMappingURL=src_1c3y7l9._.js.map