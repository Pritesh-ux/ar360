import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, ensureAdminSchema, query } from "@/lib/db";

const safe = async <T,>(promise: Promise<T[]>) => promise.catch(() => [] as T[]);

function liveKindPermission(kind: string) {
  if (kind === "analytics" || kind === "bandwidth") return "analytics.read" as const;
  if (kind === "login" || kind === "activity" || kind === "security") return "audit.read" as const;
  return "analytics.read" as const;
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") || "analytics";
  const auth = await guardAdminPermission(liveKindPermission(kind));
  if (auth instanceof NextResponse) return auth;
  await Promise.all([ensureAppSchema(), ensureAdminSchema()]);

  if (kind === "analytics") {
    const [summary, daily, plans, customers, products] = await Promise.all([
      safe(query<any>(`SELECT
        (SELECT COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)),0) FROM billing_payments bp
          LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
          WHERE bp.status='captured' AND bp.created_at>=DATE_FORMAT(NOW(),'%Y-%m-01')) monthlyRevenue,
        (SELECT COUNT(*) FROM customers WHERE status='Active') activeCustomers,
        (SELECT COUNT(*) FROM products) totalProducts,
        (SELECT COALESCE(SUM(views),0) FROM products) viewerVisits,
        (SELECT COALESCE(SUM(ar_launches),0) FROM analytics_daily) arClicks,
        (SELECT COALESCE(SUM(qr_scans),0) FROM analytics_daily) qrScans,
        (SELECT COALESCE(SUM(storage_used_mb),0) FROM customers) storageMB`)),
      safe(query<any>(`SELECT DATE_FORMAT(d.date,'%d %b') label,
        COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)),0) / 100 AS value,
        COUNT(bp.id) paymentCount
        FROM (SELECT CURDATE() - INTERVAL seq DAY date FROM (
          SELECT 0 seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
        ) n) d
        LEFT JOIN billing_payments bp ON DATE(bp.created_at)=d.date AND bp.status='captured'
        LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
        GROUP BY d.date ORDER BY d.date`)),
      safe(query<any>(`SELECT COALESCE(s.plan_id,'trial') plan, COUNT(*) value
        FROM customer_subscriptions s GROUP BY s.plan_id ORDER BY value DESC`)),
      safe(query<any>(`SELECT COALESCE(c.company_name,c.contact_name,c.email) name,
        COALESCE(SUM(CASE WHEN bp.status='captured' THEN COALESCE(bi.total_paise, bp.amount_paise) ELSE 0 END),0) / 100 AS revenue,
        COUNT(DISTINCT pr.id) products, COALESCE(c.storage_used_mb,0) storageMB,
        COALESCE(SUM(pr.views),0) views
        FROM customers c
        LEFT JOIN billing_payments bp ON bp.customer_uid=c.customer_uid
        LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
        LEFT JOIN products pr ON pr.customer_uid=c.customer_uid
        GROUP BY c.customer_uid ORDER BY revenue DESC LIMIT 5`)),
      safe(query<any>(`SELECT pr.title product, COALESCE(c.company_name,c.contact_name,c.email,'Unknown') customer,
        COALESCE(pr.views,0) views, COALESCE(SUM(a.ar_launches),0) ar, COALESCE(SUM(a.qr_scans),0) qr
        FROM products pr LEFT JOIN customers c ON c.customer_uid=pr.customer_uid
        LEFT JOIN analytics_daily a ON a.product_uid=pr.id
        GROUP BY pr.id ORDER BY views DESC LIMIT 5`)),
    ]);

    const summaryRow = summary[0] || {};
    if (summaryRow.monthlyRevenue != null) {
      summaryRow.monthlyRevenue = Math.round(Number(summaryRow.monthlyRevenue) / 100);
    }

    return NextResponse.json({ summary: summaryRow, daily, plans, topCustomers: customers, topProducts: products });
  }

  if (kind === "login") {
    const rows = await safe(query<any>(`SELECT l.id, COALESCE(c.company_name,c.contact_name,l.email) customer, l.email,
      CASE l.status WHEN 'success' THEN 'Success' WHEN 'blocked' THEN 'Blocked' ELSE 'Failed' END status,
      l.reason, l.ip_hash ip, '' country, '' city, 'Unknown' device,
      l.user_agent browser, '' os, 'Password' loginMethod,
      CASE WHEN l.status='success' THEN 'Active' ELSE 'Expired' END sessionStatus,
      '0m' sessionDuration, '-' logoutReason,
      DATE_FORMAT(l.created_at,'%d %b %Y, %h:%i %p') time,
      CASE WHEN l.status='success' THEN 'Low' WHEN l.status='blocked' THEN 'High' ELSE 'Medium' END risk
      FROM auth_login_logs l LEFT JOIN customers c ON c.email=l.email ORDER BY l.created_at DESC LIMIT 500`));
    return NextResponse.json({ rows });
  }

  if (kind === "activity") {
    const rows = await safe(query<any>(`SELECT CONCAT('product-',p.id) id,
      COALESCE(c.company_name,c.contact_name,c.email,'Unknown') customer, COALESCE(c.email,'') email,
      'Product' type, CASE WHEN p.status='published' THEN 'Product Published' ELSE 'Product Updated' END action,
      CONCAT(p.title,' (',COALESCE(p.file_name,'model'),')') details, 'Customer' actor, '' ip,
      DATE_FORMAT(p.updated_at,'%d %b %Y, %h:%i %p') time, 'Success' status
      FROM products p LEFT JOIN customers c ON c.customer_uid=p.customer_uid
      UNION ALL
      SELECT CONCAT('payment-',bp.payment_uid), COALESCE(c.company_name,c.contact_name,c.email,'Unknown'), COALESCE(c.email,''),
      'Payment',
      CONCAT('Payment ', CASE bp.status WHEN 'captured' THEN 'Paid' WHEN 'failed' THEN 'Failed' WHEN 'refunded' THEN 'Refunded' ELSE 'Pending' END),
      CONCAT(COALESCE(bi.invoice_uid, bp.payment_uid),' · ',COALESCE(bo.plan_id,'')),
      'System', 'Razorpay',
      DATE_FORMAT(bp.updated_at,'%d %b %Y, %h:%i %p'),
      CASE WHEN bp.status='captured' THEN 'Success' WHEN bp.status='failed' THEN 'Failed' ELSE 'Warning' END
      FROM billing_payments bp
      LEFT JOIN customers c ON c.customer_uid=bp.customer_uid
      LEFT JOIN billing_orders bo ON bo.order_uid=bp.order_uid
      LEFT JOIN billing_invoices bi ON bi.invoice_uid=bp.invoice_uid
      ORDER BY time DESC LIMIT 500`));
    return NextResponse.json({ rows });
  }

  if (kind === "bandwidth") {
    const rows = await safe(query<any>(`SELECT c.customer_uid id, COALESCE(c.company_name,c.contact_name,c.email) customer, c.email,
      COALESCE(s.plan_id, c.plan_id) plan, ROUND(COALESCE(c.bandwidth_used_mb,0)/1024,2) usedGB,
      ROUND(COALESCE(s.bandwidth_limit_mb, bp.bandwidth_gb * 1024, 10240) / 1024, 2) limitGB,
      COALESCE(SUM(a.views),0) viewerLoads, COALESCE(SUM(a.views),0) modelLoads,
      COALESCE(SUM(a.ar_launches),0) arOpens, COALESCE(SUM(a.qr_scans),0) qrScans, 0 embedLoads,
      COALESCE((SELECT p.title FROM products p WHERE p.customer_uid=c.customer_uid ORDER BY p.views DESC LIMIT 1),'-') topProduct,
      CASE WHEN COALESCE(c.bandwidth_used_mb,0) >= 0.9 * COALESCE(s.bandwidth_limit_mb, bp.bandwidth_gb * 1024, 10240) THEN 'Critical'
           WHEN COALESCE(c.bandwidth_used_mb,0) >= 0.8 * COALESCE(s.bandwidth_limit_mb, bp.bandwidth_gb * 1024, 10240) THEN 'Warning' ELSE 'Normal' END status,
      DATE_FORMAT(COALESCE(c.last_login_at,c.updated_at),'%d %b %Y, %h:%i %p') lastActivity
      FROM customers c
      LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
      LEFT JOIN billing_plans bp ON bp.id = COALESCE(s.plan_id, c.plan_id)
      LEFT JOIN analytics_daily a ON a.customer_uid=c.customer_uid
      GROUP BY c.customer_uid ORDER BY usedGB DESC`));
    return NextResponse.json({ rows });
  }

  if (kind === "security") {
    const rows = await safe(query<any>(`SELECT c.customer_uid id, COALESCE(c.company_name,c.contact_name,c.email) customer, c.email,
      COALESCE(s.plan_id, c.plan_id) plan,
      CASE WHEN c.status='Suspended' THEN 'Locked' ELSE 'Safe' END status,
      COALESCE((SELECT COUNT(*) FROM auth_login_logs l WHERE l.email=c.email AND l.status='failed' AND l.created_at>=CURDATE()),0) failedLogins,
      CASE WHEN c.status='Active' THEN 1 ELSE 0 END activeSessions,
      COALESCE((SELECT l.ip_hash FROM auth_login_logs l WHERE l.email=c.email ORDER BY l.created_at DESC LIMIT 1),'') lastIp,
      COALESCE((SELECT l.user_agent FROM auth_login_logs l WHERE l.email=c.email ORDER BY l.created_at DESC LIMIT 1),'Unknown') lastDevice,
      '' lastLocation, COALESCE(u.two_factor_enabled,0) twoFA, 0 apiKeys,
      DATE_FORMAT(COALESCE(c.last_login_at,c.updated_at),'%d %b %Y, %h:%i %p') lastLogin,
      CASE WHEN c.status='Suspended' THEN 'High' ELSE 'Low' END risk
      FROM customers c
      LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
      LEFT JOIN users u ON u.email=c.email ORDER BY failedLogins DESC, c.updated_at DESC`));
    return NextResponse.json({ rows });
  }

  return NextResponse.json({ rows: [] });
}
