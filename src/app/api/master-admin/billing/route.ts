import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import { formatLedgerPayment } from "@/lib/billing/payment-ledger";
import { exportBillingCsv } from "@/lib/master-admin/billing-actions.service";
import { paginationMeta, parsePagination } from "@/lib/master-admin/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  invoice: string;
  invoice_uid: string | null;
  customer_uid: string;
  customer: string;
  email: string;
  plan: string;
  billing: string;
  amount: number;
  gst: number;
  total: number;
  status: string;
  raw_status: string;
  gateway: string;
  transactionId: string;
  date: string;
};

/** Prefer payment.invoice_uid, else canonical AR360 invoice for the Razorpay payment. */
const INVOICE_JOIN = `LEFT JOIN billing_invoices bi ON bi.invoice_uid = COALESCE(
  NULLIF(bp.invoice_uid, ''),
  (
    SELECT i.invoice_uid
      FROM billing_invoices i
     WHERE bp.razorpay_payment_id IS NOT NULL
       AND bp.razorpay_payment_id != ''
       AND i.razorpay_payment_id = bp.razorpay_payment_id
     ORDER BY
       CASE
         WHEN i.invoice_number LIKE 'AR360/%' THEN 0
         WHEN i.invoice_uid REGEXP '^INV_' THEN 1
         ELSE 2
       END,
       i.created_at DESC
     LIMIT 1
  )
)`;

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("billing.read");
  if (auth instanceof NextResponse) return auth;

  await ensureAppSchema();

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const plan = (searchParams.get("plan") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const exportFormat = searchParams.get("export") || "";
  const { page, pageSize, offset } = parsePagination(searchParams, { pageSize: 10 });

  if (exportFormat === "csv") {
    const csv = await exportBillingCsv({ search, plan, status, dateFrom, dateTo });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="billing-${dateFrom || "all"}-${dateTo || "all"}.csv"`,
      },
    });
  }

  try {
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (search) {
      conditions.push(`(
        LOWER(COALESCE(c.contact_name, '')) LIKE ?
        OR LOWER(COALESCE(c.email, '')) LIKE ?
        OR LOWER(COALESCE(bi.invoice_number, bi.invoice_uid, '')) LIKE ?
        OR LOWER(COALESCE(bo.plan_id, '')) LIKE ?
      )`);
      const like = `%${search}%`;
      values.push(like, like, like, like);
    }
    if (dateFrom) {
      conditions.push("DATE(bp.created_at) >= ?");
      values.push(dateFrom);
    }
    if (dateTo) {
      conditions.push("DATE(bp.created_at) <= ?");
      values.push(dateTo);
    }
    if (plan) {
      conditions.push("COALESCE(bo.plan_id, '') = ?");
      values.push(plan);
    }
    if (status && status !== "all") {
      const raw =
        status === "Paid" ? "captured"
        : status === "Failed" ? "failed"
        : status === "Refunded" ? "refunded"
        : "created";
      conditions.push("bp.status = ?");
      values.push(raw);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRows, rows, summaryRows, revenueDaily, statusRows, recentRows] = await Promise.all([
      query<{ total: number }>(`
        SELECT COUNT(*) AS total
        FROM billing_payments bp
        LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
        ${INVOICE_JOIN}
        LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
        ${where}
      `, values),

      query<PaymentRow>(`
        SELECT
          bp.payment_uid AS id,
          COALESCE(bi.invoice_number, bi.invoice_uid, CONCAT('INV-', bp.payment_uid)) AS invoice,
          bi.invoice_uid,
          bp.customer_uid,
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
          bp.status AS raw_status,
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
          bp.created_at AS date
        FROM billing_payments bp
        LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
        ${INVOICE_JOIN}
        LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
        ${where}
        ORDER BY bp.created_at DESC
        LIMIT ? OFFSET ?
      `, [...values, pageSize, offset]),

      query<any>(`
        SELECT
          COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)), 0) / 100 AS revenue,
          COALESCE(SUM(CASE WHEN bp.status = 'captured' THEN COALESCE(bi.total_paise, bp.amount_paise) ELSE 0 END), 0) / 100 AS paid,
          COALESCE(SUM(CASE WHEN bp.status IN ('created', 'authorized') THEN COALESCE(bi.total_paise, bp.amount_paise) ELSE 0 END), 0) / 100 AS pending,
          COALESCE(SUM(CASE WHEN bp.status = 'failed' THEN COALESCE(bi.total_paise, bp.amount_paise) ELSE 0 END), 0) / 100 AS failed,
          COALESCE(SUM(CASE WHEN bp.status = 'refunded' THEN COALESCE(bi.total_paise, bp.amount_paise) ELSE 0 END), 0) / 100 AS refunds,
          COUNT(*) AS totalCount
        FROM billing_payments bp
        ${INVOICE_JOIN}
        ${where}
      `, values),

      query<{ label: string; value: number }>(`
        SELECT DATE_FORMAT(d.date, '%d %b') AS label,
          COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)), 0) / 100 AS value
        FROM (
          SELECT CURDATE() - INTERVAL seq DAY AS date FROM (
            SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
            UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
            UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
            UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
            UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
            UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
          ) n
        ) d
        LEFT JOIN billing_payments bp ON DATE(bp.created_at) = d.date AND bp.status = 'captured'
        ${INVOICE_JOIN}
        GROUP BY d.date
        ORDER BY d.date
      `).catch(() => []),

      query<{ status: string; count: number; amount: number }>(`
        SELECT
          CASE bp.status
            WHEN 'captured' THEN 'Paid'
            WHEN 'failed' THEN 'Failed'
            WHEN 'refunded' THEN 'Refunded'
            ELSE 'Pending'
          END AS status,
          COUNT(*) AS count,
          COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)), 0) / 100 AS amount
        FROM billing_payments bp
        ${INVOICE_JOIN}
        ${where}
        GROUP BY status
      `, values),

      query<PaymentRow>(`
        SELECT
          bp.payment_uid AS id,
          COALESCE(bi.invoice_number, bi.invoice_uid, CONCAT('INV-', bp.payment_uid)) AS invoice,
          bi.invoice_uid,
          bp.customer_uid,
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
          bp.status AS raw_status,
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
          bp.created_at AS date
        FROM billing_payments bp
        LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
        ${INVOICE_JOIN}
        LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
        ${where}
        ORDER BY bp.created_at DESC
        LIMIT 5
      `, values),
    ]);

    const invoices = rows.map((row) => {
      const formatted = formatLedgerPayment(row as any);
      return {
        id: row.id,
        invoice: row.invoice,
        invoiceUid: row.invoice_uid || "",
        customerUid: row.customer_uid,
        customer: row.customer,
        email: row.email,
        plan: row.plan,
        billing: row.billing,
        amount: Number(row.amount || 0),
        tax: Number(row.gst || 0),
        total: Number(row.total || 0),
        date: formatted.date,
        dateRaw: row.date,
        status: row.status as "Paid" | "Pending" | "Failed" | "Refunded",
        gateway: row.gateway,
        transactionId: row.transactionId,
      };
    });

    const pagination = paginationMeta(Number(countRows[0]?.total || 0), page, pageSize);

    const summaryRow = summaryRows[0] || {};
    const totalCount = Number(summaryRow.totalCount || invoices.length || 0);
    const statusBreakdown = ["Paid", "Pending", "Failed", "Refunded"].map((label) => {
      const match = statusRows.find((r) => r.status === label);
      const count = Number(match?.count || 0);
      return {
        status: label,
        count,
        amount: Number(match?.amount || 0),
        percent: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
      };
    });

    return NextResponse.json({
      invoices,
      pagination,
      summary: {
        revenue: Number(summaryRow.revenue || 0),
        pending: Number(summaryRow.pending || 0),
        paid: Number(summaryRow.paid || 0),
        failed: Number(summaryRow.failed || 0),
        refunds: Number(summaryRow.refunds || 0),
        totalCount,
      },
      analytics: {
        revenueDaily,
        statusBreakdown,
      },
      recentTransactions: recentRows.map((row) => {
        const formatted = formatLedgerPayment(row as any);
        return {
          id: row.id,
          invoice: row.invoice,
          customer: row.customer,
          total: Number(row.total || 0),
          date: formatted.date,
          status: row.status,
        };
      }),
    });
  } catch (error) {
    console.error("[master-admin/billing]", error);
    return NextResponse.json({
      invoices: [],
      summary: { revenue: 0, pending: 0, paid: 0, failed: 0, refunds: 0, totalCount: 0 },
      analytics: { revenueDaily: [], statusBreakdown: [] },
      recentTransactions: [],
      error: "Unable to load billing data",
    });
  }
}
