import crypto from "crypto";
import { getPool, query, type QueryValue } from "@/lib/db";
import { computeCollectionStatus, remainingBalancePaise } from "./bill-ledger";
import { ENTERPRISE_STATUS_LABELS, type CollectionStatus, type EnterpriseBillSummary, type EnterpriseContract, type EnterpriseContractInput, type EnterpriseCustomPlan, type EnterpriseCustomPlanInput, type EnterpriseNote, type EnterpriseNoteInput, type EnterprisePayment, type EnterprisePaymentInput, type EnterpriseQuote, type EnterpriseQuoteInput, type EnterpriseRequest, type EnterpriseRequestDetail, type EnterpriseRequestInput, type EnterpriseRequestListFilters, type EnterpriseStatus, type PaymentStatus } from "./types";
import { shouldRetryPublicRequestUid } from "./workflow-policy";

type RequestRow = {
  id: number; request_uid: string; company_name: string; contact_name: string; business_email: string;
  phone: string; company_website: string | null; country: string; industry: string;
  expected_products: number | null; expected_storage_gb: number | null; expected_monthly_bandwidth_gb: number | null;
  needs_more_storage: number; needs_more_bandwidth: number; needs_more_products: number;
  needs_team_members: number; needs_custom_branding: number; needs_dedicated_infrastructure: number;
  needs_priority_support: number; needs_sla: number;
  needs_qr?: number; needs_embed?: number; needs_share?: number; needs_ar?: number; needs_analytics?: number;
  additional_requirements: string | null; assigned_admin_id: number | null; assigned_admin_name: string | null;
  status: EnterpriseStatus; customer_id: number | null; source: string; created_at: string; updated_at: string;
};

