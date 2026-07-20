module.exports=[605766,t=>{"use strict";var e=t.i(254799),i=t.i(843793),a=t.i(540312);async function c(t){await (0,a.ensureAccountSchema)();let c=`act-${(0,e.randomBytes)(8).toString("hex")}`;await (0,i.query)(`INSERT INTO customer_activity_logs (activity_uid, customer_uid, user_id, event_type, title, detail, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[c,t.customerUid,t.userId??null,t.eventType,t.title,t.detail||"",t.meta?JSON.stringify(t.meta):null])}async function u(t){await (0,a.ensureAccountSchema)();let e=Math.max(1,t.page||1),c=Math.min(50,Math.max(1,t.pageSize||20)),[u,r]=await Promise.all([(0,i.query)(`SELECT activity_uid, event_type, title, detail, created_at
       FROM customer_activity_logs
       WHERE customer_uid = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,[t.customerUid,c,(e-1)*c]),(0,i.query)("SELECT COUNT(*) AS total FROM customer_activity_logs WHERE customer_uid = ?",[t.customerUid])]),s=Number(r[0]?.total||0);return{items:u.map(t=>({id:t.activity_uid,eventType:t.event_type,title:t.title,detail:t.detail,createdAt:t.created_at})),pagination:{page:e,pageSize:c,total:s,totalPages:Math.max(1,Math.ceil(s/c))}}}t.s(["listCustomerActivity",0,u,"writeCustomerActivity",0,c])}];

//# sourceMappingURL=src_lib_account_activity_service_ts_17i_w7j._.js.map