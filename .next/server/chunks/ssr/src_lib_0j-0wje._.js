module.exports=[410281,323871,a=>{"use strict";a.i(254799);var b=a.i(761469),c=a.i(749016);function d(a){return a.toISOString()}function e(a,b){let c=a.toISOString().slice(0,10),d=b.toISOString().slice(0,10);return`${c}_${d}`}function f(a=new Date){let b=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1,0,0,0,0)),c=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,0,23,59,59,999));return{periodStart:d(b),periodEnd:d(c),periodKey:e(b,c),source:"calendar_month"}}async function g(a){if(!a)return!1;let d=(0,c.mapLegacyPlanId)(a),e=await (0,b.query)(`SELECT bandwidth_resets_monthly
       FROM billing_plans
      WHERE id IN (?, ?)
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1`,[a,d,a]).catch(()=>[]);return!!e[0]?.bandwidth_resets_monthly}async function h(a){if(!a)return f();let c=(await (0,b.query)(`SELECT current_period_start, current_period_end, billing_period, plan_id
       FROM customer_subscriptions
      WHERE customer_uid = ?
      LIMIT 1`,[a]).catch(()=>[]))[0];if(!c)return f();let h=String(c.billing_period||"").toLowerCase(),i=await g(c.plan_id);if(("yearly"===h||"annual"===h)&&i)return f();if(c.current_period_start&&c.current_period_end){var j,k;let a,b,f=(j=c.current_period_start,k=c.current_period_end,a=new Date(j),b=new Date(k),Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())?{periodStart:d(a),periodEnd:d(b),periodKey:e(a,b),source:"subscription"}:null);if(f)return f}return f()}a.s(["getCustomerBillingPeriod",0,h],323871),a.i(807074),a.i(630717);let i=null;async function j(){if(!0===i)return!0;try{return await (0,b.query)(`
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
    `),i=!0,!0}catch{return i=!1,!1}}async function k(a){if(!a)return 0;let c=await (0,b.query)(`SELECT COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb, c.plan_id
       FROM customers c
      WHERE c.customer_uid = ?
      LIMIT 1`,[a]).catch(()=>[]);return Number(c[0]?.bandwidth_used_mb||0)}async function l(a){let b=await h(a);return Number((await m(a,b.periodKey)/0x40000000).toFixed(4))}async function m(a,c){if(!a)return 0;if(await j())try{let d=await (0,b.query)(`SELECT COALESCE(SUM(bytes_transferred), 0) AS total
           FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ?`,[a,c]),e=Number(d[0]?.total||0);if(e>0)return e}catch{}return Math.round(1024*await k(a)*1024)}a.s(["getBandwidthUsedBytesInPeriod",0,m,"getCustomerBandwidthUsedGb",0,l,"getCustomerBandwidthUsedMb",0,k],410281)},648540,a=>{"use strict";var b=a.i(254799),c=a.i(761469),d=a.i(410281);function e(a){return a?.request_uid?{requestUid:a.request_uid,created:!1}:null}function f(a){return null==a?null:Number(a)}async function g(a){return(await (0,c.query)(`SELECT ec.id AS contract_id, ec.contract_uid, ec.starts_on, ec.expires_on,
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
      LIMIT 1`,[a]))[0]||null}async function h(a){return!!await g(a)}async function i(a,b){try{let d=await (0,c.query)(a,[b]);return Number(d[0]?.total||0)}catch{return 0}}async function j(a){let[b,c,e,f,g]=await Promise.all([i("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM product_assets WHERE customer_uid = ?",a),i("SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",a),i(`SELECT COUNT(*) AS total FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND (COALESCE(model_url, '') <> '' OR LOWER(COALESCE(file_name, '')) LIKE '%.glb')`,a),i(`SELECT COUNT(*) AS total FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND LOWER(COALESCE(status, '')) IN ('published', 'active')`,a),(0,d.getCustomerBandwidthUsedMb)(a).catch(()=>0)]);return{storageBytes:b,bandwidthBytes:Math.round(1024*g*1024),products:c,models:e,arExperiences:f}}async function k(a){let b=await g(a);if(!b)return null;let[d,e]=await Promise.all([j(a),(0,c.query)(`SELECT DISTINCT invoice.invoice_uid, invoice.invoice_number, invoice.status,
              invoice.total_paise, invoice.currency, invoice.created_at, invoice.paid_at
         FROM enterprise_payments payment
         JOIN billing_invoices invoice ON invoice.id = payment.invoice_id
         JOIN customers customer ON customer.customer_uid = invoice.customer_uid
        WHERE payment.contract_id = ?
          AND customer.customer_uid = ?
          AND invoice.customer_uid = ?
        ORDER BY invoice.created_at DESC`,[b.contract_id,a,a])]);return{contract:{contractUid:b.contract_uid,startsOn:b.starts_on,expiresOn:b.expires_on,status:"active",renewalRequestUid:b.renewal_request_uid},plan:{customPlanUid:b.custom_plan_uid,name:b.name,billingCycle:b.billing_cycle,pricePaise:Number(b.price_paise),notes:b.notes,limits:{storageBytes:f(b.storage_limit_bytes),bandwidthBytes:f(b.bandwidth_limit_bytes),products:f(b.product_limit),models:f(b.model_limit),arExperiences:f(b.ar_experience_limit),teamMembers:f(b.team_member_limit)},flags:{customBranding:!!b.custom_branding,prioritySupport:!!b.priority_support,dedicatedInfrastructure:!!b.dedicated_infrastructure,slaSupport:!!b.sla_support,supportLevel:b.support_level}},usage:d,invoices:e.map(a=>({invoiceUid:a.invoice_uid,invoiceNumber:a.invoice_number,status:a.status,totalPaise:Number(a.total_paise),currency:a.currency,createdAt:a.created_at,paidAt:a.paid_at,downloadUrl:`/api/billing/invoices/${encodeURIComponent(a.invoice_uid)}/download?format=pdf`}))}}async function l(a){let d=await (0,c.getPool)(),f=await d.getConnection();try{await f.beginTransaction();let[c]=await f.execute(`SELECT ec.id, ec.contract_uid, ec.expires_on, customer.id AS customer_id,
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
        LIMIT 1 FOR UPDATE`,[a]),d=c[0];if(!d)return await f.rollback(),null;let[g]=await f.execute("SELECT request_uid FROM enterprise_requests WHERE renewal_of_contract_id = ? LIMIT 1",[d.id]),h=e(g[0]);if(h)return await f.commit(),h;let i=`ER-${new Date().getUTCFullYear()}-${b.default.randomBytes(4).toString("hex").toUpperCase()}`;return await f.execute(`INSERT INTO enterprise_requests (
        request_uid, company_name, contact_name, business_email, phone, company_website,
        country, industry, expected_products, expected_storage_gb,
        expected_monthly_bandwidth_gb, needs_more_storage, needs_more_bandwidth,
        needs_more_products, needs_team_members, needs_custom_branding,
        needs_dedicated_infrastructure, needs_priority_support, needs_sla,
        additional_requirements, customer_id, renewal_of_contract_id, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[i,d.company_name||d.contact_name,d.contact_name,d.email,d.phone||"",d.company_website,d.country||"India",d.industry||"Other",d.product_limit,null==d.storage_limit_bytes?null:Math.ceil(Number(d.storage_limit_bytes)/1024/1024/1024),null==d.bandwidth_limit_bytes?null:Math.ceil(Number(d.bandwidth_limit_bytes)/1024/1024/1024),!1,!1,!1,Number(d.team_member_limit||0)>1,!!d.custom_branding,!!d.dedicated_infrastructure,!!d.priority_support,!!d.sla_support,`Renewal requested for contract ${d.contract_uid}, expiring ${d.expires_on}.`,d.customer_id,d.id,"enterprise_dashboard_renewal"]),await f.commit(),{requestUid:i,created:!0}}catch(b){if(await f.rollback(),b instanceof Error&&"code"in b&&"ER_DUP_ENTRY"===b.code){let b=await g(a),c=e(b?{request_uid:b.renewal_request_uid}:null);if(c)return c}throw b}finally{f.release()}}a.s(["createEnterpriseRenewalRequest",0,l,"getEnterpriseDashboard",0,k,"hasActiveEnterpriseContract",0,h],648540)}];

//# sourceMappingURL=src_lib_0j-0wje._.js.map