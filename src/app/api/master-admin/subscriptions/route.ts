import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureBillingPlanSchema } from "@/lib/billing/admin-plans";
import { BILLING_PLANS } from "@/lib/billing/plans";
import { query } from "@/lib/db";
import { paginationMeta, parsePagination } from "@/lib/master-admin/pagination";
import { refreshBillingAdminAlerts } from "@/lib/master-admin/production-billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionRow = {
  customer_uid: string;
  contact_name: string;
  company_name: string | null;
  email: string;
  customer_status: string;
  plan_id: string;
  plan_name: string | null;
  price_monthly_inr: number | null;
  price_yearly_inr: number | null;
  subscription_status: string | null;
  billing_period: string | null;
  trial_ends_at: string | null;
  trial_used: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: 0 | 1 | boolean;
  cancelled_at: string | null;
  last_payment_status: string | null;
  last_payment_amount_paise: number | null;
  last_payment_at: string | null;
  provider: string | null;
  provider_mode: string | null;
  provider_subscription_id: string | null;
  provider_status: string | null;
  mandate_status: string | null;
  next_charge_at: string | null;
  renewal_attempt_count: number | null;
  next_retry_at: string | null;
  last_failure_code: string | null;
  last_failure_message: string | null;
  sales_channel: string | null;
};

type PlanPriceMap = Record<string, { monthly: number; yearly: number }>;

function normalizeStatus(status: string | null, trialEndsAt: string | null) {
  if (status === "trialing" || status === "trial") {
    if (trialEndsAt && Date.now() > new Date(trialEndsAt).getTime()) return "Expired";
    return "Trial";
  }
  if (status === "active") return "Active";
  if (status === "past_due") return "Payment Failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "expired") return "Expired";
  return "Trial";
}

function paymentStatus(
  subStatus: string,
  lastPaymentStatus: string | null,
): "Paid" | "Trial" | "Failed" | "Pending" {
  if (subStatus === "Trial") return "Trial";
  if (lastPaymentStatus === "failed") return "Failed";
  if (lastPaymentStatus === "captured" || lastPaymentStatus === "paid") return "Paid";
  if (subStatus === "Payment Failed") return "Failed";
  if (subStatus === "Active") return "Paid";
  return "Pending";
}

function planPricesFromDb(rows: { id: string; price_monthly_inr: number | null; price_yearly_inr: number | null }[]): PlanPriceMap {
  const map: PlanPriceMap = {};
  for (const row of rows) {
    map[row.id] = {
      monthly: Number(row.price_monthly_inr || 0),
      yearly: Number(row.price_yearly_inr || 0),
    };
  }
  for (const plan of BILLING_PLANS) {
    if (!map[plan.id]) {
      map[plan.id] = {
        monthly: plan.priceMonthlyInr ?? 0,
        yearly: plan.priceYearlyInr ?? 0,
      };
    }
  }
  return map;
}

function subscriptionAmount(planId: string, billingPeriod: string | null, prices: PlanPriceMap, lastPaymentPaise: number) {
  const pricesForPlan = prices[planId] || { monthly: 0, yearly: 0 };
  const yearly = String(billingPeriod || "").toLowerCase() === "yearly";
  if (lastPaymentPaise > 0) return Math.round(lastPaymentPaise / 100);
  if (yearly && pricesForPlan.yearly > 0) return pricesForPlan.yearly;
  if (pricesForPlan.monthly > 0) return pricesForPlan.monthly;
  return 0;
}

function monthlyEquivalent(amount: number, billingPeriod: string | null) {
  if (String(billingPeriod || "").toLowerCase() === "yearly") return Math.round(amount / 12);
  return amount;
}

function renewalDate(row: SubscriptionRow) {
  return row.current_period_end || row.trial_ends_at;
}

function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const SUBSCRIPTION_FROM = `
  FROM customers c
  LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
  LEFT JOIN billing_plans bp ON bp.id = COALESCE(s.plan_id, c.plan_id, 'trial')
  LEFT JOIN (
    SELECT bp1.customer_uid, bp1.status, bp1.amount_paise, bp1.created_at
    FROM billing_payments bp1
    INNER JOIN (
      SELECT customer_uid, MAX(created_at) AS created_at
      FROM billing_payments
      GROUP BY customer_uid
    ) latest ON latest.customer_uid = bp1.customer_uid AND latest.created_at = bp1.created_at
  ) last_pay ON last_pay.customer_uid = c.customer_uid
`;

