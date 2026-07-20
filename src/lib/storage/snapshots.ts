import { query } from "@/lib/db";

export async function upsertStorageSnapshot(input: {
  totalUsedMB: number;
  totalBandwidthMB: number;
  customerCount: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const storageBytes = Math.round(Number(input.totalUsedMB || 0) * 1024 * 1024);
  const bandwidthBytes = Math.round(Number(input.totalBandwidthMB || 0) * 1024 * 1024);

  await query(
    `INSERT INTO storage_usage_snapshots (
      snapshot_date, total_storage_bytes, total_bandwidth_bytes, customer_count
    ) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      total_storage_bytes = VALUES(total_storage_bytes),
      total_bandwidth_bytes = VALUES(total_bandwidth_bytes),
      customer_count = VALUES(customer_count)`,
    [today, storageBytes, bandwidthBytes, input.customerCount],
  ).catch(() => {
    // Table may not exist until migration 11 — ignore silently
  });
}

export async function queryStorageGrowthSeries(limitDays = 30) {
  const rows = await query<{ label: string; value: number }>(
    `SELECT DATE_FORMAT(snapshot_date, '%d %b') AS label,
      total_storage_bytes / POW(1024, 4) AS value
     FROM storage_usage_snapshots
     WHERE snapshot_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY snapshot_date`,
    [Math.max(limitDays - 1, 0)],
  ).catch(() => []);

  return rows.map((row) => ({
    label: row.label,
    value: Number(row.value || 0),
  }));
}
