import crypto from "crypto";
import type { ResultSetHeader } from "mysql2/promise";
import { getPool, query } from "@/lib/db";
import { getCustomerBandwidthUsedMb } from "@/lib/billing/bandwidth";
import {
  isDuplicateEntryError,
  renewalResultFromExisting,
} from "./workflow-policy";

export type EnterpriseDashboardData = {
  contract: {
    contractUid: string;
    startsOn: string;
    expiresOn: string;
    status: "active";
    renewalRequestUid: string | null;
  };
  plan: {
    customPlanUid: string;
    name: string;
    billingCycle: "monthly" | "yearly";
    pricePaise: number;
    notes: string | null;
    limits: {
      storageBytes: number | null;
      bandwidthBytes: number | null;
      products: number | null;
      models: number | null;
      arExperiences: number | null;
      teamMembers: number | null;
    };
    flags: {
      customBranding: boolean;
      prioritySupport: boolean;
      dedicatedInfrastructure: boolean;
      slaSupport: boolean;
      supportLevel: string | null;
    };
  };
  usage: {
    storageBytes: number;
    bandwidthBytes: number;
    products: number;
    models: number;
    arExperiences: number;
  };
  invoices: Array<{
    invoiceUid: string;
    invoiceNumber: string | null;
    status: string;
    totalPaise: number;
    currency: string;
    createdAt: string;
    paidAt: string | null;
    downloadUrl: string;
  }>;
};

type ContractRow = {
  contract_id: number;
  contract_uid: string;
  starts_on: string;
  expires_on: string;
  custom_plan_uid: string;
  name: string;
  billing_cycle: "monthly" | "yearly";
  price_paise: number | string;
  storage_limit_bytes: number | string | null;
  bandwidth_limit_bytes: number | string | null;
  product_limit: number | null;
  model_limit: number | null;
  ar_experience_limit: number | null;
  team_member_limit: number | null;
  custom_branding: number | boolean;
  priority_support: number | boolean;
  dedicated_infrastructure: number | boolean;
  sla_support: number | boolean;
  support_level: string | null;
  notes: string | null;
  renewal_request_uid: string | null;
};

function nullableNumber(value: number | string | null): number | null {
  return value == null ? null : Number(value);
}

async function getActiveContract(customerUid: string): Promise<ContractRow | null> {
  const rows = await query<ContractRow>(
    `SELECT ec.id AS contract_id, ec.contract_uid, ec.starts_on, ec.expires_on,
            cp.custom_plan_uid, cp.name, cp.billing_cycle, cp.price_paise,
            cp.storage_limit_bytes, cp.bandwidth_limit_bytes, cp.product_limit,
            cp.model_limit, cp.ar_experience_limit, cp.team_member_limit,
            cp.custom_branding, cp.priority_support, cp.dedicated_infrastructure,
            cp.sla_support, cp.support_level, cp.notes,
            renewal.request_uid AS renewal_request_uid
       FROM customers customer
       JOIN enterprise_contracts ec ON ec.customer_id = customer.id
       JOIN enterprise_custom_plans cp ON cp.id = ec.custom_plan_id AND cp.is_active = 1
       LEFT JOIN enterprise_requests renewal ON renewal.renewal_of_contract_id = ec.id
      WHERE customer.customer_uid = ?
        AND ec.status = 'active'
        AND ec.starts_on <= CURDATE()
        AND ec.expires_on >= CURDATE()
      ORDER BY ec.expires_on DESC, ec.id DESC
      LIMIT 1`,
    [customerUid],
  );
  return rows[0] || null;
}

export async function hasActiveEnterpriseContract(customerUid: string): Promise<boolean> {
  return Boolean(await getActiveContract(customerUid));
}

