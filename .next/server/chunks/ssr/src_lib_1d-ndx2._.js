module.exports=[816928,a=>{"use strict";var b=a.i(761469);async function c(c){let{ensureAdminNotificationsSchema:d}=await a.A(3571);await d();let e=c.body.trim().slice(0,512),f=c.title.trim().slice(0,255);await (0,b.query)(`INSERT INTO admin_notifications (notification_uid, admin_id, category, title, body, href, is_read)
     VALUES (?, NULL, ?, ?, ?, ?, FALSE)
     ON DUPLICATE KEY UPDATE
       category = VALUES(category),
       title = VALUES(title),
       body = VALUES(body),
       href = VALUES(href),
       is_read = FALSE,
       read_at = NULL,
       dismissed_at = NULL,
       created_at = CURRENT_TIMESTAMP`,[c.notificationUid,c.category,f,e,c.href??null])}a.s(["createAdminNotification",0,c])},3571,a=>{a.v(a=>Promise.resolve().then(()=>a(761469)))}];

//# sourceMappingURL=src_lib_1d-ndx2._.js.map