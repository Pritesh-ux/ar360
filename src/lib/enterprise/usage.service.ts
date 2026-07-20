import { query } from "@/lib/db";

export type UsageCounterRow = {
  id: number;
  workspace_uid: string;
  customer_uid: string;
  storage_bytes: number;
  bandwidth_bytes: number;
  product_count: number;
  total_views: number;
  total_ar_launches: number;
  total_asset_downloads: number;
  updated_at: string;
};

export type UsageDailyRow = {
  id: number;
  workspace_uid: string;
  customer_uid: string;
  date: string;
  storage_bytes: number;
  bandwidth_bytes: number;
  views: number;
  ar_launches: number;
};

export async function getUsageCounters(workspaceUid: string): Promise<UsageCounterRow | null> {
  const rows = await query<UsageCounterRow>(
    "SELECT * FROM usage_counters WHERE workspace_uid = ? LIMIT 1",
    [workspaceUid],
  );
  return rows[0] ?? null;
}

export async function ensureUsageCounters(
  workspaceUid: string,
  customerUid: string,
): Promise<UsageCounterRow> {
  await query(
    `INSERT IGNORE INTO usage_counters (workspace_uid, customer_uid) VALUES (?, ?)`,
    [workspaceUid, customerUid],
  );
  const rows = await query<UsageCounterRow>(
    "SELECT * FROM usage_counters WHERE workspace_uid = ? LIMIT 1",
    [workspaceUid],
  );
  return rows[0];
}

export async function incrementUsage(
  workspaceUid: string,
  customerUid: string,
  delta: Partial<{
    storage_bytes: number;
    bandwidth_bytes: number;
    product_count: number;
    total_views: number;
    total_ar_launches: number;
    total_asset_downloads: number;
  }>,
): Promise<void> {
  await ensureUsageCounters(workspaceUid, customerUid);

  const sets: string[] = [];
  const vals: number[] = [];

  for (const [k, v] of Object.entries(delta)) {
    if (v !== undefined && v !== 0) {
      sets.push(`${k} = ${k} + ?`);
      vals.push(v);
    }
  }
  if (!sets.length) return;
  vals.push(workspaceUid as unknown as number);

  await query(
    `UPDATE usage_counters SET ${sets.join(", ")} WHERE workspace_uid = ?`,
    vals as unknown as (string | number)[],
  );
}

export async function getUsageDaily(
  workspaceUid: string,
  from: string,
  to: string,
): Promise<UsageDailyRow[]> {
  return query<UsageDailyRow>(
    `SELECT * FROM usage_daily
     WHERE workspace_uid = ? AND date BETWEEN ? AND ?
     ORDER BY date ASC`,
    [workspaceUid, from, to],
  );
}

export type PlanLimits = {
  storage_bytes: number;
  bandwidth_bytes: number;
  product_count: number;
};

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free:         { storage_bytes: 100 * 1024 * 1024,     bandwidth_bytes: 1024 * 1024 * 1024,      product_count: 1 },
  starter:      { storage_bytes: 512 * 1024 * 1024,     bandwidth_bytes: 5 * 1024 * 1024 * 1024,  product_count: 5 },
  pro:          { storage_bytes: 5 * 1024 * 1024 * 1024, bandwidth_bytes: 50 * 1024 * 1024 * 1024, product_count: 50 },
  business:     { storage_bytes: 15 * 1024 * 1024 * 1024, bandwidth_bytes: 150 * 1024 * 1024 * 1024, product_count: 150 },
  enterprise:   { storage_bytes: 25 * 1024 * 1024 * 1024, bandwidth_bytes: 250 * 1024 * 1024 * 1024, product_count: 250 },
};

export function getPlanLimits(plan: string): PlanLimits {
  const clean = plan.toLowerCase().trim();
  // Map legacy IDs to clean up reads
  const mapped = clean === "trial" ? "free" : clean === "basic" ? "starter" : clean === "professional" ? "pro" : clean;
  return PLAN_LIMITS[mapped] ?? PLAN_LIMITS.free;
}