async function safeCount(sql: string, customerUid: string): Promise<number> {
  try {
    const rows = await query<{ total: number | string }>(sql, [customerUid]);
    return Number(rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

async function getLiveUsage(customerUid: string) {
  const [storageBytes, products, models, arExperiences, bandwidthMb] = await Promise.all([
    safeCount("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM product_assets WHERE customer_uid = ?", customerUid),
    safeCount(
      "SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",
      customerUid,
    ),
    safeCount(
      `SELECT COUNT(*) AS total FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND (COALESCE(model_url, '') <> '' OR LOWER(COALESCE(file_name, '')) LIKE '%.glb')`,
      customerUid,
    ),
    safeCount(
      `SELECT COUNT(*) AS total FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND LOWER(COALESCE(status, '')) IN ('published', 'active')`,
      customerUid,
    ),
    getCustomerBandwidthUsedMb(customerUid).catch(() => 0),
  ]);
  return {
    storageBytes,
    bandwidthBytes: Math.round(bandwidthMb * 1024 * 1024),
    products,
    models,
    arExperiences,
  };
}

export async function getEnterpriseDashboard(
  customerUid: string,
): Promise<EnterpriseDashboardData | null> {
  const contract = await getActiveContract(customerUid);
  if (!contract) return null;

  const [usage, invoiceRows] = await Promise.all([
    getLiveUsage(customerUid),
    query<{
      invoice_uid: string;
      invoice_number: string | null;
      status: string;
      total_paise: number | string;
      currency: string;
      created_at: string;
      paid_at: string | null;
    }>(
      `SELECT DISTINCT invoice.invoice_uid, invoice.invoice_number, invoice.status,
              invoice.total_paise, invoice.currency, invoice.created_at, invoice.paid_at
         FROM enterprise_payments payment
         JOIN billing_invoices invoice ON invoice.id = payment.invoice_id
         JOIN customers customer ON customer.customer_uid = invoice.customer_uid
        WHERE payment.contract_id = ?
          AND customer.customer_uid = ?
          AND invoice.customer_uid = ?
        ORDER BY invoice.created_at DESC`,
      [contract.contract_id, customerUid, customerUid],
    ),
  ]);

  return {
    contract: {
      contractUid: contract.contract_uid,
      startsOn: contract.starts_on,
      expiresOn: contract.expires_on,
      status: "active",
      renewalRequestUid: contract.renewal_request_uid,
    },
    plan: {
      customPlanUid: contract.custom_plan_uid,
      name: contract.name,
      billingCycle: contract.billing_cycle,
      pricePaise: Number(contract.price_paise),
      notes: contract.notes,
      limits: {
        storageBytes: nullableNumber(contract.storage_limit_bytes),
        bandwidthBytes: nullableNumber(contract.bandwidth_limit_bytes),
        products: nullableNumber(contract.product_limit),
        models: nullableNumber(contract.model_limit),
        arExperiences: nullableNumber(contract.ar_experience_limit),
        teamMembers: nullableNumber(contract.team_member_limit),
      },
      flags: {
        customBranding: Boolean(contract.custom_branding),
        prioritySupport: Boolean(contract.priority_support),
        dedicatedInfrastructure: Boolean(contract.dedicated_infrastructure),
        slaSupport: Boolean(contract.sla_support),
        supportLevel: contract.support_level,
      },
    },
    usage,
    invoices: invoiceRows.map((invoice) => ({
      invoiceUid: invoice.invoice_uid,
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      totalPaise: Number(invoice.total_paise),
      currency: invoice.currency,
      createdAt: invoice.created_at,
      paidAt: invoice.paid_at,
      downloadUrl: `/api/billing/invoices/${encodeURIComponent(invoice.invoice_uid)}/download?format=pdf`,
    })),
  };
}

function requestUid() {
  return `ER-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createEnterpriseRenewalRequest(customerUid: string) {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [contracts] = await connection.execute<any[]>(
      `SELECT ec.id, ec.contract_uid, ec.expires_on, customer.id AS customer_id,
              customer.company_name, customer.contact_name, customer.email, customer.phone,
              customer.country, source.company_website, source.industry,
              cp.product_limit, cp.storage_limit_bytes, cp.bandwidth_limit_bytes,
              cp.team_member_limit, cp.custom_branding, cp.dedicated_infrastructure,
              cp.priority_support, cp.sla_support
         FROM customers customer
         JOIN enterprise_contracts ec ON ec.customer_id = customer.id
         JOIN enterprise_custom_plans cp ON cp.id = ec.custom_plan_id AND cp.is_active = 1
         JOIN enterprise_requests source ON source.id = ec.request_id
        WHERE customer.customer_uid = ?
          AND ec.status = 'active'
          AND ec.starts_on <= CURDATE()
          AND ec.expires_on >= CURDATE()
        ORDER BY ec.expires_on DESC, ec.id DESC
        LIMIT 1 FOR UPDATE`,
      [customerUid],
    );
    const contract = contracts[0];
    if (!contract) {
      await connection.rollback();
      return null;
    }

    const [existing] = await connection.execute<any[]>(
      "SELECT request_uid FROM enterprise_requests WHERE renewal_of_contract_id = ? LIMIT 1",
      [contract.id],
    );
    const existingRenewal = renewalResultFromExisting(existing[0]);
    if (existingRenewal) {
      await connection.commit();
      return existingRenewal;
    }

    const uid = requestUid();
    await connection.execute<ResultSetHeader>(
      `INSERT INTO enterprise_requests (
        request_uid, company_name, contact_name, business_email, phone, company_website,
        country, industry, expected_products, expected_storage_gb,
        expected_monthly_bandwidth_gb, needs_more_storage, needs_more_bandwidth,
        needs_more_products, needs_team_members, needs_custom_branding,
        needs_dedicated_infrastructure, needs_priority_support, needs_sla,
        additional_requirements, customer_id, renewal_of_contract_id, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        contract.company_name || contract.contact_name,
        contract.contact_name,
        contract.email,
        contract.phone || "",
        contract.company_website,
        contract.country || "India",
        contract.industry || "Other",
        contract.product_limit,
        contract.storage_limit_bytes == null
          ? null
          : Math.ceil(Number(contract.storage_limit_bytes) / 1024 / 1024 / 1024),
        contract.bandwidth_limit_bytes == null
          ? null
          : Math.ceil(Number(contract.bandwidth_limit_bytes) / 1024 / 1024 / 1024),
        false,
        false,
        false,
        Number(contract.team_member_limit || 0) > 1,
        Boolean(contract.custom_branding),
        Boolean(contract.dedicated_infrastructure),
        Boolean(contract.priority_support),
        Boolean(contract.sla_support),
        `Renewal requested for contract ${contract.contract_uid}, expiring ${contract.expires_on}.`,
        contract.customer_id,
        contract.id,
        "enterprise_dashboard_renewal",
      ],
    );
    await connection.commit();
    return { requestUid: uid, created: true };
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntryError(error)) {
      const active = await getActiveContract(customerUid);
      const existingRenewal = renewalResultFromExisting(
        active ? { request_uid: active.renewal_request_uid } : null,
      );
      if (existingRenewal) return existingRenewal;
    }
    throw error;
  } finally {
    connection.release();
  }
}