function publicUid(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function requestUid(): string {
  return `ER-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function quoteNumber(): string {
  return `EQ-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const [{ total = 0 } = { total: 0 }] = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  if (Number(total) === 0) await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

let enterprisePlanGatesReady: Promise<void> | null = null;

export async function ensureEnterpriseCustomPlanFeatureGates() {
  if (!enterprisePlanGatesReady) {
    enterprisePlanGatesReady = (async () => {
      await addColumnIfMissing("enterprise_custom_plans", "allow_viewer", "TINYINT(1) NOT NULL DEFAULT 1");
      await addColumnIfMissing("enterprise_custom_plans", "allow_upload", "TINYINT(1) NOT NULL DEFAULT 1");
      await addColumnIfMissing("enterprise_custom_plans", "allow_ar", "TINYINT(1) NOT NULL DEFAULT 1");
      await addColumnIfMissing("enterprise_custom_plans", "allow_qr", "TINYINT(1) NOT NULL DEFAULT 1");
      await addColumnIfMissing("enterprise_custom_plans", "allow_share", "TINYINT(1) NOT NULL DEFAULT 1");
      await addColumnIfMissing("enterprise_custom_plans", "allow_embed", "TINYINT(1) NOT NULL DEFAULT 1");
      await addColumnIfMissing("enterprise_custom_plans", "allow_object_capture", "TINYINT(1) NOT NULL DEFAULT 1");
      await addColumnIfMissing("enterprise_custom_plans", "allow_custom_domain", "TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing("enterprise_custom_plans", "advanced_analytics", "TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing("enterprise_custom_plans", "qr_limit", "INT NULL");
      await addColumnIfMissing("enterprise_custom_plans", "share_link_limit", "INT NULL");
      await addColumnIfMissing("enterprise_custom_plans", "oc_captures_per_month", "INT NULL");
      await addColumnIfMissing("enterprise_custom_plans", "oc_compute_seconds_per_month", "INT NULL");
      await addColumnIfMissing("enterprise_custom_plans", "oc_concurrent_jobs", "INT NULL");
      await addColumnIfMissing("enterprise_custom_plans", "oc_max_retries", "INT NULL");
    })().catch((error) => {
      enterprisePlanGatesReady = null;
      throw error;
    });
  }
  await enterprisePlanGatesReady;
}

function mapCustomPlan(row: any): EnterpriseCustomPlan {
  return {
    customPlanUid: row.custom_plan_uid,
    name: row.name,
    billingCycle: row.billing_cycle,
    pricePaise: Number(row.price_paise),
    storageLimitBytes: row.storage_limit_bytes == null ? null : Number(row.storage_limit_bytes),
    bandwidthLimitBytes: row.bandwidth_limit_bytes == null ? null : Number(row.bandwidth_limit_bytes),
    productLimit: row.product_limit == null ? null : Number(row.product_limit),
    modelLimit: row.model_limit == null ? null : Number(row.model_limit),
    arExperienceLimit: row.ar_experience_limit == null ? null : Number(row.ar_experience_limit),
    teamMemberLimit: row.team_member_limit == null ? null : Number(row.team_member_limit),
    customBranding: Boolean(row.custom_branding),
    allowViewer: row.allow_viewer == null ? true : Boolean(row.allow_viewer),
    allowUpload: row.allow_upload == null ? true : Boolean(row.allow_upload),
    allowAr: row.allow_ar == null ? true : Boolean(row.allow_ar),
    allowQr: row.allow_qr == null ? true : Boolean(row.allow_qr),
    allowShare: row.allow_share == null ? true : Boolean(row.allow_share),
    allowEmbed: row.allow_embed == null ? true : Boolean(row.allow_embed),
    allowObjectCapture: row.allow_object_capture == null ? true : Boolean(row.allow_object_capture),
    allowCustomDomain: Boolean(row.allow_custom_domain),
    advancedAnalytics: Boolean(row.advanced_analytics),
    qrLimit: row.qr_limit == null ? null : Number(row.qr_limit),
    shareLinkLimit: row.share_link_limit == null ? null : Number(row.share_link_limit),
    ocCapturesPerMonth: row.oc_captures_per_month == null ? null : Number(row.oc_captures_per_month),
    ocComputeSecondsPerMonth:
      row.oc_compute_seconds_per_month == null ? null : Number(row.oc_compute_seconds_per_month),
    ocConcurrentJobs: row.oc_concurrent_jobs == null ? null : Number(row.oc_concurrent_jobs),
    ocMaxRetries: row.oc_max_retries == null ? null : Number(row.oc_max_retries),
    prioritySupport: Boolean(row.priority_support),
    dedicatedInfrastructure: Boolean(row.dedicated_infrastructure),
    slaSupport: Boolean(row.sla_support),
    supportLevel: row.support_level,
    notes: row.notes,
    isActive: Boolean(row.is_active),
    isReusable: Boolean(row.is_reusable),
    createdByAdminId: row.created_by_admin_id == null ? null : Number(row.created_by_admin_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let enterpriseRequestInterestsReady: Promise<void> | null = null;

export async function ensureEnterpriseRequestFeatureInterests() {
  if (!enterpriseRequestInterestsReady) {
    enterpriseRequestInterestsReady = (async () => {
      await addColumnIfMissing("enterprise_requests", "needs_qr", "TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing("enterprise_requests", "needs_embed", "TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing("enterprise_requests", "needs_share", "TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing("enterprise_requests", "needs_ar", "TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing("enterprise_requests", "needs_analytics", "TINYINT(1) NOT NULL DEFAULT 0");
    })().catch((error) => {
      enterpriseRequestInterestsReady = null;
      throw error;
    });
  }
  await enterpriseRequestInterestsReady;
}

let enterpriseInstallmentsReady: Promise<void> | null = null;

export async function ensureEnterpriseInstallmentSchema() {
  if (!enterpriseInstallmentsReady) {
    enterpriseInstallmentsReady = (async () => {
      await addColumnIfMissing(
        "enterprise_quotes",
        "collection_status",
        "ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid'",
      );
      await addColumnIfMissing("enterprise_quotes", "paid_paise", "BIGINT UNSIGNED NOT NULL DEFAULT 0");
      await addColumnIfMissing("enterprise_payments", "due_at", "DATE NULL");
      await addColumnIfMissing("enterprise_payments", "installment_label", "VARCHAR(80) NULL");
      await addColumnIfMissing(
        "enterprise_payments",
        "source",
        "ENUM('manual','razorpay_link') NOT NULL DEFAULT 'manual'",
      );
      await addColumnIfMissing("enterprise_payments", "provider_payment_link_id", "VARCHAR(80) NULL");
      await addColumnIfMissing("enterprise_payments", "reminder_sent_for_days", "INT NULL");
    })().catch((error) => {
      enterpriseInstallmentsReady = null;
      throw error;
    });
  }
  await enterpriseInstallmentsReady;
}

function mapRequest(row: RequestRow): EnterpriseRequest {
  return {
    id: Number(row.id), requestUid: row.request_uid, companyName: row.company_name, contactName: row.contact_name,
    businessEmail: row.business_email, phone: row.phone, companyWebsite: row.company_website,
    country: row.country, industry: row.industry,
    expectedProducts: row.expected_products == null ? null : Number(row.expected_products),
    expectedStorageGb: row.expected_storage_gb == null ? null : Number(row.expected_storage_gb),
    expectedMonthlyBandwidthGb: row.expected_monthly_bandwidth_gb == null ? null : Number(row.expected_monthly_bandwidth_gb),
    needsMoreStorage: Boolean(row.needs_more_storage), needsMoreBandwidth: Boolean(row.needs_more_bandwidth),
    needsMoreProducts: Boolean(row.needs_more_products),
    needsTeamMembers: Boolean(row.needs_team_members), needsCustomBranding: Boolean(row.needs_custom_branding),
    needsDedicatedInfrastructure: Boolean(row.needs_dedicated_infrastructure),
    needsPrioritySupport: Boolean(row.needs_priority_support), needsSla: Boolean(row.needs_sla),
    needsQr: Boolean(row.needs_qr),
    needsEmbed: Boolean(row.needs_embed),
    needsShare: Boolean(row.needs_share),
    needsAr: Boolean(row.needs_ar),
    needsAnalytics: Boolean(row.needs_analytics),
    additionalRequirements: row.additional_requirements, assignedAdminId: row.assigned_admin_id == null ? null : Number(row.assigned_admin_id),
    assignedAdminName: row.assigned_admin_name, status: row.status, statusLabel: ENTERPRISE_STATUS_LABELS[row.status],
    customerId: row.customer_id == null ? null : Number(row.customer_id), source: row.source,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const REQUEST_SELECT = `
  SELECT r.*, a.name AS assigned_admin_name
  FROM enterprise_requests r
  LEFT JOIN master_admins a ON a.id = r.assigned_admin_id`;

export async function insertEnterpriseRequest(input: EnterpriseRequestInput): Promise<string> {
  await ensureEnterpriseRequestFeatureInterests();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const uid = requestUid();
    try {
      await query(
        `INSERT INTO enterprise_requests (
          request_uid, company_name, contact_name, business_email, phone, company_website, country, industry,
          expected_products, expected_storage_gb, expected_monthly_bandwidth_gb,
          needs_more_storage, needs_more_bandwidth, needs_more_products, needs_team_members,
          needs_custom_branding, needs_dedicated_infrastructure, needs_priority_support, needs_sla,
          needs_qr, needs_embed, needs_share, needs_ar, needs_analytics,
          additional_requirements, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid, input.companyName, input.contactName, input.businessEmail, input.phone, input.companyWebsite ?? null,
          input.country, input.industry, input.expectedProducts ?? null, input.expectedStorageGb ?? null,
          input.expectedMonthlyBandwidthGb ?? null, Boolean(input.needsMoreStorage), Boolean(input.needsMoreBandwidth),
          Boolean(input.needsMoreProducts), Boolean(input.needsTeamMembers),
          Boolean(input.needsCustomBranding), Boolean(input.needsDedicatedInfrastructure),
          Boolean(input.needsPrioritySupport), Boolean(input.needsSla),
          Boolean(input.needsQr), Boolean(input.needsEmbed), Boolean(input.needsShare),
          Boolean(input.needsAr), Boolean(input.needsAnalytics),
          input.additionalRequirements ?? null, input.source || "pricing"],
      );
      return uid;
    } catch (error) {
      if (!shouldRetryPublicRequestUid(error, attempt)) throw error;
    }
  }
  throw new Error("Unable to allocate Enterprise request ID");
}

export async function listEnterpriseRequests(filters: EnterpriseRequestListFilters = {}) {
  await ensureEnterpriseRequestFeatureInterests().catch(() => {});
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 20)));
  const conditions: string[] = [];
  const values: QueryValue[] = [];
  if (filters.search?.trim()) {
    conditions.push("(LOWER(r.request_uid) LIKE ? OR LOWER(r.company_name) LIKE ? OR LOWER(r.contact_name) LIKE ? OR LOWER(r.business_email) LIKE ?)");
    const like = `%${filters.search.trim().toLowerCase()}%`;
    values.push(like, like, like, like);
  }
  if (filters.status) { conditions.push("r.status = ?"); values.push(filters.status); }
  if (filters.country) { conditions.push("r.country = ?"); values.push(filters.country); }
  if (filters.industry) { conditions.push("r.industry = ?"); values.push(filters.industry); }
  if (filters.assignedAdminId === null) conditions.push("r.assigned_admin_id IS NULL");
  else if (filters.assignedAdminId) { conditions.push("r.assigned_admin_id = ?"); values.push(filters.assignedAdminId); }
  if (filters.createdFrom) { conditions.push("DATE(r.created_at) >= ?"); values.push(filters.createdFrom); }
  if (filters.createdTo) { conditions.push("DATE(r.created_at) <= ?"); values.push(filters.createdTo); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRows = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM enterprise_requests r ${where}`, values);
  const rows = await query<RequestRow>(
    `${REQUEST_SELECT} ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  const total = Number(countRows[0]?.total || 0);
  return { requests: rows.map(mapRequest), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function getEnterpriseRequestFilterOptions() {
  const [countries, industries, admins] = await Promise.all([
    query<{ value: string }>(
      "SELECT DISTINCT country AS value FROM enterprise_requests WHERE country <> '' ORDER BY country",
    ),
    query<{ value: string }>(
      "SELECT DISTINCT industry AS value FROM enterprise_requests WHERE industry <> '' ORDER BY industry",
    ),
    query<{ id: number; name: string }>(
      "SELECT id, name FROM master_admins WHERE status = 'Active' ORDER BY name",
    ),
  ]);
  return {
    countries: countries.map((row) => row.value),
    industries: industries.map((row) => row.value),
    assignees: admins.map((row) => ({ id: Number(row.id), name: row.name })),
  };
}

export async function getEnterpriseRequest(requestUidValue: string): Promise<EnterpriseRequest | null> {
  await ensureEnterpriseRequestFeatureInterests().catch(() => {});
  const rows = await query<RequestRow>(`${REQUEST_SELECT} WHERE r.request_uid = ? LIMIT 1`, [requestUidValue]);
  return rows[0] ? mapRequest(rows[0]) : null;
}

async function requireRequestId(requestUidValue: string): Promise<number> {
  const rows = await query<{ id: number }>("SELECT id FROM enterprise_requests WHERE request_uid = ? LIMIT 1", [requestUidValue]);
  if (!rows[0]) throw new Error("Enterprise request not found");
  return Number(rows[0].id);
}

export async function getEnterpriseRequestDetail(requestUidValue: string): Promise<EnterpriseRequestDetail | null> {
  await ensureEnterpriseInstallmentSchema();
  const request = await getEnterpriseRequest(requestUidValue);
  if (!request) return null;
  const [noteRows, quoteRows, paymentRows, contractRows] = await Promise.all([
    query<any>(`SELECT n.note_uid, n.admin_id, a.name AS admin_name, n.event_type, n.body, n.created_at
      FROM enterprise_notes n LEFT JOIN master_admins a ON a.id = n.admin_id
      WHERE n.request_id = ? ORDER BY n.created_at DESC`, [request.id]),
    query<any>(`SELECT q.*, p.custom_plan_uid FROM enterprise_quotes q
      LEFT JOIN enterprise_custom_plans p ON p.id = q.custom_plan_id
      WHERE q.request_id = ? ORDER BY q.version DESC`, [request.id]),
    query<any>(`SELECT p.*, q.quote_uid, c.contract_uid, i.invoice_uid FROM enterprise_payments p
      JOIN enterprise_quotes q ON q.id = p.quote_id LEFT JOIN enterprise_contracts c ON c.id = p.contract_id
      LEFT JOIN billing_invoices i ON i.id = p.invoice_id
      WHERE p.request_id = ? ORDER BY p.created_at DESC`, [request.id]),
    query<any>(`SELECT c.*, p.custom_plan_uid, previous.contract_uid AS renewal_of_contract_uid
      FROM enterprise_contracts c JOIN enterprise_custom_plans p ON p.id = c.custom_plan_id
      LEFT JOIN enterprise_contracts previous ON previous.id = c.renewal_of_contract_id
      WHERE c.request_id = ? ORDER BY c.created_at DESC`, [request.id]),
  ]);
  const notes: EnterpriseNote[] = noteRows.map((row) => ({ noteUid: row.note_uid, adminId: row.admin_id, adminName: row.admin_name, eventType: row.event_type, body: row.body, createdAt: row.created_at }));
  const quotes: EnterpriseQuote[] = quoteRows.map((row) => mapQuoteRow(row));
  const payments: EnterprisePayment[] = paymentRows.map((row) => mapPaymentRow(row));
  for (const quote of quotes) {
    const paidPaise = payments
      .filter((payment) => payment.quoteUid === quote.quoteUid && payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amountPaise, 0);
    quote.paidPaise = paidPaise;
    quote.remainingPaise = remainingBalancePaise(quote.pricePaise, paidPaise);
    quote.collectionStatus = computeCollectionStatus(quote.pricePaise, paidPaise);
  }
  const contracts: EnterpriseContract[] = contractRows.map((row) => ({ contractUid: row.contract_uid, customerId: Number(row.customer_id), customPlanUid: row.custom_plan_uid, subscriptionId: row.subscription_id, startsOn: row.starts_on, expiresOn: row.expires_on, status: row.status, renewalOfContractUid: row.renewal_of_contract_uid, createdAt: row.created_at, updatedAt: row.updated_at }));
  const billSummary = await getEnterpriseBillSummary(requestUidValue, request.id, quotes, payments);
  return { ...request, notes, quotes, payments, contracts, billSummary };
}

function mapQuoteRow(row: any): EnterpriseQuote {
  const pricePaise = Number(row.price_paise);
  const paidPaise = Number(row.paid_paise || 0);
  const collectionStatus = (row.collection_status as CollectionStatus)
    || computeCollectionStatus(pricePaise, paidPaise);
  return {
    quoteUid: row.quote_uid, customPlanUid: row.custom_plan_uid, planName: row.plan_name,
    quoteNumber: row.quote_number, version: Number(row.version), billingCycle: row.billing_cycle,
    pricePaise, currency: row.currency,
    storageLimitBytes: row.storage_limit_bytes == null ? null : Number(row.storage_limit_bytes),
    bandwidthLimitBytes: row.bandwidth_limit_bytes == null ? null : Number(row.bandwidth_limit_bytes),
    productLimit: row.product_limit == null ? null : Number(row.product_limit),
    modelLimit: row.model_limit == null ? null : Number(row.model_limit),
    arExperienceLimit: row.ar_experience_limit == null ? null : Number(row.ar_experience_limit),
    teamMemberLimit: row.team_member_limit == null ? null : Number(row.team_member_limit),
    customBranding: Boolean(row.custom_branding), prioritySupport: Boolean(row.priority_support),
    dedicatedInfrastructure: Boolean(row.dedicated_infrastructure), slaSupport: Boolean(row.sla_support),
    supportLevel: row.support_level, planNotes: row.plan_notes,
    validUntil: row.valid_until, terms: row.terms, status: row.status,
    collectionStatus,
    paidPaise,
    remainingPaise: remainingBalancePaise(pricePaise, paidPaise),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapPaymentRow(row: any): EnterprisePayment {
  return {
    paymentUid: row.payment_uid,
    quoteUid: row.quote_uid,
    contractUid: row.contract_uid,
    invoiceId: row.invoice_id,
    invoiceUid: row.invoice_uid,
    invoiceNumber: row.invoice_number,
    subscriptionId: row.subscription_id == null ? null : Number(row.subscription_id),
    amountPaise: Number(row.amount_paise),
    currency: row.currency,
    paymentLink: row.payment_link,
    transactionId: row.transaction_id,
    paymentMethod: row.payment_method,
    paidAt: row.paid_at,
    status: row.status,
    notes: row.notes,
    dueAt: row.due_at ? String(row.due_at).slice(0, 10) : null,
    installmentLabel: row.installment_label || null,
    source: row.source === "razorpay_link" ? "razorpay_link" : "manual",
    providerPaymentLinkId: row.provider_payment_link_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getEnterpriseBillSummary(
  requestUidValue: string,
  requestId?: number,
  quotes?: EnterpriseQuote[],
  payments?: EnterprisePayment[],
): Promise<EnterpriseBillSummary> {
  await ensureEnterpriseInstallmentSchema();
  const detailQuotes = quotes || [];
  const detailPayments = payments || [];
  let quote = detailQuotes[0] || null;
  if (!quote) {
    const rows = await query<any>(
      `SELECT q.*, p.custom_plan_uid FROM enterprise_quotes q
       LEFT JOIN enterprise_custom_plans p ON p.id = q.custom_plan_id
       JOIN enterprise_requests r ON r.id = q.request_id
       WHERE r.request_uid = ? ORDER BY q.version DESC LIMIT 1`,
      [requestUidValue],
    );
    quote = rows[0] ? mapQuoteRow(rows[0]) : null;
  }
  const quotePayments = quote
    ? detailPayments.filter((payment) => payment.quoteUid === quote!.quoteUid)
    : detailPayments;
  const paidPaise = quotePayments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amountPaise, 0);
  const totalPaise = quote?.pricePaise || 0;
  const customerRows = await query<{ customer_uid: string | null; sub_status: string | null }>(
    `SELECT c.customer_uid, s.status AS sub_status
       FROM enterprise_requests r
       LEFT JOIN customers c ON c.id = r.customer_id
       LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
      WHERE r.request_uid = ? LIMIT 1`,
    [requestUidValue],
  ).catch(() => []);
  return {
    quoteUid: quote?.quoteUid || null,
    quoteNumber: quote?.quoteNumber || null,
    totalPaise,
    paidPaise,
    remainingPaise: remainingBalancePaise(totalPaise, paidPaise),
    currency: quote?.currency || "INR",
    collectionStatus: computeCollectionStatus(totalPaise, paidPaise),
    installmentCount: quotePayments.length,
    paidInstallmentCount: quotePayments.filter((payment) => payment.status === "paid").length,
    customerUid: customerRows[0]?.customer_uid || null,
    subscriptionStatus: customerRows[0]?.sub_status || null,
  };
}

export async function refreshQuoteCollectionStatus(quoteId: number): Promise<{
  paidPaise: number;
  collectionStatus: CollectionStatus;
}> {
  await ensureEnterpriseInstallmentSchema();
  const [quoteRows, paidRows] = await Promise.all([
    query<{ price_paise: number }>("SELECT price_paise FROM enterprise_quotes WHERE id = ? LIMIT 1", [quoteId]),
    query<{ paid: number | string }>(
      "SELECT COALESCE(SUM(amount_paise), 0) AS paid FROM enterprise_payments WHERE quote_id = ? AND status = 'paid'",
      [quoteId],
    ),
  ]);
  const totalPaise = Number(quoteRows[0]?.price_paise || 0);
  const paidPaise = Number(paidRows[0]?.paid || 0);
  const collectionStatus = computeCollectionStatus(totalPaise, paidPaise);
  await query(
    "UPDATE enterprise_quotes SET paid_paise = ?, collection_status = ? WHERE id = ?",
    [paidPaise, collectionStatus, quoteId],
  );
  return { paidPaise, collectionStatus };
}

export async function getQuotePaidPaiseExcludingPayment(quoteId: number, excludePaymentId: number): Promise<number> {
  const rows = await query<{ paid: number | string }>(
    `SELECT COALESCE(SUM(amount_paise), 0) AS paid
       FROM enterprise_payments
      WHERE quote_id = ? AND status = 'paid' AND id <> ?`,
    [quoteId, excludePaymentId],
  );
  return Number(rows[0]?.paid || 0);
}

export async function setEnterpriseRequestStatus(requestUidValue: string, status: EnterpriseStatus): Promise<void> {
  await query("UPDATE enterprise_requests SET status = ? WHERE request_uid = ?", [status, requestUidValue]);
}

export async function assignEnterpriseRequest(requestUidValue: string, adminId: number | null): Promise<void> {
  if (adminId != null) {
    const admins = await query<{ id: number }>("SELECT id FROM master_admins WHERE id = ? AND status = 'Active' LIMIT 1", [adminId]);
    if (!admins[0]) throw new Error("Active sales manager not found");
  }
  await query("UPDATE enterprise_requests SET assigned_admin_id = ? WHERE request_uid = ?", [adminId, requestUidValue]);
}

export async function insertEnterpriseNote(input: EnterpriseNoteInput): Promise<string> {
  const requestId = await requireRequestId(input.requestUid);
  const uid = publicUid("en");
  await query(`INSERT INTO enterprise_notes (note_uid, request_id, admin_id, event_type, body) VALUES (?, ?, ?, ?, ?)`,
    [uid, requestId, input.adminId ?? null, input.eventType || "note", input.body]);
  return uid;
}

export async function insertEnterpriseCustomPlan(input: EnterpriseCustomPlanInput): Promise<string> {
  await ensureEnterpriseCustomPlanFeatureGates();
  const uid = publicUid("ecp");
  await query(`INSERT INTO enterprise_custom_plans (
    custom_plan_uid, name, billing_cycle, price_paise, storage_limit_bytes, bandwidth_limit_bytes,
    product_limit, model_limit, ar_experience_limit, team_member_limit, custom_branding,
    allow_viewer, allow_upload, allow_ar, allow_qr, allow_share, allow_embed, allow_object_capture, allow_custom_domain,
    advanced_analytics, qr_limit, share_link_limit,
    oc_captures_per_month, oc_compute_seconds_per_month, oc_concurrent_jobs, oc_max_retries,
    priority_support, dedicated_infrastructure, sla_support, support_level, notes, is_active, is_reusable, created_by_admin_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    uid, input.name, input.billingCycle, input.pricePaise, input.storageLimitBytes ?? null, input.bandwidthLimitBytes ?? null,
    input.productLimit ?? null, input.modelLimit ?? null, input.arExperienceLimit ?? null, input.teamMemberLimit ?? null,
    Boolean(input.customBranding),
    input.allowViewer !== false ? 1 : 0,
    input.allowUpload !== false ? 1 : 0,
    input.allowAr !== false ? 1 : 0,
    input.allowQr !== false ? 1 : 0,
    input.allowShare !== false ? 1 : 0,
    input.allowEmbed !== false ? 1 : 0,
    input.allowObjectCapture !== false ? 1 : 0,
    input.allowCustomDomain ? 1 : 0,
    Boolean(input.advancedAnalytics) ? 1 : 0,
    input.qrLimit ?? null,
    input.shareLinkLimit ?? null,
    input.ocCapturesPerMonth ?? null,
    input.ocComputeSecondsPerMonth ?? null,
    input.ocConcurrentJobs ?? null,
    input.ocMaxRetries ?? null,
    Boolean(input.prioritySupport), Boolean(input.dedicatedInfrastructure), Boolean(input.slaSupport), input.supportLevel ?? null,
    input.notes ?? null, input.isActive ?? true, input.isReusable ?? true, input.createdByAdminId ?? null,
  ]);
  return uid;
}

export async function listEnterpriseCustomPlans(): Promise<EnterpriseCustomPlan[]> {
  await ensureEnterpriseCustomPlanFeatureGates();
  const rows = await query<any>(
    `SELECT * FROM enterprise_custom_plans WHERE is_reusable = 1 ORDER BY is_active DESC, updated_at DESC`,
  );
  return rows.map(mapCustomPlan);
}

export async function setEnterpriseCustomPlanActive(customPlanUid: string, isActive: boolean): Promise<boolean> {
  const plans = await query<{ id: number }>(
    "SELECT id FROM enterprise_custom_plans WHERE custom_plan_uid = ? AND is_reusable = 1 LIMIT 1",
    [customPlanUid],
  );
  if (!plans[0]) return false;
  await query("UPDATE enterprise_custom_plans SET is_active = ? WHERE id = ?", [isActive, plans[0].id]);
  return true;
}

export async function insertEnterpriseQuote(input: EnterpriseQuoteInput): Promise<string> {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [requests] = await connection.execute<any[]>("SELECT id FROM enterprise_requests WHERE request_uid = ? FOR UPDATE", [input.requestUid]);
    if (!requests[0]) throw new Error("Enterprise request not found");
    let customPlanId: number | null = null;
    let plan: any = null;
    if (input.customPlanUid) {
      const [plans] = await connection.execute<any[]>("SELECT * FROM enterprise_custom_plans WHERE custom_plan_uid = ? AND is_active = 1 LIMIT 1", [input.customPlanUid]);
      if (!plans[0]) throw new Error("Enterprise custom plan not found");
      customPlanId = Number(plans[0].id);
      plan = plans[0];
    }
    const [versions] = await connection.execute<any[]>("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM enterprise_quotes WHERE request_id = ?", [requests[0].id]);
    await connection.execute("UPDATE enterprise_quotes SET status = 'superseded' WHERE request_id = ? AND status IN ('draft', 'sent')", [requests[0].id]);
    const uid = publicUid("eq");
    await connection.execute(`INSERT INTO enterprise_quotes (
      quote_uid, request_id, custom_plan_id, plan_name, quote_number, version, billing_cycle, price_paise,
      currency, storage_limit_bytes, bandwidth_limit_bytes, product_limit, model_limit, ar_experience_limit,
      team_member_limit, custom_branding, priority_support, dedicated_infrastructure, sla_support,
      support_level, plan_notes, valid_until, terms, status, created_by_admin_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      uid, requests[0].id, customPlanId, plan?.name || "Custom Enterprise", quoteNumber(), Number(versions[0].version), input.billingCycle,
      input.pricePaise, input.currency || "INR",
      plan?.storage_limit_bytes ?? null, plan?.bandwidth_limit_bytes ?? null, plan?.product_limit ?? null,
      plan?.model_limit ?? null, plan?.ar_experience_limit ?? null, plan?.team_member_limit ?? null,
      Boolean(plan?.custom_branding), Boolean(plan?.priority_support), Boolean(plan?.dedicated_infrastructure),
      Boolean(plan?.sla_support), plan?.support_level ?? null, plan?.notes ?? null,
      input.validUntil, input.terms ?? null, input.status || "draft", input.createdByAdminId ?? null,
    ]);
    await connection.commit();
    return uid;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function insertEnterprisePayment(input: EnterprisePaymentInput): Promise<string> {
  await ensureEnterpriseInstallmentSchema();
  const [requestId, quoteRows, contractRows] = await Promise.all([
    requireRequestId(input.requestUid),
    query<{ id: number; price_paise: number }>(`SELECT q.id, q.price_paise FROM enterprise_quotes q
      JOIN enterprise_requests r ON r.id = q.request_id
      WHERE q.quote_uid = ? AND r.request_uid = ? LIMIT 1`, [input.quoteUid, input.requestUid]),
    input.contractUid ? query<{ id: number }>("SELECT id FROM enterprise_contracts WHERE contract_uid = ? LIMIT 1", [input.contractUid]) : Promise.resolve([]),
  ]);
  if (!quoteRows[0]) throw new Error("Enterprise quote not found");
  if (input.contractUid && !contractRows[0]) throw new Error("Enterprise contract not found");

  const paidRows = await query<{ paid: number | string }>(
    "SELECT COALESCE(SUM(amount_paise), 0) AS paid FROM enterprise_payments WHERE quote_id = ? AND status = 'paid'",
    [quoteRows[0].id],
  );
  const remaining = remainingBalancePaise(Number(quoteRows[0].price_paise), Number(paidRows[0]?.paid || 0));
  if (input.amountPaise > remaining) {
    throw new Error(`Payment amount exceeds remaining balance of ${(remaining / 100).toFixed(2)}`);
  }

  const installmentCount = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM enterprise_payments WHERE quote_id = ?",
    [quoteRows[0].id],
  );
  const label = input.installmentLabel?.trim()
    || `Installment ${Number(installmentCount[0]?.total || 0) + 1}`;

  const uid = publicUid("ep");
  await query(`INSERT INTO enterprise_payments (
    payment_uid, request_id, quote_id, contract_id, invoice_id, invoice_number, amount_paise, currency,
    payment_link, transaction_id, payment_method, paid_at, status, notes, created_by_admin_id,
    due_at, installment_label, source, provider_payment_link_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    uid, requestId, quoteRows[0].id, contractRows[0]?.id ?? null, input.invoiceId ?? null, input.invoiceNumber ?? null,
    input.amountPaise, input.currency || "INR", input.paymentLink ?? null, input.transactionId ?? null,
    input.paymentMethod ?? null, input.paidAt ?? null, input.status || "pending", input.notes ?? null,
    input.createdByAdminId ?? null,
    input.dueAt ?? null,
    label,
    input.source || "manual",
    input.providerPaymentLinkId ?? null,
  ]);
  return uid;
}

export async function updateEnterprisePaymentLink(
  paymentUid: string,
  paymentLink: string,
  providerPaymentLinkId: string,
): Promise<void> {
  await ensureEnterpriseInstallmentSchema();
  await query(
    `UPDATE enterprise_payments
        SET payment_link = ?, provider_payment_link_id = ?, source = 'razorpay_link'
      WHERE payment_uid = ?`,
    [paymentLink, providerPaymentLinkId, paymentUid],
  );
}

export async function getEnterpriseQuoteForDocument(requestUidValue: string, quoteUid: string) {
  const rows = await query<any>(`SELECT q.*, r.request_uid, r.company_name, r.contact_name, r.business_email,
      r.phone, r.country,
      c.starts_on AS period_starts_on, c.expires_on AS period_ends_on
    FROM enterprise_quotes q
    JOIN enterprise_requests r ON r.id = q.request_id
    LEFT JOIN enterprise_contracts c
      ON c.request_id = r.id AND c.status = 'active'
    WHERE r.request_uid = ? AND q.quote_uid = ?
    ORDER BY c.id DESC
    LIMIT 1`, [requestUidValue, quoteUid]);
  return rows[0] || null;
}

export async function setEnterpriseQuoteStatus(quoteUid: string, status: "draft" | "sent"): Promise<void> {
  await query("UPDATE enterprise_quotes SET status = ? WHERE quote_uid = ?", [status, quoteUid]);
}

export async function getEnterprisePaymentInvoiceContext(requestUidValue: string, paymentUid: string) {
  const rows = await query<any>(`SELECT p.*, q.quote_uid, q.plan_name, q.billing_cycle, cp.custom_plan_uid,
      r.request_uid, r.customer_id, c.customer_uid, c.email AS customer_email, i.invoice_uid
    FROM enterprise_payments p
    JOIN enterprise_requests r ON r.id = p.request_id
    JOIN enterprise_quotes q ON q.id = p.quote_id
    LEFT JOIN enterprise_custom_plans cp ON cp.id = q.custom_plan_id
    LEFT JOIN customers c ON c.id = r.customer_id
    LEFT JOIN billing_invoices i ON i.id = p.invoice_id
    WHERE r.request_uid = ? AND p.payment_uid = ? LIMIT 1`, [requestUidValue, paymentUid]);
  return rows[0] || null;
}

export async function linkEnterprisePaymentInvoice(
  paymentUid: string,
  invoiceId: number,
  invoiceNumber: string | null,
): Promise<void> {
  await query(
    "UPDATE enterprise_payments SET invoice_id = ?, invoice_number = ? WHERE payment_uid = ?",
    [invoiceId, invoiceNumber, paymentUid],
  );
}

export async function getEnterprisePaymentStatus(requestUidValue: string, paymentUid: string): Promise<PaymentStatus | null> {
  const rows = await query<{ status: PaymentStatus }>(`SELECT p.status FROM enterprise_payments p
    JOIN enterprise_requests r ON r.id = p.request_id
    WHERE r.request_uid = ? AND p.payment_uid = ? LIMIT 1`, [requestUidValue, paymentUid]);
  return rows[0]?.status || null;
}

export async function setEnterprisePaymentStatus(paymentUid: string, status: PaymentStatus, details: { transactionId?: string | null; paymentMethod?: string | null; paidAt?: string | null } = {}): Promise<void> {
  await query(`UPDATE enterprise_payments SET status = ?, transaction_id = COALESCE(?, transaction_id),
    payment_method = COALESCE(?, payment_method), paid_at = COALESCE(?, paid_at) WHERE payment_uid = ?`,
  [status, details.transactionId ?? null, details.paymentMethod ?? null, details.paidAt ?? null, paymentUid]);
}

export async function insertEnterpriseContract(input: EnterpriseContractInput): Promise<string> {
  const [requestId, plans, renewals] = await Promise.all([
    requireRequestId(input.requestUid),
    query<{ id: number }>("SELECT id FROM enterprise_custom_plans WHERE custom_plan_uid = ? LIMIT 1", [input.customPlanUid]),
    input.renewalOfContractUid ? query<{ id: number }>("SELECT id FROM enterprise_contracts WHERE contract_uid = ? LIMIT 1", [input.renewalOfContractUid]) : Promise.resolve([]),
  ]);
  if (!plans[0]) throw new Error("Enterprise custom plan not found");
  if (input.renewalOfContractUid && !renewals[0]) throw new Error("Renewed Enterprise contract not found");
  const uid = publicUid("ec");
  await query(`INSERT INTO enterprise_contracts (
    contract_uid, request_id, customer_id, custom_plan_id, subscription_id, starts_on, expires_on,
    status, renewal_of_contract_id, created_by_admin_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    uid, requestId, input.customerId, plans[0].id, input.subscriptionId ?? null, input.startsOn, input.expiresOn,
    input.status || "draft", renewals[0]?.id ?? null, input.createdByAdminId ?? null,
  ]);
  return uid;
}
