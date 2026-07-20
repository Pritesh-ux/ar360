/** Normalize plan limit values — `null` means unlimited. */
export function normalizePlanLimit(value: number | null | undefined, isUnlimited?: boolean): number | null {
  if (isUnlimited) return null;
  if (value == null) return null;
  if (value < 0) return null;
  if (value === 0 && isUnlimited === false) return 0;
  // Legacy sentinel values
  if (value >= 999999999) return null;
  return value;
}

export function remainingFromLimit(limit: number | null, used: number): number | null {
  if (limit == null) return null;
  return Math.max(0, limit - used);
}

export function percentUsed(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function isExceeded(used: number, limit: number | null): boolean {
  if (limit == null) return false;
  return used >= limit;
}

export type UsageThresholdState = "normal" | "warning" | "exceeded";

export function usageThresholdState(used: number, limit: number | null): UsageThresholdState {
  if (limit == null || limit <= 0) return "normal";
  const pct = (used / limit) * 100;
  if (pct >= 100) return "exceeded";
  if (pct >= 80) return "warning";
  return "normal";
}
