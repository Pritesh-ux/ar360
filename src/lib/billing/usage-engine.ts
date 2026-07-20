/**
 * Canonical usage meters for the subscription engine.
 * Wraps customer-usage + product-usage SQL — single place for counts.
 */
import { getCustomerUsage, type CustomerUsage } from "@/lib/billing/customer-usage";
import { query } from "@/lib/db";
import {
  PRODUCT_USAGE_COUNT_SQL,
  PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS,
  QR_USAGE_COUNT_SQL,
  SHARE_LINK_USAGE_COUNT_SQL,
  STORAGE_USAGE_SUM_SQL,
  STORAGE_USAGE_SUM_SQL_LEGACY,
} from "@/lib/billing/product-usage";

export type UsageEngineSnapshot = {
  productsUsed: number;
  storageUsedBytes: number;
  storageUsedMb: number;
  qrCodesUsed: number;
  shareLinksUsed: number;
  modelsUsed: number;
  arExperiencesUsed: number;
  customerUsage: CustomerUsage;
};

async function countProducts(customerUid: string) {
  try {
    const rows = await query<{ total: number }>(PRODUCT_USAGE_COUNT_SQL, [customerUid]);
    return Number(rows[0]?.total || 0);
  } catch {
    try {
      const rows = await query<{ total: number }>(PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS, [customerUid]);
      return Number(rows[0]?.total || 0);
    } catch {
      return 0;
    }
  }
}

async function sumStorageBytes(customerUid: string) {
  try {
    const rows = await query<{ total: string | number }>(STORAGE_USAGE_SUM_SQL, [customerUid]);
    return Number(rows[0]?.total || 0);
  } catch {
    try {
      const rows = await query<{ total: string | number }>(STORAGE_USAGE_SUM_SQL_LEGACY, [customerUid]);
      return Number(rows[0]?.total || 0);
    } catch {
      return 0;
    }
  }
}

async function safeCount(sql: string, customerUid: string) {
  try {
    const rows = await query<{ total: number }>(sql, [customerUid]);
    return Number(rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

export async function getUsageSnapshot(customerUid: string): Promise<UsageEngineSnapshot> {
  const [customerUsage, productsUsed, storageUsedBytes, qrCodesUsed, shareLinksUsed, modelsUsed, arExperiencesUsed] =
    await Promise.all([
      getCustomerUsage(customerUid),
      countProducts(customerUid),
      sumStorageBytes(customerUid),
      safeCount(QR_USAGE_COUNT_SQL, customerUid),
      safeCount(SHARE_LINK_USAGE_COUNT_SQL, customerUid),
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
    ]);

  return {
    productsUsed,
    storageUsedBytes,
    storageUsedMb: storageUsedBytes / 1024 / 1024,
    qrCodesUsed,
    shareLinksUsed,
    modelsUsed,
    arExperiencesUsed,
    customerUsage,
  };
}

export { countProducts, sumStorageBytes };
