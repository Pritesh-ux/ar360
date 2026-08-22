import { randomBytes } from "crypto";
import { query, type QueryValue } from "@/lib/db";
import { sanitizeOrigin } from "@/lib/url";
import type { EnquiryStatus, ProductEnquiryRecord } from "@/lib/viewer-contact/types";
import { ENQUIRY_STATUSES } from "@/lib/viewer-contact/types";

type EnquiryRow = {
  id: number;
  enquiry_uid: string;
  customer_uid: string;
  workspace_uid: string | null;
  client_uid: string | null;
  product_id: string;
  product_title: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  message: string | null;
  status: EnquiryStatus;
  source: string;
  viewer_url: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: EnquiryRow): ProductEnquiryRecord {
  return {
    id: row.id,
    enquiryUid: row.enquiry_uid,
    customerUid: row.customer_uid,
    workspaceUid: row.workspace_uid,
    clientUid: row.client_uid,
    productId: row.product_id,
    productTitle: row.product_title,
    visitorName: row.visitor_name,
    visitorPhone: row.visitor_phone,
    visitorEmail: row.visitor_email,
    message: row.message,
    status: row.status,
    source: row.source,
    viewerUrl: row.viewer_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function validateEnquiryInput(input: {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
}): { ok: true; name: string; phone: string; email: string | null; message: string | null } | { ok: false; error: string } {
  const name = stripTags(String(input.name || "")).slice(0, 120);
  const phoneRaw = String(input.phone || "").trim();
  const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");
  const emailRaw = String(input.email || "").trim().toLowerCase();
  const message = stripTags(String(input.message || "")).slice(0, 2000) || null;

  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (phoneDigits.replace(/\D/g, "").length < 8 || phoneDigits.replace(/\D/g, "").length > 15) {
    return { ok: false, error: "Please enter a valid phone number." };
  }
  if (emailRaw) {
    if (emailRaw.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return { ok: false, error: "Please enter a valid email address." };
    }
  }

  return {
    ok: true,
    name,
    phone: phoneDigits.slice(0, 40),
    email: emailRaw || null,
    message,
  };
}

export function sanitizeViewerUrl(raw: string | null | undefined, productId: string, requestOrigin: string) {
  const fallback = `${sanitizeOrigin(requestOrigin)}/viewer/${encodeURIComponent(productId)}`;
  const value = String(raw || "").trim();
  if (!value) return fallback.slice(0, 500);
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback.slice(0, 500);
    return url.toString().slice(0, 500);
  } catch {
    return fallback.slice(0, 500);
  }
}

export async function createProductEnquiry(input: {
  customerUid: string;
  workspaceUid: string | null;
  clientUid: string | null;
  productId: string;
  productTitle: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string | null;
  message: string | null;
  source: string;
  viewerUrl: string | null;
}): Promise<ProductEnquiryRecord> {
  const enquiryUid = `enq_${randomBytes(8).toString("hex")}`;
  await query(
    `INSERT INTO product_enquiries (
        enquiry_uid, customer_uid, workspace_uid, client_uid, product_id, product_title,
        visitor_name, visitor_phone, visitor_email, message, status, source, viewer_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
    [
      enquiryUid,
      input.customerUid,
      input.workspaceUid,
      input.clientUid,
      input.productId,
      input.productTitle.slice(0, 255),
      input.visitorName,
      input.visitorPhone,
      input.visitorEmail,
      input.message,
      input.source.slice(0, 40),
      input.viewerUrl,
    ],
  );
  const rows = await query<EnquiryRow>(
    `SELECT * FROM product_enquiries WHERE enquiry_uid = ? LIMIT 1`,
    [enquiryUid],
  );
  return mapRow(rows[0]!);
}

export async function listProductEnquiries(input: {
  customerUid: string;
  status?: EnquiryStatus | "all";
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ProductEnquiryRecord[]; total: number }> {
  const page = Math.max(1, input.page || 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize || 20));
  const where: string[] = ["customer_uid = ?"];
  const params: QueryValue[] = [input.customerUid];

  if (input.status && input.status !== "all" && ENQUIRY_STATUSES.includes(input.status)) {
    where.push("status = ?");
    params.push(input.status);
  }

  const q = String(input.q || "").trim().slice(0, 120);
  if (q) {
    where.push(
      "(visitor_name LIKE ? OR visitor_phone LIKE ? OR visitor_email LIKE ? OR product_title LIKE ?)",
    );
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    params.push(like, like, like, like);
  }

  const clause = where.join(" AND ");
  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM product_enquiries WHERE ${clause}`,
    params,
  );
  const items = await query<EnquiryRow>(
    `SELECT * FROM product_enquiries WHERE ${clause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { items: items.map(mapRow), total: Number(countRows[0]?.total || 0) };
}

export async function getProductEnquiryForCustomer(
  customerUid: string,
  enquiryUid: string,
): Promise<ProductEnquiryRecord | null> {
  const rows = await query<EnquiryRow>(
    `SELECT * FROM product_enquiries WHERE enquiry_uid = ? AND customer_uid = ? LIMIT 1`,
    [enquiryUid, customerUid],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateProductEnquiryStatus(input: {
  customerUid: string;
  enquiryUid: string;
  status: EnquiryStatus;
}): Promise<ProductEnquiryRecord | null> {
  if (!ENQUIRY_STATUSES.includes(input.status)) return null;
  await query(
    `UPDATE product_enquiries SET status = ? WHERE enquiry_uid = ? AND customer_uid = ?`,
    [input.status, input.enquiryUid, input.customerUid],
  );
  return getProductEnquiryForCustomer(input.customerUid, input.enquiryUid);
}

export async function verifyClientBelongsToCustomer(clientUid: string, customerUid: string): Promise<boolean> {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM clients
      WHERE client_uid = ? AND customer_uid = ? LIMIT 1`,
    [clientUid, customerUid],
  ).catch(() => [{ total: 0 }]);
  return Number(rows[0]?.total || 0) > 0;
}
