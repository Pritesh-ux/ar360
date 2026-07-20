module.exports=[847427,e=>{"use strict";var t=e.i(843793);async function a(e){let a=await (0,t.query)("SELECT user_id FROM customers WHERE customer_uid = ? LIMIT 1",[e]);return a[0]?.user_id||null}async function n(e,n){let r=await a(e);return!!r&&(await (0,t.query)(`SELECT id FROM user_addons
      WHERE user_id = ?
        AND addon_slug = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,[r,n])).length>0}async function r(e){return n(e,"client-management")}async function s(e){return n(e,"team-management")}function i(e,t){let a=String(e||"").trim().toLowerCase(),n=!!t.business_available,r=!!t.enterprise_available,s=!!t.custom_available;return"business"===a?n:"enterprise"===a||"agency"===a?r:!!a.startsWith("ecp_")&&s}async function u(e,n){let r=await a(e),[s,u]=await Promise.all([(0,t.query)("SELECT * FROM addon_modules WHERE enabled = TRUE AND status = 'active' ORDER BY sort_order ASC"),r?(0,t.query)(`SELECT * FROM user_addons
            WHERE user_id = ?
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > NOW())`,[r]):Promise.resolve([])]),o=new Set(u.map(e=>e.addon_slug)),l=String(n||"").trim().toLowerCase();return s.filter(e=>l&&"starter"!==l&&"trial"!==l&&"free"!==l&&"pro"!==l&&i(l,e)||o.has(e.slug)).map(e=>({...e,purchased:o.has(e.slug),activeAddonDetails:u.find(t=>t.addon_slug===e.slug)||null}))}async function o(){return(0,t.query)("SELECT * FROM addon_modules ORDER BY sort_order ASC, id ASC")}async function l(e,a){let n=[],r=[];for(let[e,t]of Object.entries(a))void 0!==t&&(n.push(`${e} = ?`),"boolean"==typeof t?r.push(+!!t):r.push(t));n.length&&(r.push(e),await (0,t.query)(`UPDATE addon_modules SET ${n.join(", ")}, updated_at = NOW() WHERE slug = ?`,r))}async function d(e=100){return(0,t.query)(`SELECT ua.id, ua.user_id, ua.addon_slug, ua.status, ua.billing_type, ua.activated_at, ua.expires_at,
            c.customer_uid,
            COALESCE(NULLIF(TRIM(c.company_name), ''), c.contact_name) AS customer_name,
            c.email
       FROM user_addons ua
       LEFT JOIN customers c ON c.user_id = ua.user_id
      ORDER BY ua.activated_at DESC
      LIMIT ?`,[e])}let c=["client-management","team-management"];function _(e){return c.includes(e)}async function m(e){let n=await a(e),[r,s]=await Promise.all([o(),n?(0,t.query)("SELECT * FROM user_addons WHERE user_id = ? ORDER BY activated_at DESC",[n]):Promise.resolve([])]);return r.map(e=>{let t=s.find(t=>t.addon_slug===e.slug)||null;return{slug:e.slug,name:e.name,description:e.description,monthly_price:e.monthly_price,yearly_price:e.yearly_price,active:!!t&&"active"===t.status&&(!t.expires_at||new Date(t.expires_at).getTime()>Date.now()),license:t}})}function E(e){return e.toISOString().slice(0,19).replace("T"," ")}async function p(e){let n=String(e.slug||"").trim();if(!_(n))throw Error("Unknown add-on slug.");let r=await a(e.customerUid);if(!r)throw Error("Customer owner account not found.");let s=String(e.billingType||"manual").trim()||"manual",i=null;if(null===e.expiresAt)i=null;else if(e.expiresAt instanceof Date)i=E(e.expiresAt);else if("string"==typeof e.expiresAt&&e.expiresAt.trim()){let t=new Date(e.expiresAt);if(Number.isNaN(t.getTime()))throw Error("Invalid expiresAt.");i=E(t)}else if("yearly"===s){let e=new Date;e.setFullYear(e.getFullYear()+1),i=E(e)}else if("monthly"===s){let e=new Date;e.setMonth(e.getMonth()+1),i=E(e)}else i=null;return await (0,t.query)(`INSERT INTO user_addons (user_id, addon_slug, status, billing_type, activated_at, expires_at)
     VALUES (?, ?, 'active', ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       status = 'active',
       billing_type = VALUES(billing_type),
       activated_at = NOW(),
       expires_at = VALUES(expires_at)`,[r,n,s,i]),m(e.customerUid)}async function g(e){let n=String(e.slug||"").trim();if(!_(n))throw Error("Unknown add-on slug.");let r=await a(e.customerUid);if(!r)throw Error("Customer owner account not found.");return await (0,t.query)(`UPDATE user_addons
        SET status = 'revoked', updated_at = NOW()
      WHERE user_id = ? AND addon_slug = ?`,[r,n]),m(e.customerUid)}e.s(["KNOWN_ADDON_SLUGS",0,c,"getAddonsForCustomer",0,u,"getCustomerAddonLicenses",0,m,"getCustomerOwnerUserId",0,a,"grantUserAddon",0,p,"hasClientAddon",0,r,"hasTeamAddon",0,s,"isKnownAddonSlug",0,_,"isPlanEligibleForAddon",0,i,"listAddonLicenses",0,d,"listAllAddonModules",0,o,"revokeUserAddon",0,g,"updateAddonModule",0,l])}];

//# sourceMappingURL=src_lib_billing_addons_ts_1kx2tuw._.js.map