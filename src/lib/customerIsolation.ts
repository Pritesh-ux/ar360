import fs from "fs/promises";
import path from "path";
import type { CustomerUser } from "@/lib/auth";
import { ensureProductSchema, query, type QueryValue } from "@/lib/db";
import { getProductFolder } from "@/lib/localCustomerStorage";

const SAFE_UID_RE = /^[A-Za-z0-9_-]{1,180}$/;

/** SQL fragment — active (non-deleted) products only. */
export const ACTIVE_PRODUCT_SQL = "deleted_at IS NULL";

export function normalizeScopedId(value: unknown) {
  const id = String(value || "").trim();
  if (!id || !SAFE_UID_RE.test(id) || id.includes("..") || id.includes("/") || id.includes("\\")) return "";
  return id;
}

export function getSessionCustomerUid(user: CustomerUser) {
  return normalizeScopedId(user.customerUid);
}

export function clientCustomerScopeIsValid(user: CustomerUser, clientCustomerUid?: string | null) {
  const sessionCustomerUid = getSessionCustomerUid(user);
  const clientUid = normalizeScopedId(clientCustomerUid || "");
  return Boolean(sessionCustomerUid && (!clientUid || clientUid === sessionCustomerUid));
}

export async function productJsonExistsForCustomer(customerUid: string, productUid: string) {
  if (!normalizeScopedId(customerUid) || !normalizeScopedId(productUid)) return false;
  try {
    const file = path.join(getProductFolder(customerUid, productUid), "product.json");
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function verifyCustomerProductAccess(input: {
  user: CustomerUser;
  productUid: string;
  requireDbRow?: boolean;
}) {
  const customerUid = getSessionCustomerUid(input.user);
  const productUid = normalizeScopedId(input.productUid);

  if (!customerUid || !productUid) {
    return { ok: false as const, customerUid, productUid, reason: "Invalid customer or product scope." };
  }

  await ensureProductSchema();

  const rows = await query<{ id: string; customer_uid: string | null; user_id: number | null; status: string; deleted_at: string | null }>(
    `SELECT id, customer_uid, user_id, status, deleted_at
     FROM products
     WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL)
     LIMIT 1`,
    [productUid, customerUid, input.user.id],
  ).catch(() => []);

  if (rows[0]?.deleted_at) {
    return { ok: false as const, customerUid, productUid, reason: "Product is deleted." };
  }

  if (rows[0]) {
    return { ok: true as const, customerUid, productUid, product: rows[0] };
  }

  if (!input.requireDbRow && (await productJsonExistsForCustomer(customerUid, productUid))) {
    return { ok: true as const, customerUid, productUid, product: null };
  }

  return { ok: false as const, customerUid, productUid, reason: "Product ownership could not be verified." };
}

export async function updateScopedProductRow(input: {
  customerUid: string;
  productUid: string;
  sqlSet: string;
  values: QueryValue[];
}) {
  const customerUid = normalizeScopedId(input.customerUid);
  const productUid = normalizeScopedId(input.productUid);
  if (!customerUid || !productUid) return;

  await query(
    `UPDATE products SET ${input.sqlSet}, updated_at = NOW() WHERE id = ? AND customer_uid = ?`,
    [...input.values, productUid, customerUid],
  );
}
