import { resolveStatusClass } from "@/components/ui/admin/status-resolver";

export type SubscriptionStatus = "Active" | "Trial" | "Expired" | "Cancelled" | "Payment Failed";
export type PaymentStatus = "Paid" | "Trial" | "Failed" | "Pending";

export function subscriptionStatusClass(status: SubscriptionStatus) {
  return resolveStatusClass("subscription", status);
}

export function paymentStatusClass(status: PaymentStatus) {
  return resolveStatusClass("payment", status);
}

export function billingCycleLabel(value: string | null | undefined) {
  const key = String(value || "monthly").toLowerCase();
  if (key === "yearly" || key === "annual") return "Yearly";
  if (key === "free") return "Free";
  return "Monthly";
}

export function fmtMoneyInr(amount: number) {
  if (amount <= 0) return "Free";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function fmtDateShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(d: string | null | undefined) {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function renewalHint(days: number | null) {
  if (days == null) return "";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

export function renewalHintClass(days: number | null) {
  if (days == null) return "text-slate-400";
  if (days <= 1) return "text-red-600";
  if (days <= 7) return "text-amber-600";
  return "text-slate-400";
}
