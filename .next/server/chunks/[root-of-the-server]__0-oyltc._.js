module.exports=[449719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},870722,(e,t,r)=>{t.exports=e.x("tty",()=>require("tty"))},925328,(e,t,r)=>{t.exports=e.x("http2",()=>require("http2"))},141528,(e,t,r)=>{function i(e,t,r,i){return Math.round(e/r)+" "+i+(t>=1.5*r?"s":"")}t.exports=function(e,t){t=t||{};var r,a,n,s,o=typeof e;if("string"===o&&e.length>0){var d=e;if(!((d=String(d)).length>100)){var u=/^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(d);if(u){var c=parseFloat(u[1]);switch((u[2]||"ms").toLowerCase()){case"years":case"year":case"yrs":case"yr":case"y":return 315576e5*c;case"weeks":case"week":case"w":return 6048e5*c;case"days":case"day":case"d":return 864e5*c;case"hours":case"hour":case"hrs":case"hr":case"h":return 36e5*c;case"minutes":case"minute":case"mins":case"min":case"m":return 6e4*c;case"seconds":case"second":case"secs":case"sec":case"s":return 1e3*c;case"milliseconds":case"millisecond":case"msecs":case"msec":case"ms":return c;default:break}}}return}if("number"===o&&isFinite(e)){return t.long?(a=Math.abs(r=e))>=864e5?i(r,a,864e5,"day"):a>=36e5?i(r,a,36e5,"hour"):a>=6e4?i(r,a,6e4,"minute"):a>=1e3?i(r,a,1e3,"second"):r+" ms":(s=Math.abs(n=e))>=864e5?Math.round(n/864e5)+"d":s>=36e5?Math.round(n/36e5)+"h":s>=6e4?Math.round(n/6e4)+"m":s>=1e3?Math.round(n/1e3)+"s":n+"ms"}throw Error("val is not a non-empty string or a valid number. val="+JSON.stringify(e))}},916525,(e,t,r)=>{t.exports=function(t){function r(e){let t,a,n,s=null;function o(...e){if(!o.enabled)return;let i=Number(new Date);o.diff=i-(t||i),o.prev=t,o.curr=i,t=i,e[0]=r.coerce(e[0]),"string"!=typeof e[0]&&e.unshift("%O");let a=0;e[0]=e[0].replace(/%([a-zA-Z%])/g,(t,i)=>{if("%%"===t)return"%";a++;let n=r.formatters[i];if("function"==typeof n){let r=e[a];t=n.call(o,r),e.splice(a,1),a--}return t}),r.formatArgs.call(o,e),(o.log||r.log).apply(o,e)}return o.namespace=e,o.useColors=r.useColors(),o.color=r.selectColor(e),o.extend=i,o.destroy=r.destroy,Object.defineProperty(o,"enabled",{enumerable:!0,configurable:!1,get:()=>null!==s?s:(a!==r.namespaces&&(a=r.namespaces,n=r.enabled(e)),n),set:e=>{s=e}}),"function"==typeof r.init&&r.init(o),o}function i(e,t){let i=r(this.namespace+(void 0===t?":":t)+e);return i.log=this.log,i}function a(e,t){let r=0,i=0,a=-1,n=0;for(;r<e.length;)if(i<t.length&&(t[i]===e[r]||"*"===t[i]))"*"===t[i]?(a=i,n=r):r++,i++;else{if(-1===a)return!1;i=a+1,r=++n}for(;i<t.length&&"*"===t[i];)i++;return i===t.length}return r.debug=r,r.default=r,r.coerce=function(e){return e instanceof Error?e.stack||e.message:e},r.disable=function(){let e=[...r.names,...r.skips.map(e=>"-"+e)].join(",");return r.enable(""),e},r.enable=function(e){for(let t of(r.save(e),r.namespaces=e,r.names=[],r.skips=[],("string"==typeof e?e:"").trim().replace(/\s+/g,",").split(",").filter(Boolean)))"-"===t[0]?r.skips.push(t.slice(1)):r.names.push(t)},r.enabled=function(e){for(let t of r.skips)if(a(e,t))return!1;for(let t of r.names)if(a(e,t))return!0;return!1},r.humanize=e.r(141528),r.destroy=function(){console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.")},Object.keys(t).forEach(e=>{r[e]=t[e]}),r.names=[],r.skips=[],r.formatters={},r.selectColor=function(e){let t=0;for(let r=0;r<e.length;r++)t=(t<<5)-t+e.charCodeAt(r)|0;return r.colors[Math.abs(t)%r.colors.length]},r.enable(r.load()),r}},855225,(e,t,r)=>{"use strict";t.exports=(e,t=process.argv)=>{let r=e.startsWith("-")?"":1===e.length?"-":"--",i=t.indexOf(r+e),a=t.indexOf("--");return -1!==i&&(-1===a||i<a)}},181042,(e,t,r)=>{"use strict";let i,a=e.r(446786),n=e.r(870722),s=e.r(855225),{env:o}=process;function d(e){return 0!==e&&{level:e,hasBasic:!0,has256:e>=2,has16m:e>=3}}function u(e,t){if(0===i)return 0;if(s("color=16m")||s("color=full")||s("color=truecolor"))return 3;if(s("color=256"))return 2;if(e&&!t&&void 0===i)return 0;let r=i||0;if("dumb"===o.TERM)return r;{let e=a.release().split(".");return Number(e[0])>=10&&Number(e[2])>=10586?Number(e[2])>=14931?3:2:1}}s("no-color")||s("no-colors")||s("color=false")||s("color=never")?i=0:(s("color")||s("colors")||s("color=true")||s("color=always"))&&(i=1),"FORCE_COLOR"in o&&(i="true"===o.FORCE_COLOR?1:"false"===o.FORCE_COLOR?0:0===o.FORCE_COLOR.length?1:Math.min(parseInt(o.FORCE_COLOR,10),3)),t.exports={supportsColor:function(e){return d(u(e,e&&e.isTTY))},stdout:d(u(!0,n.isatty(1))),stderr:d(u(!0,n.isatty(2)))}},523440,(e,t,r)=>{let i=e.r(870722),a=e.r(224361);r.init=function(e){e.inspectOpts={};let t=Object.keys(r.inspectOpts);for(let i=0;i<t.length;i++)e.inspectOpts[t[i]]=r.inspectOpts[t[i]]},r.log=function(...e){return process.stderr.write(a.formatWithOptions(r.inspectOpts,...e)+"\n")},r.formatArgs=function(e){let{namespace:i,useColors:a}=this;if(a){let r=this.color,a="\x1b[3"+(r<8?r:"8;5;"+r),n=`  ${a};1m${i} \u001B[0m`;e[0]=n+e[0].split("\n").join("\n"+n),e.push(a+"m+"+t.exports.humanize(this.diff)+"\x1b[0m")}else e[0]=(r.inspectOpts.hideDate?"":new Date().toISOString()+" ")+i+" "+e[0]},r.save=function(e){e?process.env.DEBUG=e:delete process.env.DEBUG},r.load=function(){return process.env.DEBUG},r.useColors=function(){return"colors"in r.inspectOpts?!!r.inspectOpts.colors:i.isatty(process.stderr.fd)},r.destroy=a.deprecate(()=>{},"Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."),r.colors=[6,2,3,4,5,1];try{let t=e.r(181042);t&&(t.stderr||t).level>=2&&(r.colors=[20,21,26,27,32,33,38,39,40,41,42,43,44,45,56,57,62,63,68,69,74,75,76,77,78,79,80,81,92,93,98,99,112,113,128,129,134,135,148,149,160,161,162,163,164,165,166,167,168,169,170,171,172,173,178,179,184,185,196,197,198,199,200,201,202,203,204,205,206,207,208,209,214,215,220,221])}catch(e){}r.inspectOpts=Object.keys(process.env).filter(e=>/^debug_/i.test(e)).reduce((e,t)=>{let r=t.substring(6).toLowerCase().replace(/_([a-z])/g,(e,t)=>t.toUpperCase()),i=process.env[t];return i=!!/^(yes|on|true|enabled)$/i.test(i)||!/^(no|off|false|disabled)$/i.test(i)&&("null"===i?null:Number(i)),e[r]=i,e},{}),t.exports=e.r(916525)(r);let{formatters:n}=t.exports;n.o=function(e){return this.inspectOpts.colors=this.useColors,a.inspect(e,this.inspectOpts).split("\n").map(e=>e.trim()).join(" ")},n.O=function(e){return this.inspectOpts.colors=this.useColors,a.inspect(e,this.inspectOpts)}},328452,(e,t,r)=>{let i;r.formatArgs=function(e){if(e[0]=(this.useColors?"%c":"")+this.namespace+(this.useColors?" %c":" ")+e[0]+(this.useColors?"%c ":" ")+"+"+t.exports.humanize(this.diff),!this.useColors)return;let r="color: "+this.color;e.splice(1,0,r,"color: inherit");let i=0,a=0;e[0].replace(/%[a-zA-Z%]/g,e=>{"%%"!==e&&(i++,"%c"===e&&(a=i))}),e.splice(a,0,r)},r.save=function(e){try{e?r.storage.setItem("debug",e):r.storage.removeItem("debug")}catch(e){}},r.load=function(){let e;try{e=r.storage.getItem("debug")||r.storage.getItem("DEBUG")}catch(e){}return!e&&"u">typeof process&&"env"in process&&(e=process.env.DEBUG),e},r.useColors=function(){let e;return!("u">typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/))&&("u">typeof document&&document.documentElement&&document.documentElement.style&&document.documentElement.style.WebkitAppearance||"u">typeof navigator&&navigator.userAgent&&(e=navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/))&&parseInt(e[1],10)>=31||"u">typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))},r.storage=function(){try{return localStorage}catch(e){}}(),i=!1,r.destroy=()=>{i||(i=!0,console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."))},r.colors=["#0000CC","#0000FF","#0033CC","#0033FF","#0066CC","#0066FF","#0099CC","#0099FF","#00CC00","#00CC33","#00CC66","#00CC99","#00CCCC","#00CCFF","#3300CC","#3300FF","#3333CC","#3333FF","#3366CC","#3366FF","#3399CC","#3399FF","#33CC00","#33CC33","#33CC66","#33CC99","#33CCCC","#33CCFF","#6600CC","#6600FF","#6633CC","#6633FF","#66CC00","#66CC33","#9900CC","#9900FF","#9933CC","#9933FF","#99CC00","#99CC33","#CC0000","#CC0033","#CC0066","#CC0099","#CC00CC","#CC00FF","#CC3300","#CC3333","#CC3366","#CC3399","#CC33CC","#CC33FF","#CC6600","#CC6633","#CC9900","#CC9933","#CCCC00","#CCCC33","#FF0000","#FF0033","#FF0066","#FF0099","#FF00CC","#FF00FF","#FF3300","#FF3333","#FF3366","#FF3399","#FF33CC","#FF33FF","#FF6600","#FF6633","#FF9900","#FF9933","#FFCC00","#FFCC33"],r.log=console.debug||console.log||(()=>{}),t.exports=e.r(916525)(r);let{formatters:a}=t.exports;a.j=function(e){try{return JSON.stringify(e)}catch(e){return"[UnexpectedJSONParseError]: "+e.message}}},817293,(e,t,r)=>{"u"<typeof process||"renderer"===process.type||process.__nwjs?t.exports=e.r(328452):t.exports=e.r(523440)},697999,774392,e=>{"use strict";var t=e.i(89171);e.i(551783);var r=e.i(666663),i=e.i(843793);let a=["customers.read","customers.update","customers.suspend","customers.delete","customers.impersonate","subscriptions.read","subscriptions.update","subscriptions.cancel","billing.read","billing.refund","billing.manual_payment","invoices.generate","products.read","products.update","products.delete","storage.read","storage.cleanup","coupons.read","coupons.manage","tickets.read","tickets.manage","analytics.read","admins.manage","settings.read","settings.manage","audit.read","enterprise_requests.read","enterprise_requests.manage","object_capture.read","object_capture.manage","object_capture.download","exports.download"],n="super_admin",s={super_admin:a,operations_admin:["customers.read","customers.update","customers.suspend","subscriptions.read","subscriptions.update","products.read","products.update","products.delete","storage.read","storage.cleanup","analytics.read","exports.download","audit.read","enterprise_requests.read","enterprise_requests.manage","object_capture.read","object_capture.manage","object_capture.download"],billing_admin:["customers.read","subscriptions.read","subscriptions.update","subscriptions.cancel","billing.read","billing.refund","billing.manual_payment","invoices.generate","analytics.read","exports.download","enterprise_requests.read","enterprise_requests.manage"],support_admin:["customers.read","subscriptions.read","tickets.read","tickets.manage","object_capture.read"],content_admin:["products.read","products.update","products.delete","storage.read","analytics.read","object_capture.read"],analytics_viewer:["customers.read","subscriptions.read","billing.read","products.read","storage.read","coupons.read","tickets.read","analytics.read","audit.read","exports.download","object_capture.read"],read_only:a.filter(e=>e.endsWith(".read")&&"enterprise_requests.read"!==e)};function o(e){return a.includes(e)}function d(e,t,r){return e===n||(t instanceof Set?t:new Set(t)).has(r)}function u(e,t,r){return(Array.isArray(r)?r:[r]).some(r=>d(e,t,r))}function c(e,t,r){return r.every(r=>d(e,t,r))}e.s(["ALL_ADMIN_PERMISSIONS",0,a,"ROLE_PERMISSION_FALLBACK",0,s,"SUPER_ADMIN_ROLE",0,n,"hasAllAdminPermissions",0,c,"hasAnyAdminPermission",0,u,"isAdminPermission",0,o],774392);let l="ar360_master_admin_session";async function p(e){let t=function(e){if(e){if("cookies"in e&&"function"==typeof e.cookies?.get){let t=e.cookies.get(l)?.value;if(t)return t}for(let t of(e.headers.get("cookie")||"").split(";")){let e=t.indexOf("=");if(e<0||t.slice(0,e).trim()!==l)continue;let r=t.slice(e+1).trim();r.startsWith('"')&&r.endsWith('"')&&(r=r.slice(1,-1));try{return decodeURIComponent(r)}catch{return r}}}}(e);return(0,r.requireApiAdmin)(t?{token:t}:void 0)}let m=new Map;function _(e){return[...e].filter(o)}async function C(e){var t;let r,o=(t=e,!(r=m.get(t))||r.expiresAt<Date.now()?null:r.context);if(o)return o;let d=await (0,i.query)(`SELECT ar.code AS roleCode, arp.permission_code AS permissionCode
     FROM master_admins ma
     LEFT JOIN admin_roles ar ON ar.id = ma.role_id
     LEFT JOIN admin_role_permissions arp ON arp.role_id = ar.id
     WHERE ma.id = ?
     LIMIT 500`,[e]),u=d[0]?.roleCode??null,c=new Set;if(u===n)for(let e of a)c.add(e);else if(u){for(let e of d)e.permissionCode&&c.add(e.permissionCode);if(0===c.size&&s[u])for(let e of s[u])c.add(e)}else for(let e of a)c.add(e);let l={roleCode:u??n,permissions:c};return m.set(e,{context:l,expiresAt:Date.now()+3e4}),l}async function y(e){let t=await C(e.id);return{...e,roleCode:t.roleCode??void 0,permissions:_(t.permissions)}}async function b(e,r){let i=await p(r?.request);if(!i)return function(e="Unauthorized"){return t.NextResponse.json({error:e},{status:401})}();let a=await C(i.id),n=Array.isArray(e)?e:[e];return(r?.requireAll?c(a.roleCode,a.permissions,n):u(a.roleCode,a.permissions,n))?{admin:{...i,roleCode:a.roleCode??void 0,permissions:_(a.permissions)},roleCode:a.roleCode,permissions:a.permissions}:function(e="Forbidden"){return t.NextResponse.json({error:e},{status:403})}(`Missing permission: ${n.join(", ")}`)}async function E(e){let t=await (0,r.getCurrentMasterAdmin)(e?{token:e}:void 0);return t?y(t):null}e.s(["clearAdminPermissionCache",0,function(e){null==e?m.clear():m.delete(e)},"getCurrentMasterAdminWithPermissions",0,E,"guardAdminPermission",0,b],697999)},717947,e=>{"use strict";var t=e.i(843793);async function r(e){try{await (0,t.query)(`CREATE TABLE IF NOT EXISTS master_admin_audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        admin_id VARCHAR(128) NULL,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(80) NOT NULL,
        entity_id VARCHAR(120) NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_master_admin_audit_entity (entity_type, entity_id),
        INDEX idx_master_admin_audit_action (action),
        INDEX idx_master_admin_audit_created (created_at)
      )`),await (0,t.query)(`INSERT INTO master_admin_audit_logs (admin_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?)`,[String(e.adminId||""),e.action,e.entityType,e.entityId??null,JSON.stringify(e.metadata||{})])}catch(e){console.warn("[master-admin audit skipped]",e)}}e.s(["writeMasterAdminAudit",0,r])},789112,e=>{"use strict";e.s(["paginationMeta",0,function(e,t,r){let i=Math.max(0,e),a=Math.max(1,Math.ceil(i/r));return{page:t,pageSize:r,total:i,totalPages:a}},"parsePagination",0,function(e,t){let r=Math.max(1,Number(e.get("page")||t?.page||1)||1),i=Math.min(100,Math.max(1,Number(e.get("pageSize")||t?.pageSize||10)||10));return{page:r,pageSize:i,offset:(r-1)*i}}])},959194,e=>{"use strict";var t=e.i(843793),r=e.i(6588);let i=`
  SELECT
    bp.payment_uid AS id,
    COALESCE(bi.invoice_uid, CONCAT('INV-', bp.payment_uid)) AS invoice,
    COALESCE(c.contact_name, 'Unknown') AS customer,
    COALESCE(c.email, '') AS email,
    COALESCE(bo.plan_id, '') AS plan,
    CASE LOWER(COALESCE(bo.billing_period, 'monthly'))
      WHEN 'yearly' THEN 'Yearly'
      ELSE 'Monthly'
    END AS billing,
    ROUND(COALESCE(bi.amount_paise, bp.amount_paise) / 100) AS amount,
    ROUND(COALESCE(bi.tax_paise, 0) / 100) AS gst,
    ROUND(COALESCE(bi.total_paise, bp.amount_paise) / 100) AS total,
    CASE bp.status
      WHEN 'captured' THEN 'Paid'
      WHEN 'failed' THEN 'Failed'
      WHEN 'refunded' THEN 'Refunded'
      ELSE 'Pending'
    END AS status,
    CASE
      WHEN bp.razorpay_payment_id IS NOT NULL AND bp.razorpay_payment_id != '' THEN 'Razorpay'
      WHEN bo.razorpay_order_id LIKE 'manual_%' THEN 'Manual'
      ELSE 'Razorpay'
    END AS gateway,
    COALESCE(NULLIF(bp.razorpay_payment_id, ''), bp.razorpay_order_id, '') AS transactionId,
    bp.created_at AS date,
    '' AS paymentMethod,
    NULL AS notes
  FROM billing_payments bp
  LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
  LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
  LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
`;async function a(e){let r=e?.limit??500,a=e?.customerUid?.trim();return a?(0,t.query)(`${i}
       WHERE bp.customer_uid = ?
       ORDER BY bp.created_at DESC
       LIMIT ?`,[a,r]):(0,t.query)(`${i}
     ORDER BY bp.created_at DESC
     LIMIT ?`,[r])}async function n(e){return(await (0,t.query)(`SELECT
      bp.customer_uid,
      bp.amount_paise,
      bp.status AS raw_status,
      bp.razorpay_payment_id,
      bp.razorpay_order_id,
      bp.provider_mode,
      bp.payment_uid AS id,
      COALESCE(bi.invoice_uid, CONCAT('INV-', bp.payment_uid)) AS invoice,
      COALESCE(c.contact_name, 'Unknown') AS customer,
      COALESCE(c.email, '') AS email,
      COALESCE(bo.plan_id, '') AS plan,
      CASE LOWER(COALESCE(bo.billing_period, 'monthly'))
        WHEN 'yearly' THEN 'Yearly'
        ELSE 'Monthly'
      END AS billing,
      ROUND(COALESCE(bi.amount_paise, bp.amount_paise) / 100) AS amount,
      ROUND(COALESCE(bi.tax_paise, 0) / 100) AS gst,
      ROUND(COALESCE(bi.total_paise, bp.amount_paise) / 100) AS total,
      CASE bp.status
        WHEN 'captured' THEN 'Paid'
        WHEN 'failed' THEN 'Failed'
        WHEN 'refunded' THEN 'Refunded'
        ELSE 'Pending'
      END AS status,
      CASE
        WHEN bp.razorpay_payment_id IS NOT NULL AND bp.razorpay_payment_id != '' THEN 'Razorpay'
        WHEN bo.razorpay_order_id LIKE 'manual_%' THEN 'Manual'
        ELSE 'Razorpay'
      END AS gateway,
      COALESCE(NULLIF(bp.razorpay_payment_id, ''), bp.razorpay_order_id, '') AS transactionId,
      bp.created_at AS date,
      '' AS paymentMethod,
      NULL AS notes
    FROM billing_payments bp
    LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
    LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
    LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
    WHERE bp.payment_uid = ?
    LIMIT 1`,[e]))[0]||null}async function s(){let e=await (0,t.query)(`
    SELECT COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)), 0) AS total
    FROM billing_payments bp
    LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
    WHERE bp.status = 'captured'
      AND bp.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
  `);return Number(e[0]?.total||0)}async function o(e){let i=Math.round(Number(e.amountInr)||0),a=Math.round(.18*i),n=i+a,s=100*n,o="yearly"===String(e.billing).toLowerCase()?"yearly":"monthly",d=(0,r.uid)("bo"),u=(0,r.uid)("pay"),c=`manual_${Date.now()}_${u.slice(-6)}`;return await (0,t.query)(`INSERT INTO billing_orders
       (order_uid, customer_uid, plan_id, billing_period, razorpay_order_id, amount_paise, currency, status, metadata)
     VALUES (?, ?, ?, ?, ?, ?, 'INR', 'created', ?)`,[d,e.customerUid,e.planId,o,c,s,JSON.stringify({source:"master_admin_manual",notes:e.notes||null})]),await (0,t.query)(`INSERT INTO billing_payments
       (payment_uid, customer_uid, order_uid, razorpay_order_id, amount_paise, currency, status)
     VALUES (?, ?, ?, ?, ?, 'INR', 'created')`,[u,e.customerUid,d,c,s]),{id:u,invoice:`INV-${u}`,amount:i,gst:a,total:n,status:"Pending",gateway:e.gateway||"Manual",transactionId:c,paymentMethod:e.paymentMethod||"",notes:e.notes||"Manual payment created by admin."}}async function d(r,i){let a="Paid"===i?"captured":"Failed"===i?"failed":"Refunded"===i?"refunded":"created";if(await (0,t.query)("UPDATE billing_payments SET status = ?, updated_at = NOW() WHERE payment_uid = ?",[a,r]),"captured"===a){await (0,t.query)(`UPDATE billing_orders bo
       INNER JOIN billing_payments bp ON bp.order_uid = bo.order_uid
       SET bo.status = 'paid', bo.updated_at = NOW()
       WHERE bp.payment_uid = ?`,[r]);let i=(await (0,t.query)(`SELECT bp.customer_uid, bp.order_uid, bp.amount_paise, bp.invoice_uid, bp.razorpay_order_id,
              bo.plan_id, bo.billing_period
         FROM billing_payments bp
         INNER JOIN billing_orders bo ON bo.order_uid = bp.order_uid
        WHERE bp.payment_uid = ?
        LIMIT 1`,[r]))[0];if(i&&!i.invoice_uid){let{finalizePaymentInvoice:t}=await e.A(840328),{activatePaidSubscription:r}=await e.A(871964),a="yearly"===i.billing_period?"yearly":"monthly";await r({customerUid:i.customer_uid,planId:i.plan_id,period:a,amountPaise:i.amount_paise,resetBandwidth:!1}),await t({customerUid:i.customer_uid,planId:i.plan_id,period:a,amountPaise:i.amount_paise,razorpayPaymentId:i.razorpay_order_id.startsWith("manual_")?i.razorpay_order_id:null,orderUid:i.order_uid,paidAt:new Date().toISOString().slice(0,19).replace("T"," ")})}}}e.s(["createManualLedgerPayment",0,o,"formatLedgerPayment",0,function(e){let t=new Date(e.date),r=t.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}),i="Expired";if("Paid"===e.status){let r=new Date(t);"Yearly"===e.billing?r.setFullYear(r.getFullYear()+1):r.setMonth(r.getMonth()+1),i=r.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}else"Pending"===e.status&&(i="Pending");return{...e,amount:Number(e.amount||0),gst:Number(e.gst||0),total:Number(e.total||0),date:r,expiryDate:i}},"getLedgerPaymentByUid",0,n,"getMonthlyCapturedRevenuePaise",0,s,"listLedgerPayments",0,a,"updateLedgerPaymentStatus",0,d])},828677,e=>{"use strict";var t=e.i(843793),r=e.i(281579),i=e.i(959194),a=e.i(366651),n=e.i(717947),s=e.i(42176),o=e.i(823337),d=e.i(233483);async function u(e){let{where:r,values:i}=function(e){let t=[],r=[],i=(e.search||"").trim().toLowerCase();if(i){t.push(`(
      LOWER(COALESCE(c.contact_name, '')) LIKE ?
      OR LOWER(COALESCE(c.email, '')) LIKE ?
      OR LOWER(COALESCE(bi.invoice_number, bi.invoice_uid, '')) LIKE ?
      OR LOWER(COALESCE(bo.plan_id, '')) LIKE ?
    )`);let e=`%${i}%`;r.push(e,e,e,e)}if(e.dateFrom&&(t.push("DATE(bp.created_at) >= ?"),r.push(e.dateFrom)),e.dateTo&&(t.push("DATE(bp.created_at) <= ?"),r.push(e.dateTo)),e.plan&&(t.push("COALESCE(bo.plan_id, '') = ?"),r.push(e.plan)),e.status&&"all"!==e.status){let i="Paid"===e.status?"captured":"Failed"===e.status?"failed":"Refunded"===e.status?"refunded":"created";t.push("bp.status = ?"),r.push(i)}return{where:t.length?`WHERE ${t.join(" AND ")}`:"",values:r}}(e);return[["Invoice","Customer","Email","Plan","Amount","Tax","Total","Date","Status"],...(await (0,t.query)(`
    SELECT
      COALESCE(bi.invoice_number, bi.invoice_uid, CONCAT('INV-', bp.payment_uid)) AS invoice,
      COALESCE(c.contact_name, 'Unknown') AS customer,
      COALESCE(c.email, '') AS email,
      COALESCE(bo.plan_id, '') AS plan,
      ROUND(COALESCE(bi.amount_paise, bp.amount_paise) / 100) AS amount,
      ROUND(COALESCE(bi.tax_paise, 0) / 100) AS tax,
      ROUND(COALESCE(bi.total_paise, bp.amount_paise) / 100) AS total,
      bp.created_at AS date,
      CASE bp.status
        WHEN 'captured' THEN 'Paid'
        WHEN 'failed' THEN 'Failed'
        WHEN 'refunded' THEN 'Refunded'
        ELSE 'Pending'
      END AS status
    FROM billing_payments bp
    LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
    LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
    LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
    ${r}
    ORDER BY bp.created_at DESC
    LIMIT 5000
  `,i)).map(e=>[e.invoice,e.customer,e.email,e.plan,e.amount,e.tax,e.total,new Date(e.date).toISOString().slice(0,10),e.status])].map(e=>e.map(e=>`"${String(e).replace(/"/g,'""')}"`).join(",")).join("\n")}async function c(e,t){let i=(await (0,r.getBillingPlans)({activeOnly:!1})).find(t=>t.id===e);if(!i)throw Error("Plan not found.");let a="yearly"===t?i.priceYearlyInr:i.priceMonthlyInr;if(null===a||a<=0)throw Error("Plan has no price configured.");return 100*a}async function l(e){if(!(await (0,t.query)("SELECT email, contact_name FROM customers WHERE customer_uid = ? LIMIT 1",[e.customerUid]))[0])throw Error("Customer not found.");let r=e.amountPaise??await c(e.planId,e.period),i=await (0,s.createTaxInvoice)({customerUid:e.customerUid,planId:e.planId,period:e.period,amountPaise:r,status:"draft"});return await (0,n.writeMasterAdminAudit)({adminId:e.adminId,action:"invoice.generate",entityType:"invoice",entityId:i?.invoice_uid,metadata:{customerUid:e.customerUid,planId:e.planId,period:e.period}}),i?.invoice_uid&&await (0,d.sendInvoiceEmail)({customerUid:e.customerUid,invoiceUid:i.invoice_uid,invoiceNumber:i.invoice_number,planId:e.planId,amountPaise:i.total_paise??r,status:i.status}).catch(()=>void 0),i}async function p(e){let t=await (0,i.getLedgerPaymentByUid)(e.paymentUid);if(!t)throw Error("Payment not found.");if("Pending"!==t.status)throw Error("Only pending payments can receive reminders.");if(!t.email)throw Error("Customer email is missing.");let r=Number(t.total||0),o=await (0,a.sendEmail)({to:t.email,subject:`Payment reminder — ${t.invoice}`,text:`Hello ${t.customer},

This is a reminder that your ${t.plan} subscription payment of ${(0,s.formatMoney)(100*r)} is pending.

Invoice: ${t.invoice}

Please complete payment from your dashboard billing page.

Thank you,
AR360 Team`,html:`<p>Hello ${t.customer},</p><p>Your <strong>${t.plan}</strong> payment of <strong>${(0,s.formatMoney)(100*r)}</strong> is pending.</p><p>Invoice: ${t.invoice}</p><p>Please complete payment from your dashboard.</p>`});return await (0,n.writeMasterAdminAudit)({adminId:e.adminId,action:"billing.payment_reminder",entityType:"payment",entityId:e.paymentUid,metadata:{to:t.email,mode:o.mode}}),{delivered:o.delivered,mode:o.mode,message:o.delivered?`Reminder sent to ${t.email}.`:`Reminder logged (SMTP not configured). Recipient: ${t.email}.`}}async function m(e){await (0,n.writeMasterAdminAudit)({adminId:e.adminId,action:"billing.refund",entityType:"payment",entityId:e.paymentUid,metadata:{refundId:e.refundId,note:e.note,amountPaise:e.amountPaise}});let r=await (0,t.query)(`SELECT bp.customer_uid, bo.plan_id
       FROM billing_payments bp
       LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
      WHERE bp.payment_uid = ? LIMIT 1`,[e.paymentUid]).catch(()=>[]);r[0]?.customer_uid&&await (0,d.sendSubscriptionStateEmail)({customerUid:r[0].customer_uid,state:"refunded",planId:r[0].plan_id,amountPaise:e.amountPaise,eventKey:e.refundId||e.paymentUid}).catch(()=>void 0)}async function _(e){return(0,o.getInvoiceByUid)(e)}e.s(["adminGenerateInvoice",0,l,"exportBillingCsv",0,u,"getInvoiceForDownload",0,_,"recordBillingRefund",0,m,"sendPaymentReminder",0,p])},778359,e=>{e.v(e=>Promise.resolve().then(()=>e(232074)))},578878,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_account_schema_ts_1j3_dqb._.js"].map(t=>e.l(t))).then(()=>t(540312)))},573857,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_enterprise_schema_ts_1jy6kif._.js"].map(t=>e.l(t))).then(()=>t(16006)))},828945,e=>{e.v(e=>Promise.resolve().then(()=>e(281579)))},871964,e=>{e.v(t=>Promise.all(["server/chunks/src_server_billing_subscription_service_ts_1q8kyiz._.js","server/chunks/src_1a62-pf._.js"].map(t=>e.l(t))).then(()=>t(476188)))},283560,e=>{e.v(t=>Promise.all(["server/chunks/src_0if2gj8._.js"].map(t=>e.l(t))).then(()=>t(441591)))},375938,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_account_1dff8nx._.js"].map(t=>e.l(t))).then(()=>t(605766)))},436913,e=>{e.v(e=>Promise.resolve().then(()=>e(895619)))},909069,e=>{e.v(t=>Promise.all(["server/chunks/src_server_billing_subscription_repository_ts_1cy_145._.js"].map(t=>e.l(t))).then(()=>t(577087)))},840328,e=>{e.v(e=>Promise.resolve().then(()=>e(42176)))},989186,e=>{e.v(e=>Promise.resolve().then(()=>e(843793)))},856299,e=>{e.v(e=>Promise.resolve().then(()=>e(823337)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0-oyltc._.js.map