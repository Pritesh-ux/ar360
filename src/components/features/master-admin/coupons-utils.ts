import { resolveStatusClass } from "@/components/ui/admin/status-resolver";

export type CouponType = "percentage" | "fixed" | "free_trial";
export type CouponStatus = "Active" | "Expired" | "Disabled";

export function couponTypeLabel(type: CouponType | string) {
  if (type === "percentage") return "Percentage";
  if (type === "fixed") return "Fixed Amount";
  return "Free Trial";
}

export function couponTypeClass(type: CouponType | string) {
  return resolveStatusClass("couponType", type);
}

export function couponStatusClass(status: CouponStatus | string) {
  return resolveStatusClass("couponStatus", status);
}

export function fmtDiscount(type: CouponType | string, value: number) {
  if (type === "percentage") return `${value}% OFF`;
  if (type === "fixed") return `₹${Math.round(value).toLocaleString("en-IN")} OFF`;
  return `${Math.round(value)} Days Free`;
}

export function fmtMoneyInr(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function fmtDateShort(d: string | Date | null) {
  if (!d) return "No expiry";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function usagePercent(used: number, limit: number) {
  if (!limit || limit <= 0) return Math.min(used > 0 ? 35 : 0, 100);
  return Math.min(Math.round((used / limit) * 100), 100);
}

export function resolveCouponStatus(
  status: string,
  expiresAt: string | Date | null,
): CouponStatus {
  if (status === "disabled") return "Disabled";
  if (status === "expired") return "Expired";
  if (expiresAt) {
    const exp = new Date(expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return "Expired";
  }
  return "Active";
}
