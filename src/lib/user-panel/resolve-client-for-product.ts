import { query } from "@/lib/db";

/** Find the active client workspace linked to a product or QR resource. */
export async function resolveClientUidForDelivery(input: {
  productId?: string | null;
  qrResourceIds?: string[];
}): Promise<string | null> {
  const productId = String(input.productId || "").trim();
  const qrIds = (input.qrResourceIds || [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);

  if (!productId && qrIds.length === 0) return null;

  const conditions: string[] = [];
  const params: string[] = [];

  if (qrIds.length) {
    conditions.push(
      `(cr.resource_type = 'qr_code' AND cr.resource_id IN (${qrIds.map(() => "?").join(",")}))`,
    );
    params.push(...qrIds);
  }
  if (productId) {
    conditions.push(`(cr.resource_type = 'product' AND cr.resource_id = ?)`);
    params.push(productId);
  }

  const rows = await query<{ client_uid: string }>(
    `SELECT cr.client_uid
       FROM client_resources cr
       INNER JOIN clients c ON c.client_uid = cr.client_uid AND c.status = 'active'
      WHERE ${conditions.join(" OR ")}
      ORDER BY CASE WHEN cr.resource_type = 'qr_code' THEN 0 ELSE 1 END, cr.id DESC
      LIMIT 1`,
    params,
  ).catch(() => []);

  const uid = String(rows[0]?.client_uid || "").trim();
  return uid || null;
}
