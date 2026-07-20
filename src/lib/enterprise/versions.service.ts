import { query } from "@/lib/db";

export type ProductVersionRow = {
  id: number;
  product_uid: string;
  customer_uid: string;
  workspace_uid: string;
  version_number: number;
  created_by_user_id: number | null;
  label: string;
  snapshot: string; // JSON
  created_at: string;
};

export async function saveProductVersion(params: {
  productUid: string;
  customerUid: string;
  workspaceUid: string;
  createdByUserId?: number | null;
  label?: string;
  snapshot: Record<string, unknown>;
}): Promise<ProductVersionRow> {
  // Get next version number
  const rows = await query<{ max_v: number | null }>(
    "SELECT MAX(version_number) AS max_v FROM product_versions WHERE product_uid = ?",
    [params.productUid],
  );
  const nextVersion = (rows[0]?.max_v ?? 0) + 1;

  await query(
    `INSERT INTO product_versions
       (product_uid, customer_uid, workspace_uid, version_number, created_by_user_id, label, snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.productUid,
      params.customerUid,
      params.workspaceUid,
      nextVersion,
      params.createdByUserId ?? null,
      params.label ?? `Version ${nextVersion}`,
      JSON.stringify(params.snapshot),
    ],
  );

  const result = await query<ProductVersionRow>(
    `SELECT * FROM product_versions
     WHERE product_uid = ? AND version_number = ?
     LIMIT 1`,
    [params.productUid, nextVersion],
  );
  return result[0];
}

export async function listProductVersions(
  productUid: string,
  customerUid: string,
): Promise<Omit<ProductVersionRow, "snapshot">[]> {
  return query<Omit<ProductVersionRow, "snapshot">>(
    `SELECT id, product_uid, customer_uid, workspace_uid, version_number,
            created_by_user_id, label, created_at
     FROM product_versions
     WHERE product_uid = ? AND customer_uid = ?
     ORDER BY version_number DESC`,
    [productUid, customerUid],
  );
}

export async function getProductVersion(
  versionId: number,
  productUid: string,
  customerUid: string,
): Promise<ProductVersionRow | null> {
  const rows = await query<ProductVersionRow>(
    `SELECT * FROM product_versions
     WHERE id = ? AND product_uid = ? AND customer_uid = ?
     LIMIT 1`,
    [versionId, productUid, customerUid],
  );
  return rows[0] ?? null;
}

export async function pruneOldVersions(
  productUid: string,
  keepCount = 50,
): Promise<void> {
  await query(
    `DELETE FROM product_versions
     WHERE product_uid = ?
       AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM product_versions
           WHERE product_uid = ?
           ORDER BY version_number DESC
           LIMIT ?
         ) AS keep
       )`,
    [productUid, productUid, keepCount],
  );
}