const SUBSCRIPTION_SELECT = `
  SELECT
    c.customer_uid,
    c.contact_name,
    c.company_name,
    c.email,
    c.status AS customer_status,
    COALESCE(s.plan_id, c.plan_id, 'trial') AS plan_id,
    bp.name AS plan_name,
    bp.price_monthly_inr,
    bp.price_yearly_inr,
    COALESCE(s.status, CASE WHEN c.status = 'Suspended' THEN 'cancelled' ELSE 'trialing' END) AS subscription_status,
    COALESCE(s.billing_period, 'monthly') AS billing_period,
    s.trial_ends_at,
    s.trial_used,
    s.current_period_start,
    s.current_period_end,
    COALESCE(s.cancel_at_period_end, 0) AS cancel_at_period_end,
    s.cancelled_at,
    last_pay.status AS last_payment_status,
    last_pay.amount_paise AS last_payment_amount_paise,
    last_pay.created_at AS last_payment_at
    ,s.provider, s.provider_mode, s.provider_subscription_id, s.provider_status,
    s.mandate_status, s.next_charge_at, s.renewal_attempt_count, s.next_retry_at,
    s.last_failure_code, s.last_failure_message, s.sales_channel
  ${SUBSCRIPTION_FROM}
`;

function mapSubscriptionRow(row: SubscriptionRow, prices: PlanPriceMap) {
  const subStatus = normalizeStatus(row.subscription_status, row.trial_ends_at);
  const amount = subscriptionAmount(
    row.plan_id || "trial",
    row.billing_period,
    prices,
    Number(row.last_payment_amount_paise || 0),
  );
  const renewal = renewalDate(row);
  const autoRenewOn =
    !Boolean(row.cancel_at_period_end) &&
    !row.cancelled_at &&
    (subStatus === "Active" || subStatus === "Trial");

  return {
    customerUid: row.customer_uid,
    customerName: row.contact_name || row.company_name || row.customer_uid,
    company: row.company_name || "—",
    email: row.email,
    planId: row.plan_id || "trial",
    planName: row.plan_name || row.plan_id || "Trial",
    status: subStatus,
    rawStatus: row.subscription_status || "trialing",
    billingCycle: String(row.billing_period || "monthly").toLowerCase() === "yearly" ? "Yearly" : "Monthly",
    startDate: row.current_period_start || row.trial_ends_at,
    renewalDate: renewal,
    renewalDays: daysUntil(renewal),
    amount,
    paymentStatus: paymentStatus(subStatus, row.last_payment_status),
    autoRenew: autoRenewOn,
    trialEndsAt: row.trial_ends_at,
    trialUsed: Boolean(row.trial_used),
    lastPaymentAt: row.last_payment_at,
    provider: row.provider || (row.sales_channel === "manual" ? "manual" : "legacy"),
    providerMode: row.provider_mode,
    providerSubscriptionId: row.provider_subscription_id,
    providerStatus: row.provider_status,
    mandateStatus: row.mandate_status,
    nextChargeAt: row.next_charge_at || row.current_period_end,
    renewalAttemptCount: Number(row.renewal_attempt_count || 0),
    nextRetryAt: row.next_retry_at,
    lastFailure: row.last_failure_code ? { code: row.last_failure_code, message: row.last_failure_message } : null,
    salesChannel: row.sales_channel || "legacy",
    mrrContribution:
      subStatus === "Active" && row.sales_channel !== "manual" && row.plan_id !== "trial" && row.plan_id !== "enterprise"
        ? monthlyEquivalent(amount, row.billing_period)
        : 0,
  };
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("subscriptions.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  await ensureBillingPlanSchema();

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const plan = (searchParams.get("plan") || "").trim();
  const billingCycle = (searchParams.get("billingCycle") || "").trim();
  const autoRenew = (searchParams.get("autoRenew") || "").trim();
  const expiringWithin = (searchParams.get("expiringWithin") || "").trim();

  const where: string[] = [];
  const values: (string | number)[] = [];

  if (search) {
    where.push("(c.customer_uid LIKE ? OR c.contact_name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ?)");
    const like = `%${search}%`;
    values.push(like, like, like, like);
  }
  if (status && status !== "all") {
    where.push("COALESCE(s.status, 'trialing') = ?");
    values.push(status);
  }
  if (plan && plan !== "all") {
    where.push("COALESCE(s.plan_id, c.plan_id, 'trial') = ?");
    values.push(plan);
  }
  if (billingCycle && billingCycle !== "all") {
    where.push("LOWER(COALESCE(s.billing_period, 'monthly')) = ?");
    values.push(billingCycle.toLowerCase());
  }
  if (autoRenew === "yes") {
    where.push("COALESCE(s.cancel_at_period_end, 0) = 0 AND s.cancelled_at IS NULL");
  } else if (autoRenew === "no") {
    where.push("(COALESCE(s.cancel_at_period_end, 0) = 1 OR s.cancelled_at IS NOT NULL)");
  }
  if (expiringWithin && expiringWithin !== "all") {
    const days = Math.max(1, Math.min(365, Number(expiringWithin) || 0));
    if (days > 0) {
      where.push(
        "DATEDIFF(COALESCE(s.current_period_end, s.trial_ends_at), CURDATE()) BETWEEN 0 AND ?",
      );
      values.push(days);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { page, pageSize, offset } = parsePagination(searchParams, { pageSize: 8 });

  try {
    const [countRows, subscriptions, summarySource, planRows, revenueDaily, churnRows, manualRevenueRows] = await Promise.all([
      query<{ total: number }>(
        `SELECT COUNT(DISTINCT c.customer_uid) AS total ${SUBSCRIPTION_FROM} ${whereSql}`,
        values,
      ),
      query<SubscriptionRow>(
        `${SUBSCRIPTION_SELECT}
        ${whereSql}
        ORDER BY COALESCE(s.current_period_end, s.trial_ends_at, c.created_at) ASC
        LIMIT ? OFFSET ?`,
        [...values, pageSize, offset],
      ),
      query<SubscriptionRow>(
        `${SUBSCRIPTION_SELECT}
        ${whereSql}
        ORDER BY COALESCE(s.current_period_end, s.trial_ends_at, c.created_at) ASC
        LIMIT 500`,
        values,
      ),

      query<{ id: string; price_monthly_inr: number | null; price_yearly_inr: number | null }>(
        `SELECT id, price_monthly_inr, price_yearly_inr FROM billing_plans`,
      ),

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
        LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
        GROUP BY d.date
        ORDER BY d.date
      `).catch(() => []),

      query<{ cancelled: number; activeStart: number }>(`
        SELECT
          (SELECT COUNT(*) FROM customer_subscriptions WHERE status IN ('cancelled', 'expired') AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS cancelled,
          (SELECT COUNT(*) FROM customer_subscriptions WHERE status IN ('active', 'trialing')) AS activeStart
      `).catch(() => [{ cancelled: 0, activeStart: 1 }]),
      query<{ revenue: number }>(`SELECT COALESCE(SUM(bp.amount_paise),0) / 100 AS revenue
        FROM billing_payments bp
        JOIN customer_subscriptions s ON s.customer_uid = bp.customer_uid
        WHERE bp.status = 'captured' AND s.plan_id = 'enterprise' AND s.sales_channel = 'manual'`)
        .catch(() => [{ revenue: 0 }]),
    ]);

    const prices = planPricesFromDb(planRows);

    const mapped = subscriptions.map((row) => mapSubscriptionRow(row, prices));
    const summaryMapped = summarySource.map((row) => mapSubscriptionRow(row, prices));
    const pagination = paginationMeta(Number(countRows[0]?.total || 0), page, pageSize);

    const activeSubs = summaryMapped.filter((item) => item.status === "Active" || item.status === "Trial");
    const mrr = summaryMapped
      .filter((item) => item.status === "Active")
      .reduce((sum, item) => sum + item.mrrContribution, 0);
    const arr = mrr * 12;

    const expiringSoon = summaryMapped.filter((item) => {
      const days = item.renewalDays;
      return days != null && days >= 0 && days <= 7 && item.status !== "Cancelled" && item.status !== "Expired";
    }).length;

    const expiredUsers = summaryMapped.filter((item) => item.status === "Expired" || item.status === "Cancelled").length;

    const selfServicePlanIds = [
      ...new Set(
        summaryMapped
          .filter((item) => item.salesChannel !== "manual" && item.planId !== "trial" && item.planId !== "enterprise")
          .map((item) => item.planId),
      ),
    ];
    const revenueByPlan = (selfServicePlanIds.length ? selfServicePlanIds : ["starter", "pro", "business"]).map(
      (planId) => ({
        name: planId.charAt(0).toUpperCase() + planId.slice(1),
        value: summaryMapped
          .filter((item) => item.planId === planId && item.status === "Active")
          .reduce((sum, item) => sum + item.mrrContribution, 0),
      }),
    );

    const churnBase = Math.max(Number(churnRows[0]?.activeStart || 1), 1);
    const churnRate = Math.round((Number(churnRows[0]?.cancelled || 0) / churnBase) * 1000) / 10;

    const renewals7 = summaryMapped
      .filter((item) => item.renewalDays != null && item.renewalDays >= 0 && item.renewalDays <= 7)
      .slice(0, 8)
      .map((item) => ({
        customerUid: item.customerUid,
        name: item.customerName,
        plan: item.planName,
        renewalDate: item.renewalDate,
        days: item.renewalDays,
      }));

    const renewals30 = summaryMapped
      .filter((item) => item.renewalDays != null && item.renewalDays >= 0 && item.renewalDays <= 30)
      .slice(0, 10)
      .map((item) => ({
        customerUid: item.customerUid,
        name: item.customerName,
        plan: item.planName,
        renewalDate: item.renewalDate,
        days: item.renewalDays,
      }));

    const arrDaily = revenueDaily.map((row) => ({
      label: row.label,
      value: Math.round(Number(row.value || 0) * 12),
    }));

    const recentRevenue = revenueDaily.slice(-15).reduce((sum, row) => sum + Number(row.value || 0), 0);
    const priorRevenue = revenueDaily.slice(-30, -15).reduce((sum, row) => sum + Number(row.value || 0), 0);
    const mrrGrowthPct =
      priorRevenue > 0
        ? Math.round(((recentRevenue - priorRevenue) / priorRevenue) * 1000) / 10
        : recentRevenue > 0
          ? 100
          : null;
    const arrGrowthPct = mrrGrowthPct;

    const churnDaily: { label: string; value: number }[] = [];

    const alerts = await refreshBillingAdminAlerts();
    return NextResponse.json({
      subscriptions: mapped,
      pagination,
      summary: {
        activePlans: activeSubs.filter((item) => item.status === "Active").length,
        monthlyRevenue: mrr,
        annualRevenue: arr,
        trialUsers: summaryMapped.filter((item) => item.status === "Trial").length,
        expiringSoon,
        expiredUsers,
        manualEnterpriseRevenue: Number(manualRevenueRows[0]?.revenue || 0),
        mrrGrowthPct,
        arrGrowthPct,
        churnRate,
      },
      analytics: {
        mrrDaily: revenueDaily,
        arrDaily,
        churnDaily,
        revenueByPlan,
      },
      sidebar: {
        renewals7,
        renewals30,
      },
      alerts,
    });
  } catch (error) {
    console.error("[master-admin/subscriptions]", error);
    return NextResponse.json({
      subscriptions: [],
      summary: {
        activePlans: 0,
        monthlyRevenue: 0,
        annualRevenue: 0,
        trialUsers: 0,
        expiringSoon: 0,
        expiredUsers: 0,
        mrrGrowthPct: null,
        arrGrowthPct: null,
        churnRate: 0,
      },
      analytics: { mrrDaily: [], arrDaily: [], churnDaily: [], revenueByPlan: [] },
      sidebar: { renewals7: [], renewals30: [] },
      error: "Unable to load subscriptions",
    });
  }
}
