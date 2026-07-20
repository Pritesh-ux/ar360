module.exports=[37123,e=>{"use strict";var t=e.i(843793),n=e.i(366651),r=e.i(563796),a=e.i(147785);function i(e,t){let n=e.getTime()-t.getTime();return n<=0?0:Math.ceil(n/864e5)}async function s(e=new Date){await (0,r.ensureEnterpriseInstallmentSchema)();let u=await (0,t.query)(`SELECT p.payment_uid, r.request_uid, r.contact_name, r.business_email,
            p.amount_paise, p.due_at, p.installment_label, p.reminder_sent_for_days
       FROM enterprise_payments p
       JOIN enterprise_requests r ON r.id = p.request_id
      WHERE p.status = 'pending'
        AND p.due_at IS NOT NULL
        AND p.due_at <= DATE_ADD(?, INTERVAL 7 DAY)
      ORDER BY p.due_at ASC
      LIMIT 200`,[e]).catch(()=>[]),o=0;for(let r of u){let s=new Date(r.due_at);if(Number.isNaN(s.getTime()))continue;let u=i(s,e);if(![7,3,1,0].includes(u)||r.reminder_sent_for_days===u)continue;let d=r.installment_label||"Installment",c=(0,a.formatPaise)(r.amount_paise);try{await (0,n.sendEmail)({to:r.business_email,subject:0===u?`AR360 payment due today — ${d}`:`AR360 payment due in ${u} day${1===u?"":"s"} — ${d}`,text:`Hello ${r.contact_name},

Your AR360 Enterprise ${d} of ${c} is due ${0===u?"today":`in ${u} day(s)`} (${s.toISOString().slice(0,10)}).

Please complete payment to keep your plan in good standing.

Regards,
AR360 Team`,html:`<p>Hello ${r.contact_name},</p><p>Your AR360 Enterprise <strong>${d}</strong> of <strong>${c}</strong> is due ${0===u?"today":`in ${u} day(s)`} (${s.toISOString().slice(0,10)}).</p><p>Please complete payment to keep your plan in good standing.</p><p>Regards,<br>AR360 Team</p>`,template:"enterprise-installment-due"}),await (0,t.query)("UPDATE enterprise_payments SET reminder_sent_for_days = ? WHERE payment_uid = ?",[u,r.payment_uid]),o+=1}catch{}}return{reminded:o,scanned:u.length}}async function u(e=new Date){let r=await (0,t.query)(`SELECT s.customer_uid, COALESCE(c.email, u.email) AS email,
            COALESCE(c.contact_name, u.name) AS contact_name,
            s.plan_id, s.current_period_end, er.request_uid
       FROM customer_subscriptions s
       JOIN customers c ON c.customer_uid = s.customer_uid
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN enterprise_contracts ec ON ec.subscription_id = s.id AND ec.status = 'active'
       LEFT JOIN enterprise_requests er ON er.id = ec.request_id
      WHERE s.provider = 'manual_enterprise'
        AND s.status IN ('active', 'paused')
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end <= DATE_ADD(?, INTERVAL 14 DAY)
      ORDER BY s.current_period_end ASC
      LIMIT 200`,[e]).catch(()=>[]),a=0;for(let s of r){if(!s.email)continue;let r=new Date(s.current_period_end);if(Number.isNaN(r.getTime()))continue;let u=i(r,e);if(![14,7,3,1,0].includes(u))continue;let o=`enterprise-renewal:${s.customer_uid}:${r.toISOString().slice(0,10)}:${u}`,d=await (0,t.query)(`SELECT COUNT(*) AS total FROM billing_history
        WHERE customer_uid = ? AND event_type = 'enterprise_renewal_reminder' AND dedupe_key = ?`,[s.customer_uid,o]).catch(()=>[]);if(!(Number(d[0]?.total||0)>0))try{await (0,n.sendEmail)({to:s.email,subject:0===u?"Your AR360 Enterprise plan renews today":`AR360 Enterprise renewal in ${u} day${1===u?"":"s"}`,text:`Hello ${s.contact_name},

Your AR360 Enterprise plan is due for renewal ${0===u?"today":`in ${u} day(s)`} (${r.toISOString().slice(0,10)}).

Please contact your account manager or complete the renewal payment so access stays uninterrupted.

Regards,
AR360 Team`,html:`<p>Hello ${s.contact_name},</p><p>Your AR360 Enterprise plan is due for renewal ${0===u?"today":`in ${u} day(s)`} (<strong>${r.toISOString().slice(0,10)}</strong>).</p><p>Please complete renewal payment so upload, AR, and QR access stay active.</p><p>Regards,<br>AR360 Team</p>`,template:"enterprise-renewal-reminder"}),await (0,t.query)(`INSERT INTO billing_history
          (customer_uid, event_type, title, description, dedupe_key, meta)
         VALUES (?, 'enterprise_renewal_reminder', ?, ?, ?, ?)`,[s.customer_uid,"Enterprise renewal reminder",`Renewal reminder sent (${u} day(s) remaining).`,o,JSON.stringify({requestUid:s.request_uid,daysRemaining:u})]).catch(()=>void 0),a+=1}catch{}}return{reminded:a,scanned:r.length}}e.s(["runEnterpriseInstallmentReminders",0,s,"runEnterpriseRenewalReminders",0,u])}];

//# sourceMappingURL=src_lib_enterprise-sales_installment-reminders_ts_0bued10._.js.map