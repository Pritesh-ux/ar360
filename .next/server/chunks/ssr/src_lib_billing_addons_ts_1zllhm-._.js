module.exports=[102275,a=>{"use strict";var b=a.i(761469);async function c(a){let c=await (0,b.query)("SELECT user_id FROM customers WHERE customer_uid = ? LIMIT 1",[a]);return c[0]?.user_id||null}async function d(a,d){let e=await c(a);return!!e&&(await (0,b.query)(`SELECT id FROM user_addons
      WHERE user_id = ?
        AND addon_slug = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,[e,d])).length>0}async function e(a){return d(a,"client-management")}async function f(a){return d(a,"team-management")}function g(a,b){let c=String(a||"").trim().toLowerCase(),d=!!b.business_available,e=!!b.enterprise_available,f=!!b.custom_available;return"business"===c?d:"enterprise"===c||"agency"===c?e:!!c.startsWith("ecp_")&&f}async function h(a,d){let e=await c(a),[f,h]=await Promise.all([(0,b.query)("SELECT * FROM addon_modules WHERE enabled = TRUE AND status = 'active' ORDER BY sort_order ASC"),e?(0,b.query)(`SELECT * FROM user_addons
            WHERE user_id = ?
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > NOW())`,[e]):Promise.resolve([])]),i=new Set(h.map(a=>a.addon_slug)),j=String(d||"").trim().toLowerCase();return f.filter(a=>j&&"starter"!==j&&"trial"!==j&&"free"!==j&&"pro"!==j&&g(j,a)||i.has(a.slug)).map(a=>({...a,purchased:i.has(a.slug),activeAddonDetails:h.find(b=>b.addon_slug===a.slug)||null}))}async function i(){return(0,b.query)("SELECT * FROM addon_modules ORDER BY sort_order ASC, id ASC")}async function j(a,c){let d=[],e=[];for(let[a,b]of Object.entries(c))void 0!==b&&(d.push(`${a} = ?`),"boolean"==typeof b?e.push(+!!b):e.push(b));d.length&&(e.push(a),await (0,b.query)(`UPDATE addon_modules SET ${d.join(", ")}, updated_at = NOW() WHERE slug = ?`,e))}async function k(a=100){return(0,b.query)(`SELECT ua.id, ua.user_id, ua.addon_slug, ua.status, ua.billing_type, ua.activated_at, ua.expires_at,
            c.customer_uid,
            COALESCE(NULLIF(TRIM(c.company_name), ''), c.contact_name) AS customer_name,
            c.email
       FROM user_addons ua
       LEFT JOIN customers c ON c.user_id = ua.user_id
      ORDER BY ua.activated_at DESC
      LIMIT ?`,[a])}let l=["client-management","team-management"];function m(a){return l.includes(a)}async function n(a){let d=await c(a),[e,f]=await Promise.all([i(),d?(0,b.query)("SELECT * FROM user_addons WHERE user_id = ? ORDER BY activated_at DESC",[d]):Promise.resolve([])]);return e.map(a=>{let b=f.find(b=>b.addon_slug===a.slug)||null;return{slug:a.slug,name:a.name,description:a.description,monthly_price:a.monthly_price,yearly_price:a.yearly_price,active:!!b&&"active"===b.status&&(!b.expires_at||new Date(b.expires_at).getTime()>Date.now()),license:b}})}function o(a){return a.toISOString().slice(0,19).replace("T"," ")}async function p(a){let d=String(a.slug||"").trim();if(!m(d))throw Error("Unknown add-on slug.");let e=await c(a.customerUid);if(!e)throw Error("Customer owner account not found.");let f=String(a.billingType||"manual").trim()||"manual",g=null;if(null===a.expiresAt)g=null;else if(a.expiresAt instanceof Date)g=o(a.expiresAt);else if("string"==typeof a.expiresAt&&a.expiresAt.trim()){let b=new Date(a.expiresAt);if(Number.isNaN(b.getTime()))throw Error("Invalid expiresAt.");g=o(b)}else if("yearly"===f){let a=new Date;a.setFullYear(a.getFullYear()+1),g=o(a)}else if("monthly"===f){let a=new Date;a.setMonth(a.getMonth()+1),g=o(a)}else g=null;return await (0,b.query)(`INSERT INTO user_addons (user_id, addon_slug, status, billing_type, activated_at, expires_at)
     VALUES (?, ?, 'active', ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       status = 'active',
       billing_type = VALUES(billing_type),
       activated_at = NOW(),
       expires_at = VALUES(expires_at)`,[e,d,f,g]),n(a.customerUid)}async function q(a){let d=String(a.slug||"").trim();if(!m(d))throw Error("Unknown add-on slug.");let e=await c(a.customerUid);if(!e)throw Error("Customer owner account not found.");return await (0,b.query)(`UPDATE user_addons
        SET status = 'revoked', updated_at = NOW()
      WHERE user_id = ? AND addon_slug = ?`,[e,d]),n(a.customerUid)}a.s(["KNOWN_ADDON_SLUGS",0,l,"getAddonsForCustomer",0,h,"getCustomerAddonLicenses",0,n,"getCustomerOwnerUserId",0,c,"grantUserAddon",0,p,"hasClientAddon",0,e,"hasTeamAddon",0,f,"isKnownAddonSlug",0,m,"isPlanEligibleForAddon",0,g,"listAddonLicenses",0,k,"listAllAddonModules",0,i,"revokeUserAddon",0,q,"updateAddonModule",0,j])}];

//# sourceMappingURL=src_lib_billing_addons_ts_1zllhm-._.js.map