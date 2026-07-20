module.exports=[48857,188180,159114,e=>{"use strict";e.i(254799);var t=e.i(843793),i=e.i(250376);function r(e){return e.toISOString()}function n(e,t){let i=e.toISOString().slice(0,10),r=t.toISOString().slice(0,10);return`${i}_${r}`}function a(e=new Date){let t=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),1,0,0,0,0)),i=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth()+1,0,23,59,59,999));return{periodStart:r(t),periodEnd:r(i),periodKey:n(t,i),source:"calendar_month"}}async function s(e){if(!e)return!1;let r=(0,i.mapLegacyPlanId)(e),n=await (0,t.query)(`SELECT bandwidth_resets_monthly
       FROM billing_plans
      WHERE id IN (?, ?)
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1`,[e,r,e]).catch(()=>[]);return!!n[0]?.bandwidth_resets_monthly}async function c(e){if(!e)return a();let i=(await (0,t.query)(`SELECT current_period_start, current_period_end, billing_period, plan_id
       FROM customer_subscriptions
      WHERE customer_uid = ?
      LIMIT 1`,[e]).catch(()=>[]))[0];if(!i)return a();let c=String(i.billing_period||"").toLowerCase(),u=await s(i.plan_id);if(("yearly"===c||"annual"===c)&&u)return a();if(i.current_period_start&&i.current_period_end){var o,d;let e,t,a=(o=i.current_period_start,d=i.current_period_end,e=new Date(o),t=new Date(d),Number.isFinite(e.getTime())&&Number.isFinite(t.getTime())?{periodStart:r(e),periodEnd:r(t),periodKey:n(e,t),source:"subscription"}:null);if(a)return a}return a()}e.s(["getCustomerBillingPeriod",0,c],188180);var u=e.i(502820),o=e.i(267965);function d(e,t){if(null==t||t<=0)return"normal";let i=e/t*100;return i>=100?"exceeded":i>=80?"warning":"normal"}e.s(["isExceeded",0,function(e,t){return null!=t&&e>=t},"normalizePlanLimit",0,function(e,t){return t||null==e||e<0?null:0===e&&!1===t?0:e>=0x3b9ac9ff?null:e},"percentUsed",0,function(e,t){return null==t||t<=0?null:Math.min(100,Math.round(e/t*100))},"remainingFromLimit",0,function(e,t){return null==e?null:Math.max(0,e-t)},"usageThresholdState",0,d],159114);let _=null;async function l(){if(!0===_)return!0;try{return await (0,t.query)(`
      CREATE TABLE IF NOT EXISTS bandwidth_usage_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        customer_uid VARCHAR(64) NOT NULL,
        product_id VARCHAR(160) NULL,
        asset_id BIGINT UNSIGNED NULL,
        event_type VARCHAR(40) NOT NULL,
        bytes_transferred BIGINT UNSIGNED NOT NULL DEFAULT 0,
        measurement_mode ENUM('recorded','estimated') NOT NULL DEFAULT 'recorded',
        viewer_type VARCHAR(40) NULL,
        share_link_id BIGINT UNSIGNED NULL,
        qr_code_id BIGINT UNSIGNED NULL,
        session_id VARCHAR(64) NULL,
        billing_period_key VARCHAR(32) NOT NULL,
        occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bandwidth_events_customer_period (customer_uid, billing_period_key),
        INDEX idx_bandwidth_events_occurred (occurred_at),
        INDEX idx_bandwidth_events_session (session_id, event_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),_=!0,!0}catch{return _=!1,!1}}async function m(e){if(!e)return 0;let i=await (0,t.query)(`SELECT COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb, c.plan_id
       FROM customers c
      WHERE c.customer_uid = ?
      LIMIT 1`,[e]).catch(()=>[]);return Number(i[0]?.bandwidth_used_mb||0)}async function p(e){let t=await c(e);return Number((await E(e,t.periodKey)/0x40000000).toFixed(4))}async function E(e,i){if(!e)return 0;if(await l())try{let r=await (0,t.query)(`SELECT COALESCE(SUM(bytes_transferred), 0) AS total
           FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ?`,[e,i]),n=Number(r[0]?.total||0);if(n>0)return n}catch{}return Math.round(1024*await m(e)*1024)}async function b(e,i,r){if(!e||!Number.isFinite(i)||i<=0)return;let n=await c(e),a=r?.eventType||"other_asset_delivery",s=r?.sessionId||null,u=await l();if(u&&s)try{if((await (0,t.query)(`SELECT id FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ? AND session_id = ? AND event_type = ?
          LIMIT 1`,[e,n.periodKey,s,a]))[0])return}catch{}u&&await (0,t.query)(`INSERT INTO bandwidth_usage_events
         (customer_uid, product_id, asset_id, event_type, bytes_transferred, measurement_mode,
          viewer_type, share_link_id, qr_code_id, session_id, billing_period_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[e,r?.productId||null,r?.assetId||null,a,Math.round(i),r?.measurementMode||"recorded",r?.viewerType||null,r?.shareLinkId||null,r?.qrCodeId||null,s,n.periodKey]).catch(e=>console.warn("[bandwidth] event insert failed:",e)),await (0,t.query)(`UPDATE customers
        SET bandwidth_used_mb = COALESCE(bandwidth_used_mb, 0) + ?,
            updated_at = NOW()
      WHERE customer_uid = ?`,[i/1048576,e]).catch(e=>{console.warn("[bandwidth] Failed to record usage:",e)})}async function N(e){if(!(await (0,o.checkSubscription)(e)).active)return{allowed:!1,reason:"This AR experience is temporarily unavailable.",usedMb:0,usedBytes:0,limitGb:0,limitBytes:0,threshold:"exceeded"};let t=await (0,u.resolveCustomerPlanLimits)(e),i=await c(e),r=await E(e,i.periodKey),n=r/1048576,a=t.unlimitedBandwidth?null:Number(t.bandwidthGb??0)||null,s=null==a?null:Math.round(1024*a*1048576),_=d(r,s);return null!=a&&a>0&&n/1024>=a?{allowed:!1,reason:"Monthly bandwidth limit reached for this account.",usedMb:n,usedBytes:r,limitGb:a,limitBytes:s,threshold:"exceeded"}:{allowed:!0,usedMb:n,usedBytes:r,limitGb:a,limitBytes:s,threshold:_}}e.s(["checkCustomerBandwidth",0,N,"getBandwidthUsedBytesInPeriod",0,E,"getCustomerBandwidthUsedGb",0,p,"getCustomerBandwidthUsedMb",0,m,"recordBandwidthUsage",0,b],48857)},705055,e=>{"use strict";var t=e.i(254799),i=e.i(843793),r=e.i(48857),n=e.i(496637);function a(e){return null==e?null:Number(e)}async function s(e){return(await (0,i.query)(`SELECT ec.id AS contract_id, ec.contract_uid, ec.starts_on, ec.expires_on,
            cp.custom_plan_uid, cp.name, cp.billing_cycle, cp.price_paise,
            cp.storage_limit_bytes, cp.bandwidth_limit_bytes, cp.product_limit,
            cp.model_limit, cp.ar_experience_limit, cp.team_member_limit,
            cp.custom_branding, cp.priority_support, cp.dedicated_infrastructure,
            cp.sla_support, cp.support_level, cp.notes,
            renewal.request_uid AS renewal_request_uid
       FROM customers customer
       JOIN enterprise_contracts ec ON ec.customer_id = customer.id
       JOIN enterprise_custom_plans cp ON cp.id = ec.custom_plan_id AND cp.is_active = 1
       LEFT JOIN enterprise_requests renewal ON renewal.renewal_of_contract_id = ec.id
      WHERE customer.customer_uid = ?
        AND ec.status = 'active'
        AND ec.starts_on <= CURDATE()
        AND ec.expires_on >= CURDATE()
      ORDER BY ec.expires_on DESC, ec.id DESC
      LIMIT 1`,[e]))[0]||null}async function c(e){return!!await s(e)}async function u(e,t){try{let r=await (0,i.query)(e,[t]);return Number(r[0]?.total||0)}catch{return 0}}async function o(e){let[t,i,n,a,s]=await Promise.all([u("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM product_assets WHERE customer_uid = ?",e),u("SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",e),u(`SELECT COUNT(*) AS total FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND (COALESCE(model_url, '') <> '' OR LOWER(COALESCE(file_name, '')) LIKE '%.glb')`,e),u(`SELECT COUNT(*) AS total FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND LOWER(COALESCE(status, '')) IN ('published', 'active')`,e),(0,r.getCustomerBandwidthUsedMb)(e).catch(()=>0)]);return{storageBytes:t,bandwidthBytes:Math.round(1024*s*1024),products:i,models:n,arExperiences:a}}async function d(e){let t=await s(e);if(!t)return null;let[r,n]=await Promise.all([o(e),(0,i.query)(`SELECT DISTINCT invoice.invoice_uid, invoice.invoice_number, invoice.status,
              invoice.total_paise, invoice.currency, invoice.created_at, invoice.paid_at
         FROM enterprise_payments payment
         JOIN billing_invoices invoice ON invoice.id = payment.invoice_id
         JOIN customers customer ON customer.customer_uid = invoice.customer_uid
        WHERE payment.contract_id = ?
          AND customer.customer_uid = ?
          AND invoice.customer_uid = ?
        ORDER BY invoice.created_at DESC`,[t.contract_id,e,e])]);return{contract:{contractUid:t.contract_uid,startsOn:t.starts_on,expiresOn:t.expires_on,status:"active",renewalRequestUid:t.renewal_request_uid},plan:{customPlanUid:t.custom_plan_uid,name:t.name,billingCycle:t.billing_cycle,pricePaise:Number(t.price_paise),notes:t.notes,limits:{storageBytes:a(t.storage_limit_bytes),bandwidthBytes:a(t.bandwidth_limit_bytes),products:a(t.product_limit),models:a(t.model_limit),arExperiences:a(t.ar_experience_limit),teamMembers:a(t.team_member_limit)},flags:{customBranding:!!t.custom_branding,prioritySupport:!!t.priority_support,dedicatedInfrastructure:!!t.dedicated_infrastructure,slaSupport:!!t.sla_support,supportLevel:t.support_level}},usage:r,invoices:n.map(e=>({invoiceUid:e.invoice_uid,invoiceNumber:e.invoice_number,status:e.status,totalPaise:Number(e.total_paise),currency:e.currency,createdAt:e.created_at,paidAt:e.paid_at,downloadUrl:`/api/billing/invoices/${encodeURIComponent(e.invoice_uid)}/download?format=pdf`}))}}async function _(e){let r=await (0,i.getPool)(),a=await r.getConnection();try{await a.beginTransaction();let[i]=await a.execute(`SELECT ec.id, ec.contract_uid, ec.expires_on, customer.id AS customer_id,
              customer.company_name, customer.contact_name, customer.email, customer.phone,
              customer.country, source.company_website, source.industry,
              cp.product_limit, cp.storage_limit_bytes, cp.bandwidth_limit_bytes,
              cp.team_member_limit, cp.custom_branding, cp.dedicated_infrastructure,
              cp.priority_support, cp.sla_support
         FROM customers customer
         JOIN enterprise_contracts ec ON ec.customer_id = customer.id
         JOIN enterprise_custom_plans cp ON cp.id = ec.custom_plan_id AND cp.is_active = 1
         JOIN enterprise_requests source ON source.id = ec.request_id
        WHERE customer.customer_uid = ?
          AND ec.status = 'active'
          AND ec.starts_on <= CURDATE()
          AND ec.expires_on >= CURDATE()
        ORDER BY ec.expires_on DESC, ec.id DESC
        LIMIT 1 FOR UPDATE`,[e]),r=i[0];if(!r)return await a.rollback(),null;let[s]=await a.execute("SELECT request_uid FROM enterprise_requests WHERE renewal_of_contract_id = ? LIMIT 1",[r.id]),c=(0,n.renewalResultFromExisting)(s[0]);if(c)return await a.commit(),c;let u=`ER-${new Date().getUTCFullYear()}-${t.default.randomBytes(4).toString("hex").toUpperCase()}`;return await a.execute(`INSERT INTO enterprise_requests (
        request_uid, company_name, contact_name, business_email, phone, company_website,
        country, industry, expected_products, expected_storage_gb,
        expected_monthly_bandwidth_gb, needs_more_storage, needs_more_bandwidth,
        needs_more_products, needs_team_members, needs_custom_branding,
        needs_dedicated_infrastructure, needs_priority_support, needs_sla,
        additional_requirements, customer_id, renewal_of_contract_id, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[u,r.company_name||r.contact_name,r.contact_name,r.email,r.phone||"",r.company_website,r.country||"India",r.industry||"Other",r.product_limit,null==r.storage_limit_bytes?null:Math.ceil(Number(r.storage_limit_bytes)/1024/1024/1024),null==r.bandwidth_limit_bytes?null:Math.ceil(Number(r.bandwidth_limit_bytes)/1024/1024/1024),!1,!1,!1,Number(r.team_member_limit||0)>1,!!r.custom_branding,!!r.dedicated_infrastructure,!!r.priority_support,!!r.sla_support,`Renewal requested for contract ${r.contract_uid}, expiring ${r.expires_on}.`,r.customer_id,r.id,"enterprise_dashboard_renewal"]),await a.commit(),{requestUid:u,created:!0}}catch(t){if(await a.rollback(),(0,n.isDuplicateEntryError)(t)){let t=await s(e),i=(0,n.renewalResultFromExisting)(t?{request_uid:t.renewal_request_uid}:null);if(i)return i}throw t}finally{a.release()}}e.s(["createEnterpriseRenewalRequest",0,_,"getEnterpriseDashboard",0,d,"hasActiveEnterpriseContract",0,c])}];

//# sourceMappingURL=src_lib_0edtk-9._.js.map