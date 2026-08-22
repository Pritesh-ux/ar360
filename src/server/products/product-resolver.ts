import { query } from "@/lib/db";

export type ResolvedProduct = {
  /** Internal DB primary key — canonical analytics / join identity */
  productId: string;
  publicId: string | null;
  viewerSlug: string | null;
  customerUid: string;
  status: string;
};

/**
 * Resolve any public product key (internal id, public_id, or viewer_slug)
 * to the canonical internal product id.
 */
export async function resolveProduct(
  key: string,
  options?: { customerUid?: string; requirePublished?: boolean },
): Promise<ResolvedProduct | null> {
  const raw = String(key || "").trim();
  if (!raw) return null;

  const params: Array<string> = [raw, raw, raw];
  let sql = `SELECT id, public_id, viewer_slug, customer_uid, status
               FROM products
              WHERE (id = ? OR public_id = ? OR viewer_slug = ?)`;

  if (options?.customerUid) {
    sql += ` AND customer_uid = ?`;
    params.push(options.customerUid);
  }
  if (options?.requirePublished) {
    sql += ` AND LOWER(status) IN ('published', 'active')`;
  }
  sql += ` LIMIT 1`;

  const rows = await query<{
    id: string;
    public_id: string | null;
    viewer_slug: string | null;
    customer_uid: string;
    status: string;
  }>(sql, params).catch(() => []);

  const row = rows[0];
  if (!row) return null;

  return {
    productId: String(row.id),
    publicId: row.public_id ? String(row.public_id) : null,
    viewerSlug: row.viewer_slug ? String(row.viewer_slug) : null,
    customerUid: String(row.customer_uid),
    status: String(row.status || ""),
  };
}

/** Convenience: always returns internal product id or null. */
export async function resolveProductId(key: string): Promise<string | null> {
  const resolved = await resolveProduct(key);
  return resolved?.productId ?? null;
}
