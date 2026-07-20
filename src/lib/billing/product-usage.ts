/**
 * Product usage counting rule (Batch 2):
 *
 * Count toward plan limit:
 * - draft, processing, published, unpublished, archived
 * - failed products that still have persisted assets
 *
 * Do not count:
 * - soft-deleted products (deleted_at IS NOT NULL)
 * - failed products with no persisted assets
 */
export const PRODUCT_USAGE_COUNT_SQL = `
  SELECT COUNT(*) AS total
    FROM products p
   WHERE p.customer_uid = ?
     AND p.deleted_at IS NULL
     AND (
       LOWER(COALESCE(p.status, 'draft')) <> 'failed'
       OR EXISTS (
         SELECT 1 FROM product_assets a
          WHERE a.product_uid = p.id
            AND a.customer_uid = p.customer_uid
            AND COALESCE(a.size_bytes, 0) > 0
            AND (a.deleted_at IS NULL OR a.status IS NULL OR a.status = 'active')
       )
     )
`;

export const PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS = `
  SELECT COUNT(*) AS total
    FROM products p
   WHERE p.customer_uid = ?
     AND p.deleted_at IS NULL
     AND (
       LOWER(COALESCE(p.status, 'draft')) <> 'failed'
       OR EXISTS (
         SELECT 1 FROM product_assets a
          WHERE a.product_uid = p.id
            AND a.customer_uid = p.customer_uid
            AND COALESCE(a.size_bytes, 0) > 0
       )
     )
`;

/** Active normal product assets — SUM(size_bytes) is storage source of truth. */
export const STORAGE_USAGE_SUM_SQL = `
  SELECT COALESCE(SUM(a.size_bytes), 0) AS total
    FROM product_assets a
   WHERE a.customer_uid = ?
     AND COALESCE(a.size_bytes, 0) > 0
     AND (a.deleted_at IS NULL)
     AND (a.status IS NULL OR a.status = 'active')
`;

export const STORAGE_USAGE_SUM_SQL_LEGACY = `
  SELECT COALESCE(SUM(a.size_bytes), 0) AS total
    FROM product_assets a
   WHERE a.customer_uid = ?
`;

/** Non-deleted recoverable QR codes (active, expired, archived, processing). */
export const QR_USAGE_COUNT_SQL = `
  SELECT COUNT(*) AS total
    FROM product_qr_codes q
   WHERE q.customer_uid = ?
     AND q.deleted_at IS NULL
`;

/** Non-deleted share links (all recoverable statuses). */
export const SHARE_LINK_USAGE_COUNT_SQL = `
  SELECT COUNT(*) AS total
    FROM share_links s
   WHERE s.customer_uid = ?
     AND s.deleted_at IS NULL
`;
