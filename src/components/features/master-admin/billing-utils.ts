import { resolveStatusClass } from "@/components/ui/admin/status-resolver";

export type BillingStatus = "Paid" | "Pending" | "Failed" | "Refunded";

export function billingStatusClass(status: BillingStatus | string) {
  return resolveStatusClass("billing", status);
}

export function fmtMoneyInr(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function fmtMoneyShort(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return fmtMoneyInr(amount);
}

export function fmtDateShort(d: string | Date) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
