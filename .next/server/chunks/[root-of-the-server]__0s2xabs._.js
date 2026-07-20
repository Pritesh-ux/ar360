module.exports=[717947,e=>{"use strict";var t=e.i(843793);async function r(e){try{await (0,t.query)(`CREATE TABLE IF NOT EXISTS master_admin_audit_logs (
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
       VALUES (?, ?, ?, ?, ?)`,[String(e.adminId||""),e.action,e.entityType,e.entityId??null,JSON.stringify(e.metadata||{})])}catch(e){console.warn("[master-admin audit skipped]",e)}}e.s(["writeMasterAdminAudit",0,r])},449719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},924868,(e,t,r)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},729698,e=>{"use strict";var t=e.i(522734),r=e.i(814747);let i=r.default.resolve(process.cwd(),"storage","Customers"),s=r.default.resolve(process.cwd(),"public","Storage","Customers");function a(e){try{return t.default.readdirSync(e).length>0}catch{return!1}}e.s(["DEFAULT_STORAGE_ROOT",0,i,"LEGACY_STORAGE_ROOT",0,s,"STORAGE_PUBLIC_PREFIX",0,"/Storage/Customers","resolveStorageRoot",0,function(){let e=process.env.STORAGE_ROOT?.trim();return e?r.default.resolve(e):a(i)?i:a(s)?s:i}])},345733,e=>{"use strict";var t=e.i(924868),r=e.i(814747),i=e.i(843793),s=e.i(578464);let a=/^[A-Za-z0-9_-]{1,180}$/;function o(e){let t=String(e||"").trim();return!t||!a.test(t)||t.includes("..")||t.includes("/")||t.includes("\\")?"":t}function u(e){return o(e.customerUid)}async function n(e,i){if(!o(e)||!o(i))return!1;try{let a=r.default.join((0,s.getProductFolder)(e,i),"product.json");return await t.default.access(a),!0}catch{return!1}}async function c(e){let t=u(e.user),r=o(e.productUid);if(!t||!r)return{ok:!1,customerUid:t,productUid:r,reason:"Invalid customer or product scope."};await (0,i.ensureProductSchema)();let s=await (0,i.query)(`SELECT id, customer_uid, user_id, status, deleted_at
     FROM products
     WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL)
     LIMIT 1`,[r,t,e.user.id]).catch(()=>[]);return s[0]?.deleted_at?{ok:!1,customerUid:t,productUid:r,reason:"Product is deleted."}:s[0]?{ok:!0,customerUid:t,productUid:r,product:s[0]}:!e.requireDbRow&&await n(t,r)?{ok:!0,customerUid:t,productUid:r,product:null}:{ok:!1,customerUid:t,productUid:r,reason:"Product ownership could not be verified."}}async function d(e){let t=o(e.customerUid),r=o(e.productUid);t&&r&&await (0,i.query)(`UPDATE products SET ${e.sqlSet}, updated_at = NOW() WHERE id = ? AND customer_uid = ?`,[...e.values,r,t])}e.s(["ACTIVE_PRODUCT_SQL",0,"deleted_at IS NULL","clientCustomerScopeIsValid",0,function(e,t){let r=u(e),i=o(t||"");return!!(r&&(!i||i===r))},"getSessionCustomerUid",0,u,"normalizeScopedId",0,o,"updateScopedProductRow",0,d,"verifyCustomerProductAccess",0,c])},533704,e=>{"use strict";var t=e.i(89171),r=e.i(666663),i=e.i(843793),s=e.i(345733);async function a(){let e=await (0,r.requireApiUser)();if(!e)return null;let t=(0,s.getSessionCustomerUid)(e);if(!t)return null;let a=(await (0,i.query)(`SELECT u.status AS user_status, c.status AS customer_status
     FROM users u
     INNER JOIN customers c ON c.user_id = u.id
     WHERE u.id = ? AND c.customer_uid = ?
     LIMIT 1`,[e.id,t]))[0];return a&&"Active"===a.user_status&&"Suspended"!==a.customer_status&&"Deleted"!==a.customer_status?{...e,customerUid:t,status:e.status??"Active"}:null}e.s(["rejectScopedApiUser",0,function(e="Login required."){return t.NextResponse.json({error:e},{status:401})},"requireScopedApiUser",0,a])},204979,e=>{"use strict";let t;async function r(){if(void 0!==t)return t;let r=process.env.REDIS_URL?.trim();if(!r)return t=null,null;try{let{createClient:i}=await e.A(765443),s=i({url:r});return s.on("error",e=>console.warn("[redis]",e)),await s.connect(),t=s}catch(e){return console.warn("[redis] unavailable:",e),t=null,null}}async function i(){let e=await r();return!!e&&"PONG"===await e.ping()}e.s(["getRedisClient",0,r,"pingRedis",0,i])},189104,e=>{"use strict";var t=e.i(204979);async function r(e,r){let i=await (0,t.getRedisClient)();if(!i)return null;let s=`rl:${r.scope}:${e}`,a=Number(await i.incr(s));1===a&&await i.expire(s,r.windowSec);let o=Number(await i.ttl(s)),u=o>0?o:r.windowSec;return a>r.limit?{allowed:!1,limit:r.limit,remaining:0,retryAfterSec:u}:{allowed:!0,limit:r.limit,remaining:Math.max(0,r.limit-a),retryAfterSec:u}}let i=new Map,s=Date.now();function a(e){let t=e.headers.get("x-forwarded-for");return t?t.split(",")[0]?.trim()||"unknown":e.headers.get("x-real-ip")||"unknown"}async function o(e,t){let a=await r(e,t).catch(()=>null);return a||function(e,t){let r=Date.now();if(!(r-s<6e4))for(let[e,t]of(s=r,i))t.resetAt<=r&&i.delete(e);let a=`${t.scope}:${e}`,o=1e3*t.windowSec,u=i.get(a);return!u||u.resetAt<=r?(i.set(a,{count:1,resetAt:r+o}),{allowed:!0,limit:t.limit,remaining:Math.max(0,t.limit-1),retryAfterSec:t.windowSec}):u.count>=t.limit?{allowed:!1,limit:t.limit,remaining:0,retryAfterSec:Math.max(1,Math.ceil((u.resetAt-r)/1e3))}:(u.count+=1,{allowed:!0,limit:t.limit,remaining:Math.max(0,t.limit-u.count),retryAfterSec:Math.max(1,Math.ceil((u.resetAt-r)/1e3))})}(e,t)}function u(e){return new Response(JSON.stringify({error:"Too many requests. Please try again later."}),{status:429,headers:{"Content-Type":"application/json","Retry-After":String(e.retryAfterSec),"X-RateLimit-Limit":String(e.limit),"X-RateLimit-Remaining":String(e.remaining)}})}async function n(e,t){let r=a(e),i=await o(r,t);return i.allowed?i:u(i)}async function c(e,t){return o(e||"unknown",t)}e.s(["enforceRateLimit",0,n,"enforceRateLimitForKey",0,c,"getClientIp",0,a,"rateLimitResponse",0,u],189104)},789112,e=>{"use strict";e.s(["paginationMeta",0,function(e,t,r){let i=Math.max(0,e),s=Math.max(1,Math.ceil(i/r));return{page:t,pageSize:r,total:i,totalPages:s}},"parsePagination",0,function(e,t){let r=Math.max(1,Number(e.get("page")||t?.page||1)||1),i=Math.min(100,Math.max(1,Number(e.get("pageSize")||t?.pageSize||10)||10));return{page:r,pageSize:i,offset:(r-1)*i}}])},540312,e=>{"use strict";var t=e.i(843793);async function r(e,r,i,s){let a=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();if(!s?.force&&("true"===a||"1"===a||"false"!==a&&"0"!==a))return;let[{total:o=0}={total:0}]=await (0,t.query)("SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",[e,r]);0===Number(o)&&await (0,t.query)(`ALTER TABLE \`${e.replace(/`/g,"``")}\` ADD COLUMN \`${r.replace(/`/g,"``")}\` ${i}`)}let i=!1;async function s(){i||(await r("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1",{force:!0}),i=!0)}async function a(){let e=process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();"true"!==e&&"1"!==e&&("false"===e||"0"===e)&&(await r("users","session_version","INT UNSIGNED NOT NULL DEFAULT 1"),await r("customers","business_type","VARCHAR(80) NULL"),await r("customers","website","VARCHAR(255) NULL"),await r("customers","address_line1","VARCHAR(255) NULL"),await r("customers","state","VARCHAR(100) NULL"),await r("customers","city","VARCHAR(100) NULL"),await r("customers","postal_code","VARCHAR(20) NULL"),await r("customers","profile_image_url","TEXT NULL"),await r("customer_notifications","dedupe_key","VARCHAR(120) NULL"),await r("support_ticket_messages","is_internal","TINYINT(1) NOT NULL DEFAULT 0"),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS customer_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      device VARCHAR(40) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(60) NOT NULL DEFAULT 'unknown',
      country VARCHAR(80) NOT NULL DEFAULT '',
      ip_hash VARCHAR(64) NOT NULL DEFAULT '',
      user_agent VARCHAR(255) NOT NULL DEFAULT '',
      last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_sessions_uid (session_uid),
      INDEX idx_customer_sessions_user (user_id, revoked_at),
      INDEX idx_customer_sessions_customer (customer_uid, last_active_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS customer_activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      activity_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(60) NOT NULL,
      title VARCHAR(255) NOT NULL,
      detail VARCHAR(512) NOT NULL DEFAULT '',
      meta_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_activity_uid (activity_uid),
      INDEX idx_customer_activity_customer (customer_uid, created_at),
      INDEX idx_customer_activity_type (event_type, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS data_export_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending','processing','ready','failed','expired') NOT NULL DEFAULT 'pending',
      file_path VARCHAR(512) NULL,
      error_message VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      expires_at DATETIME NULL,
      UNIQUE KEY uq_data_export_uid (request_uid),
      INDEX idx_data_export_customer (customer_uid, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `),await (0,t.query)(`
    CREATE TABLE IF NOT EXISTS account_deletion_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_uid VARCHAR(64) NOT NULL,
      customer_uid VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending','approved','cancelled','completed') NOT NULL DEFAULT 'pending',
      reason VARCHAR(512) NULL,
      scheduled_for DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelled_at DATETIME NULL,
      completed_at DATETIME NULL,
      UNIQUE KEY uq_deletion_request_uid (request_uid),
      INDEX idx_deletion_request_customer (customer_uid, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `))}e.s(["ensureAccountSchema",0,a,"ensureSessionVersionColumn",0,s])},605766,e=>{"use strict";var t=e.i(254799),r=e.i(843793),i=e.i(540312);async function s(e){await (0,i.ensureAccountSchema)();let s=`act-${(0,t.randomBytes)(8).toString("hex")}`;await (0,r.query)(`INSERT INTO customer_activity_logs (activity_uid, customer_uid, user_id, event_type, title, detail, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[s,e.customerUid,e.userId??null,e.eventType,e.title,e.detail||"",e.meta?JSON.stringify(e.meta):null])}async function a(e){await (0,i.ensureAccountSchema)();let t=Math.max(1,e.page||1),s=Math.min(50,Math.max(1,e.pageSize||20)),[a,o]=await Promise.all([(0,r.query)(`SELECT activity_uid, event_type, title, detail, created_at
       FROM customer_activity_logs
       WHERE customer_uid = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,[e.customerUid,s,(t-1)*s]),(0,r.query)("SELECT COUNT(*) AS total FROM customer_activity_logs WHERE customer_uid = ?",[e.customerUid])]),u=Number(o[0]?.total||0);return{items:a.map(e=>({id:e.activity_uid,eventType:e.event_type,title:e.title,detail:e.detail,createdAt:e.created_at})),pagination:{page:t,pageSize:s,total:u,totalPages:Math.max(1,Math.ceil(u/s))}}}e.s(["listCustomerActivity",0,a,"writeCustomerActivity",0,s])},22945,e=>{"use strict";var t=e.i(254799),r=e.i(843793),i=e.i(366651),s=e.i(717947),a=e.i(789112);function o(e){let t=e.toLowerCase();return"pending"===t?"Pending":"resolved"===t?"Resolved":"closed"===t?"Closed":"Open"}function u(e){let t=e.toLowerCase();return"billing"===t?"Billing & Payments":"account"===t?"Account & Access":"feature"===t?"Feature Request":"other"===t?"Other":"Technical Issue"}function n(e){let t;return{id:e.ticket_uid,ticketNumber:e.ticket_number,customerUid:e.customer_uid,customerName:e.customer_name,customerEmail:e.customer_email,subject:e.subject,description:e.description||"",category:e.category,categoryLabel:u(e.category),priority:"high"===(t=e.priority.toLowerCase())?"High":"low"===t?"Low":"Medium",rawPriority:e.priority,status:o(e.status),rawStatus:e.status,assignedTo:e.assigned_to||"Unassigned",createdAt:e.created_at,updatedAt:e.updated_at}}function c(e){let t=[],r=[],i=(e.search||"").trim().toLowerCase();if(i){t.push(`(
      LOWER(ticket_number) LIKE ?
      OR LOWER(subject) LIKE ?
      OR LOWER(customer_name) LIKE ?
      OR LOWER(customer_email) LIKE ?
      OR LOWER(description) LIKE ?
    )`);let e=`%${i}%`;r.push(e,e,e,e,e)}return e.status&&"all"!==e.status&&(t.push("status = ?"),r.push(e.status.toLowerCase())),e.priority&&"all"!==e.priority&&(t.push("priority = ?"),r.push(e.priority.toLowerCase())),e.category&&"all"!==e.category&&(t.push("category = ?"),r.push(e.category.toLowerCase())),e.assigned&&"all"!==e.assigned&&("unassigned"===e.assigned?t.push("(assigned_to = '' OR assigned_to = 'Unassigned')"):(t.push("assigned_to = ?"),r.push(e.assigned))),e.dateFrom&&(t.push("DATE(created_at) >= ?"),r.push(e.dateFrom)),e.dateTo&&(t.push("DATE(created_at) <= ?"),r.push(e.dateTo)),{where:t.length?`WHERE ${t.join(" AND ")}`:"",values:r}}async function d(){let e=await (0,r.query)("SELECT name FROM master_admins WHERE status = 'Active' ORDER BY name ASC").catch(()=>[]),t=await (0,r.query)(`
    SELECT DISTINCT assigned_to
    FROM support_tickets
    WHERE assigned_to != '' AND assigned_to != 'Unassigned'
    ORDER BY assigned_to ASC
  `).catch(()=>[]);return[...new Set([...e.map(e=>e.name),...t.map(e=>e.assigned_to)].filter(Boolean))].sort((e,t)=>e.localeCompare(t))}async function l(e){let t=Math.max(1,Number(e.page||1)),i=Math.min(50,Math.max(1,Number(e.pageSize||8))),s=(t-1)*i,{where:o,values:u}=c(e),[d,l]=await Promise.all([(0,r.query)(`SELECT COUNT(*) AS total FROM support_tickets ${o}`,u),(0,r.query)(`
      SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
        subject, description, category, priority, status, assigned_to, created_at, updated_at
      FROM support_tickets
      ${o}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `,[...u,i,s])]);return{tickets:l.map(n),pagination:(0,a.paginationMeta)(Number(d[0]?.total||0),t,i)}}async function p(e){let{where:t,values:i}=c(e),[s,a,n,d,l]=await Promise.all([(0,r.query)(`
      SELECT
        SUM(status = 'open') AS openCount,
        SUM(status = 'pending') AS pendingCount,
        SUM(status = 'resolved') AS resolvedCount,
        SUM(status = 'closed') AS closedCount,
        COUNT(*) AS totalCount
      FROM support_tickets
      ${t}
    `,i),(0,r.query)(`
      SELECT status, COUNT(*) AS count
      FROM support_tickets
      ${t}
      GROUP BY status
    `,i),(0,r.query)(`
      SELECT category, COUNT(*) AS count
      FROM support_tickets
      ${t}
      GROUP BY category
      ORDER BY count DESC
    `,i),(0,r.query)(`
      SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) AS avgHours
      FROM support_tickets
      ${t?`${t} AND status IN ('resolved', 'closed')`:"WHERE status IN ('resolved', 'closed')"}
    `,i),(0,r.query)(`
      SELECT
        CASE
          WHEN TIMESTAMPDIFF(DAY, created_at, NOW()) <= 1 THEN '0-1 days'
          WHEN TIMESTAMPDIFF(DAY, created_at, NOW()) <= 3 THEN '2-3 days'
          WHEN TIMESTAMPDIFF(DAY, created_at, NOW()) <= 7 THEN '4-7 days'
          ELSE '7+ days'
        END AS bucket,
        COUNT(*) AS count
      FROM support_tickets
      ${t?`${t} AND status IN ('open', 'pending')`:"WHERE status IN ('open', 'pending')"}
      GROUP BY bucket
    `,i)]),p=s[0]||{},m=Number(p.totalCount||0),_=["open","pending","resolved","closed"].map(e=>{let t=a.find(t=>t.status===e),r=Number(t?.count||0);return{status:o(e),key:e,count:r,percent:m>0?Math.round(r/m*1e3)/10:0}}),E=n.reduce((e,t)=>e+Number(t.count||0),0),N=n.map(e=>({category:e.category,label:u(e.category),count:Number(e.count||0),percent:E>0?Math.round(Number(e.count)/E*1e3)/10:0})),T=Number(d[0]?.avgHours||0),A=T>0?T>=24?`${Math.round(T/24*10)/10} days avg`:`${Math.round(T)} hours avg`:"No resolved tickets in filter";return{summary:{open:Number(p.openCount||0),pending:Number(p.pendingCount||0),resolved:Number(p.resolvedCount||0),closed:Number(p.closedCount||0),totalCount:m,avgResolutionLabel:A},analytics:{statusBreakdown:_,categoryBreakdown:N,openAging:l.map(e=>({bucket:e.bucket,count:Number(e.count||0)}))}}}async function m(e){let{where:t,values:i}=c(e);return[["Ticket ID","Customer","Email","Subject","Category","Priority","Status","Assigned To","Created At","Last Updated"],...(await (0,r.query)(`
    SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
      subject, description, category, priority, status, assigned_to, created_at, updated_at
    FROM support_tickets
    ${t}
    ORDER BY updated_at DESC
    LIMIT 5000
  `,i)).map(e=>{let t=n(e);return[t.ticketNumber,t.customerName,t.customerEmail,t.subject,t.categoryLabel,t.priority,t.status,t.assignedTo,t.createdAt,t.updatedAt]})].map(e=>e.map(e=>`"${String(e).replace(/"/g,'""')}"`).join(",")).join("\n")}async function _(){let e=new Date().getFullYear(),t=`TK-${e}-`,i=await (0,r.query)(`SELECT ticket_number FROM support_tickets
     WHERE ticket_number LIKE ?
     ORDER BY ticket_number DESC LIMIT 1`,[`${t}%`]),s=Number((i[0]?.ticket_number||"").split("-").pop()||0);return`${t}${String(s+1).padStart(5,"0")}`}async function E(i,a){if(!i.customerName.trim())throw Error("Customer name is required");if(!i.customerEmail.trim())throw Error("Customer email is required");if(!i.subject.trim())throw Error("Subject is required");let o=`tkt_${Date.now()}_${t.default.randomBytes(6).toString("hex")}`,u=await _(),n=i.category||"technical",c=i.priority||"medium",d=i.assignedTo||"";await (0,r.query)(`INSERT INTO support_tickets (
      ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
      subject, description, category, priority, status, assigned_to
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,[o,u,i.customerUid||"",i.customerName.trim(),i.customerEmail.trim(),i.subject.trim(),i.description||"",n,c,d]),i.description?.trim()&&await N({ticketUid:o,authorType:"customer",authorName:i.customerName.trim(),body:i.description.trim()}),await (0,s.writeMasterAdminAudit)({adminId:a,action:"ticket.create",entityType:"support_ticket",entityId:o,metadata:{ticketNumber:u,priority:c,category:n}});let{createAdminNotification:l}=await e.A(722623);return await l({notificationUid:`support-ticket:created:${o}`,category:"support",title:`New support ticket ${u}`,body:`${i.customerName.trim()} — ${i.subject.trim()}`,href:"/master-admin/support-tickets"}).catch(()=>{}),{ticketUid:o,ticketNumber:u}}async function N(e){let t=e.body.trim();if(!t)throw Error("Message body is required");await (0,r.query)(`INSERT INTO support_ticket_messages (ticket_uid, author_type, author_name, body)
     VALUES (?, ?, ?, ?)`,[e.ticketUid,e.authorType||"admin",e.authorName,t]),await (0,r.query)("UPDATE support_tickets SET updated_at = NOW() WHERE ticket_uid = ?",[e.ticketUid])}async function T(e){return e.customerEmail?(0,i.sendEmail)({to:e.customerEmail,subject:`Re: ${e.subject} [${e.ticketNumber}]`,template:"support_ticket_reply",text:`Hello ${e.customerName},

${e.reply}

— AR360 Support`,html:`<p>Hello ${e.customerName},</p><p>${e.reply.replace(/\n/g,"<br/>")}</p><p>— AR360 Support</p>`}):{delivered:!1,mode:"skipped"}}async function A(e,t,i){if(!(await (0,r.query)("SELECT ticket_uid FROM support_tickets WHERE ticket_uid = ? LIMIT 1",[e]))[0])throw Error("Ticket not found");let a=[],o=[];void 0!==t.status&&(a.push("status = ?"),o.push(t.status)),void 0!==t.priority&&(a.push("priority = ?"),o.push(t.priority)),void 0!==t.assignedTo&&(a.push("assigned_to = ?"),o.push(t.assignedTo)),void 0!==t.category&&(a.push("category = ?"),o.push(t.category)),void 0!==t.subject&&(a.push("subject = ?"),o.push(t.subject)),0!==a.length&&(a.push("updated_at = NOW()"),o.push(e),await (0,r.query)(`UPDATE support_tickets SET ${a.join(", ")} WHERE ticket_uid = ?`,o),await (0,s.writeMasterAdminAudit)({adminId:i,action:"ticket.update",entityType:"support_ticket",entityId:e,metadata:{fields:Object.keys(t)}}))}async function R(e){let t=await (0,r.query)(`SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
      subject, description, category, priority, status, assigned_to, created_at, updated_at
     FROM support_tickets WHERE ticket_uid = ? LIMIT 1`,[e]);return t[0]?n(t[0]):null}async function y(e){return(0,r.query)(`SELECT id, author_type, author_name, body, created_at
     FROM support_ticket_messages
     WHERE ticket_uid = ?
     ORDER BY created_at ASC`,[e])}e.s(["addTicketMessage",0,N,"createTicket",0,E,"exportTicketsCsv",0,m,"getTicketAnalytics",0,p,"getTicketAssigneeOptions",0,d,"getTicketByUid",0,R,"getTicketMessages",0,y,"listSupportTickets",0,l,"mapTicketRow",0,n,"notifyTicketReply",0,T,"updateTicket",0,A],22945)},134478,e=>{"use strict";var t=e.i(843793),r=e.i(22945),i=e.i(789112);async function s(e){let r=(await (0,t.query)(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS resolved_count
     FROM support_tickets
     WHERE customer_uid = ?`,[e]))[0];return{total:Number(r?.total||0),open:Number(r?.open_count||0),inProgress:Number(r?.pending_count||0),resolved:Number(r?.resolved_count||0)}}async function a(e){let a=Math.max(1,e.page||1),o=Math.min(50,Math.max(1,e.pageSize||10)),u=(a-1)*o,n=["customer_uid = ?"],c=[e.customerUid];e.status&&"all"!==e.status&&(n.push("status = ?"),c.push(e.status));let d=`WHERE ${n.join(" AND ")}`,[l,p,m]=await Promise.all([(0,t.query)(`SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
              subject, description, category, priority, status, assigned_to, created_at, updated_at
       FROM support_tickets
       ${d}
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ? OFFSET ?`,[...c,o,u]),(0,t.query)(`SELECT COUNT(*) AS total FROM support_tickets ${d}`,c),s(e.customerUid)]),_=Number(p[0]?.total||0);return{tickets:l.map(r.mapTicketRow),stats:m,pagination:(0,i.paginationMeta)(_,a,o)}}async function o(e){return(0,r.createTicket)({customerUid:e.customerUid,customerName:e.customerName,customerEmail:e.customerEmail,subject:e.subject,description:e.description,category:e.category||"technical",priority:"medium"})}async function u(e,i){let s=await (0,t.query)(`SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
            subject, description, category, priority, status, assigned_to, created_at, updated_at
     FROM support_tickets
     WHERE ticket_uid = ? AND customer_uid = ?
     LIMIT 1`,[i,e]);if(!s.length)return null;let a=await (0,t.query)(`SELECT author_type, author_name, body, created_at
     FROM support_ticket_messages
     WHERE ticket_uid = ? AND is_internal = 0
     ORDER BY created_at ASC`,[i]);return{ticket:(0,r.mapTicketRow)(s[0]),messages:a.map(e=>({senderType:e.author_type,senderName:e.author_name,message:e.body,createdAt:e.created_at}))}}async function n(r){let i=await u(r.customerUid,r.ticketUid);if(!i)return{error:"Support ticket not found."};let s=r.message.trim();if(!s||s.length>5e3)return{error:"Message is required and must be under 5000 characters."};let{addTicketMessage:a}=await e.A(446812);await a({ticketUid:r.ticketUid,authorType:"customer",authorName:r.customerName,body:s}),await (0,t.query)("UPDATE support_tickets SET status = 'pending', updated_at = NOW() WHERE ticket_uid = ? AND customer_uid = ?",[r.ticketUid,r.customerUid]);let{writeCustomerActivity:o}=await e.A(375938);await o({customerUid:r.customerUid,eventType:"support_reply_sent",title:"Support reply sent",detail:`Reply sent on ticket ${i.ticket.ticketNumber}.`});let{createAdminNotification:n}=await e.A(722623);return await n({notificationUid:`support-ticket:customer-reply:${r.ticketUid}:${Date.now()}`,category:"support",title:`Customer replied — ${i.ticket.ticketNumber}`,body:`${r.customerName}: ${s.slice(0,200)}${s.length>200?"…":""}`,href:"/master-admin/support-tickets"}).catch(()=>{}),{success:!0}}e.s(["createCustomerSupportTicket",0,o,"getCustomerSupportTicket",0,u,"listCustomerSupportTickets",0,a,"replyToCustomerSupportTicket",0,n])},716103,e=>{"use strict";var t=e.i(747909),r=e.i(174017),i=e.i(996250),s=e.i(759756),a=e.i(561916),o=e.i(174677),u=e.i(869741),n=e.i(316795),c=e.i(487718),d=e.i(995169),l=e.i(47587),p=e.i(666012),m=e.i(570101),_=e.i(626937),E=e.i(10372),N=e.i(193695);e.i(52474);var T=e.i(600220),A=e.i(89171),R=e.i(832578),y=e.i(189104),L=e.i(134478),g=e.i(533704),S=e.i(605766),h=e.i(895619);let U=new Set(["all","open","pending","resolved","closed"]);async function C(e){try{let t=await (0,g.requireScopedApiUser)();if(!t)return(0,g.rejectScopedApiUser)();let{searchParams:r}=e.nextUrl,i=r.get("status"),s=U.has(i)?i:"all",[a,o]=await Promise.all([(0,L.listCustomerSupportTickets)({customerUid:t.customerUid,status:s,page:Number(r.get("page")||"1"),pageSize:Number(r.get("pageSize")||"10")}),(0,R.getPlatformSettings)().catch(()=>null)]);return A.NextResponse.json({success:!0,...a,supportEmail:o?.supportEmail||"support@ar360.studio"})}catch(e){return console.error("[support-tickets GET]",e),A.NextResponse.json({error:"Failed to load support tickets."},{status:500})}}async function w(e){try{let t=await (0,g.requireScopedApiUser)();if(!t)return(0,g.rejectScopedApiUser)();let r=(0,y.getClientIp)(e);if(!(await (0,y.enforceRateLimitForKey)(`${t.id}:${r}`,{scope:"support:create",limit:10,windowSec:3600})).allowed)return A.NextResponse.json({error:"Too many tickets. Try again later.",code:"RATE_LIMITED"},{status:429});let i=await e.json(),s=String(i.subject||"").trim(),a=String(i.description||"").trim(),o=i.category;if(!s)return A.NextResponse.json({error:"Subject is required."},{status:400});if(!a)return A.NextResponse.json({error:"Description is required."},{status:400});let u=t.name?.trim()||t.email?.split("@")[0]||"Customer",n=t.email?.trim()||"";if(!n)return A.NextResponse.json({error:"Account email is required to create a ticket."},{status:400});let c=await (0,L.createCustomerSupportTicket)({customerUid:t.customerUid,customerName:u,customerEmail:n,subject:s,description:a,category:o||"technical"});return await (0,S.writeCustomerActivity)({customerUid:t.customerUid,userId:t.id,eventType:"support_ticket_created",title:"Support ticket created",detail:s}),await (0,h.createCustomerNotification)({customerUid:t.customerUid,userId:t.id,category:"support",title:"Support ticket created",body:`We received your request: ${s}`,href:`/dashboard/support?ticket=${c.ticketUid}`,dedupeKey:`support-created:${c.ticketUid}`}),A.NextResponse.json({success:!0,ticket:c})}catch(t){console.error("[support-tickets POST]",t);let e=t instanceof Error?t.message:"Failed to create support ticket.";return A.NextResponse.json({error:e},{status:500})}}e.s(["GET",0,C,"POST",0,w,"dynamic",0,"force-dynamic","runtime",0,"nodejs"],839120);var I=e.i(839120);let f=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/support-tickets/route",pathname:"/api/support-tickets",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/support-tickets/route.ts",nextConfigOutput:"standalone",userland:I,...{}}),{workAsyncStorage:k,workUnitAsyncStorage:O,serverHooks:v}=f;async function M(e,t,i){i.requestMeta&&(0,s.setRequestMeta)(e,i.requestMeta),f.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let A="/api/support-tickets/route";A=A.replace(/\/index$/,"")||"/";let R=await f.prepare(e,t,{srcPage:A,multiZoneDraftMode:!1});if(!R)return t.statusCode=400,t.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:y,deploymentId:L,params:g,nextConfig:S,parsedUrl:h,isDraftMode:U,prerenderManifest:C,routerServerContext:w,isOnDemandRevalidate:I,revalidateOnlyGenerated:k,resolvedPathname:O,clientReferenceManifest:v,serverActionsManifest:M}=R,b=(0,u.normalizeAppPath)(A),D=!!(C.dynamicRoutes[b]||C.routes[O]),H=async()=>((null==w?void 0:w.render404)?await w.render404(e,t,h,!1):t.end("This page could not be found"),null);if(D&&!U){let e=!!C.routes[O],t=C.dynamicRoutes[b];if(t&&!1===t.fallback&&!e){if(S.adapterPath)return await H();throw new N.NoFallbackError}}let q=null;!D||f.isDev||U||(q="/index"===(q=O)?"/":q);let x=!0===f.isDev||!D,P=D&&!x;M&&v&&(0,o.setManifestsSingleton)({page:A,clientReferenceManifest:v,serverActionsManifest:M});let F=e.method||"GET",j=(0,a.getTracer)(),$=j.getActiveScopeSpan(),B=!!(null==w?void 0:w.isWrappedByNextServer),W=!!(0,s.getRequestMeta)(e,"minimalMode"),V=(0,s.getRequestMeta)(e,"incrementalCache")||await f.getIncrementalCache(e,S,C,W);null==V||V.resetRequestCache(),globalThis.__incrementalCache=V;let G={params:g,previewProps:C.preview,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:x,incrementalCache:V,cacheLifeProfiles:S.cacheLife,waitUntil:i.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,i,s)=>f.onRequestError(e,t,i,s,w)},sharedContext:{buildId:y,deploymentId:L}},Y=new n.NodeNextRequest(e),K=new n.NodeNextResponse(t),X=c.NextRequestAdapter.fromNodeNextRequest(Y,(0,c.signalFromNodeResponse)(t));try{let s,o=async e=>f.handle(X,G).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=j.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=r.get("next.route");if(i){let t=`${F} ${i}`;e.setAttributes({"next.route":i,"http.route":i,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",i),s.updateName(t))}else e.updateName(`${F} ${A}`)}),u=async s=>{var a,u;let n=async({previousCacheEntry:r})=>{try{if(!W&&I&&k&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await o(s);e.fetchMetrics=G.renderOpts.fetchMetrics;let u=G.renderOpts.pendingWaitUntil;u&&i.waitUntil&&(i.waitUntil(u),u=void 0);let n=G.renderOpts.collectedTags;if(!D)return await (0,p.sendResponse)(Y,K,a,G.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(a.headers);n&&(t[E.NEXT_CACHE_TAGS_HEADER]=n),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==G.renderOpts.collectedRevalidate&&!(G.renderOpts.collectedRevalidate>=E.INFINITE_CACHE)&&G.renderOpts.collectedRevalidate,i=void 0===G.renderOpts.collectedExpire||G.renderOpts.collectedExpire>=E.INFINITE_CACHE?void 0:G.renderOpts.collectedExpire;return{value:{kind:T.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:i}}}}catch(t){throw(null==r?void 0:r.isStale)&&await f.onRequestError(e,t,{routerKind:"App Router",routePath:A,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:I})},!1,w),t}},c=await f.handleResponse({req:e,nextConfig:S,cacheKey:q,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:I,revalidateOnlyGenerated:k,responseGenerator:n,waitUntil:i.waitUntil,isMinimalMode:W});if(!D)return null;if((null==c||null==(a=c.value)?void 0:a.kind)!==T.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(u=c.value)?void 0:u.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});W||t.setHeader("x-nextjs-cache",I?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),U&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,m.fromNodeOutgoingHttpHeaders)(c.value.headers);return W&&D||d.delete(E.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,_.getCacheControlHeader)(c.cacheControl)),await (0,p.sendResponse)(Y,K,new Response(c.value.body,{headers:d,status:c.value.status||200})),null};B&&$?await u($):(s=j.getActiveScopeSpan(),await j.withPropagatedContext(e.headers,()=>j.trace(d.BaseServerSpan.handleRequest,{spanName:`${F} ${A}`,kind:a.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},u),void 0,!B))}catch(t){if(t instanceof N.NoFallbackError||await f.onRequestError(e,t,{routerKind:"App Router",routePath:b,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:I})},!1,w),D)throw t;return await (0,p.sendResponse)(Y,K,new Response(null,{status:500})),null}}e.s(["handler",0,M,"patchFetch",0,function(){return(0,i.patchFetch)({workAsyncStorage:k,workUnitAsyncStorage:O})},"routeModule",0,f,"serverHooks",0,v,"workAsyncStorage",0,k,"workUnitAsyncStorage",0,O],716103)},778359,e=>{e.v(e=>Promise.resolve().then(()=>e(232074)))},578878,e=>{e.v(e=>Promise.resolve().then(()=>e(540312)))},573857,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_enterprise_schema_ts_1jy6kif._.js"].map(t=>e.l(t))).then(()=>t(16006)))},765443,e=>{e.v(t=>Promise.all(["server/chunks/[externals]__1p0n8kz._.js","server/chunks/node_modules_0u5kai_._.js"].map(t=>e.l(t))).then(()=>t(986400)))},722623,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_0vxzm8j._.js"].map(t=>e.l(t))).then(()=>t(751563)))},446812,e=>{e.v(e=>Promise.resolve().then(()=>e(22945)))},375938,e=>{e.v(e=>Promise.resolve().then(()=>e(605766)))},828945,e=>{e.v(t=>Promise.all(["server/chunks/src_1lyjpbs._.js","server/chunks/src_lib_billing_admin-plans_ts_0x3-cc7._.js"].map(t=>e.l(t))).then(()=>t(281579)))},871964,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_19tvcpy._.js","server/chunks/src_1a62-pf._.js","server/chunks/[root-of-the-server]__14hm78n._.js","server/chunks/src_lib_billing_admin-plans_ts_0x3-cc7._.js","server/chunks/src_lib_enterprise-sales_repository_ts_0pj3ujk._.js","server/chunks/_0652v3l._.js"].map(t=>e.l(t))).then(()=>t(476188)))},283560,e=>{e.v(t=>Promise.all(["server/chunks/src_0yuajww._.js"].map(t=>e.l(t))).then(()=>t(441591)))},436913,e=>{e.v(e=>Promise.resolve().then(()=>e(895619)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0s2xabs._.js.map