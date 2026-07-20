module.exports=[751563,t=>{"use strict";var e=t.i(843793);function i(t){return{id:t.notification_uid,category:t.category,title:t.title,body:t.body,href:t.href,isRead:!!t.is_read,createdAt:t.created_at}}async function a(t){await (0,e.query)(`INSERT INTO admin_notifications (notification_uid, admin_id, category, title, body, href, is_read)
     VALUES (?, NULL, ?, ?, ?, ?, FALSE)
     ON DUPLICATE KEY UPDATE
       category = VALUES(category),
       title = VALUES(title),
       body = VALUES(body),
       href = VALUES(href)`,[t.notificationUid,t.category,t.title,t.body,t.href])}async function n(i){let{ensureAdminNotificationsSchema:a}=await t.A(989186);await a();let n=i.body.trim().slice(0,512),d=i.title.trim().slice(0,255);await (0,e.query)(`INSERT INTO admin_notifications (notification_uid, admin_id, category, title, body, href, is_read)
     VALUES (?, NULL, ?, ?, ?, ?, FALSE)
     ON DUPLICATE KEY UPDATE
       category = VALUES(category),
       title = VALUES(title),
       body = VALUES(body),
       href = VALUES(href),
       is_read = FALSE,
       read_at = NULL,
       dismissed_at = NULL,
       created_at = CURRENT_TIMESTAMP`,[i.notificationUid,i.category,d,n,i.href??null])}async function d(t){await (0,e.query)(`DELETE FROM admin_notifications
     WHERE admin_id IS NULL AND notification_uid = ?`,[t])}async function o(){await (0,e.query)(`DELETE FROM admin_notifications
     WHERE admin_id IS NULL AND dismissed_at IS NULL
       AND category = 'system'
       AND title = 'Master Admin shell ready'`)}async function r(){await o();let[t,i,n,r,s]=await Promise.all([(0,e.query)(`SELECT COUNT(*) AS total FROM billing_payments
       WHERE status = 'failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`).catch(()=>[{total:0}]),(0,e.query)(`SELECT COUNT(*) AS total FROM support_tickets
       WHERE status IN ('open','pending') AND priority = 'high'`).catch(()=>[{total:0}]),(0,e.query)(`SELECT COUNT(*) AS total FROM billing_payments
       WHERE status NOT IN ('captured','failed','refunded')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`).catch(()=>[{total:0}]),(0,e.query)(`SELECT customer_uid, contact_name, email, company_name
         FROM customers
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        ORDER BY created_at DESC
        LIMIT 50`).catch(()=>[]),(0,e.query)(`SELECT SUM(status='queued') queued,
       SUM(status='processing' AND lease_expires_at<NOW()) stale,
       COALESCE(MAX(IF(status='queued',TIMESTAMPDIFF(SECOND,created_at,NOW()),0)),0) oldestAge
       FROM object_capture_jobs`).catch(()=>[{queued:0,stale:0,oldestAge:0}])]),c=Number(t[0]?.total||0);c>0?await a({notificationUid:"derived:failed-payments-7d",category:"billing",title:`${c} failed payment${1===c?"":"s"} this week`,body:"Review failed transactions and retry or contact customers.",href:"/master-admin/billing?status=Failed"}):await d("derived:failed-payments-7d");let u=Number(i[0]?.total||0);for(let t of(u>0?await a({notificationUid:"derived:open-high-tickets",category:"support",title:`${u} high-priority ticket${1===u?"":"s"} open`,body:"Support queue needs attention.",href:"/master-admin/support-tickets?priority=high"}):await d("derived:open-high-tickets"),r))await a({notificationUid:`customer-signup:${t.customer_uid}`,category:"customer",title:"New customer signup",body:`${t.contact_name} (${t.email})${t.company_name?` — ${t.company_name}`:""}`,href:`/master-admin/customers?search=${encodeURIComponent(t.email)}`});await d("derived:new-customers-24h");let m=Number(n[0]?.total||0);m>0?await a({notificationUid:"derived:pending-payments",category:"billing",title:`${m} pending payment${1===m?"":"s"}`,body:"Payments awaiting capture or confirmation.",href:"/master-admin/billing?status=Pending"}):await d("derived:pending-payments");let E=Number(s[0]?.stale||0);E>0?await a({notificationUid:"derived:oc-stale-leases",category:"system",title:`${E} stale Object Capture lease${1===E?"":"s"}`,body:"Worker leases expired and require recovery or worker investigation.",href:"/master-admin/system-health"}):await d("derived:oc-stale-leases");let l=Number(s[0]?.queued||0),_=Number(s[0]?.oldestAge||0),N=Number(process.env.OC_BACKLOG_WARNING_JOBS||10),y=Number(process.env.OC_QUEUE_AGE_WARNING_SECONDS||1800);l>=N||_>=y?await a({notificationUid:"derived:oc-backlog",category:"system",title:`Object Capture backlog: ${l} queued`,body:`Oldest queued job is ${Math.round(_/60)} minutes old. Check worker capacity.`,href:"/master-admin/object-capture?status=queued"}):await d("derived:oc-backlog")}async function s(t=20){return(await (0,e.query)(`SELECT notification_uid, category, title, body, href, is_read, created_at
     FROM admin_notifications
     WHERE admin_id IS NULL AND dismissed_at IS NULL
     ORDER BY is_read ASC, created_at DESC
     LIMIT ?`,[Math.min(Math.max(t,1),50)])).map(i)}async function c(){let t=await (0,e.query)(`SELECT COUNT(*) AS total FROM admin_notifications
     WHERE admin_id IS NULL AND dismissed_at IS NULL AND is_read = FALSE`);return Number(t[0]?.total||0)}async function u(t,i=!1){if(i)return void await (0,e.query)(`UPDATE admin_notifications SET is_read = TRUE, read_at = NOW()
       WHERE admin_id IS NULL AND dismissed_at IS NULL AND is_read = FALSE`);if(!t.length)return;let a=t.map(()=>"?").join(",");await (0,e.query)(`UPDATE admin_notifications SET is_read = TRUE, read_at = NOW()
     WHERE admin_id IS NULL AND dismissed_at IS NULL AND notification_uid IN (${a})`,t)}async function m(t,i=!1){if(i)return void await (0,e.query)(`UPDATE admin_notifications
       SET dismissed_at = NOW(), is_read = TRUE, read_at = COALESCE(read_at, NOW())
       WHERE admin_id IS NULL AND dismissed_at IS NULL`);if(!t.length)return;let a=t.map(()=>"?").join(",");await (0,e.query)(`UPDATE admin_notifications
     SET dismissed_at = NOW(), is_read = TRUE, read_at = COALESCE(read_at, NOW())
     WHERE admin_id IS NULL AND dismissed_at IS NULL
       AND notification_uid IN (${a})`,t)}async function E(t=20,e={}){!1!==e.sync&&await r();let[i,a]=await Promise.all([s(t),c()]);return{notifications:i,unreadCount:a}}t.s(["createAdminNotification",0,n,"deleteAdminNotifications",0,m,"getAdminNotificationsFeed",0,E,"markAdminNotificationsRead",0,u])},989186,t=>{t.v(t=>Promise.resolve().then(()=>t(843793)))}];

//# sourceMappingURL=src_lib_0a5nmi8._.js.map