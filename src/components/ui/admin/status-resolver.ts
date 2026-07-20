export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "brand"
  | "sky"
  | "violet"
  | "amber"
  | "pink"
  | "indigo"
  | "orange";

export type StatusDomain =
  | "customer"
  | "billing"
  | "subscription"
  | "payment"
  | "couponType"
  | "couponStatus"
  | "ticketStatus"
  | "ticketPriority"
  | "product"
  | "productCategory"
  | "plan";

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-red-50 text-red-700 ring-red-100",
  info: "bg-sky-50 text-sky-700 ring-sky-100",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  brand: "bg-[var(--color-primary-soft)] text-slate-800 ring-[var(--color-primary)]/20",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  pink: "bg-pink-50 text-pink-700 ring-pink-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
};

export function statusToneClass(tone: StatusTone) {
  return STATUS_TONE_CLASSES[tone] ?? STATUS_TONE_CLASSES.neutral;
}

export function resolveStatusTone(domain: StatusDomain, value: string): StatusTone {
  const key = String(value || "").trim();
  const lower = key.toLowerCase();

  switch (domain) {
    case "customer":
      if (key === "Active") return "success";
      if (key === "Suspended") return "danger";
      return "neutral";

    case "billing":
      if (key === "Paid") return "success";
      if (key === "Pending") return "warning";
      if (key === "Failed") return "danger";
      if (key === "Refunded") return "violet";
      return "neutral";

    case "subscription":
      if (key === "Active") return "success";
      if (key === "Trial") return "info";
      if (key === "Payment Failed") return "danger";
      if (key === "Expired") return "warning";
      return "neutral";

    case "payment":
      if (key === "Paid") return "success";
      if (key === "Trial") return "info";
      if (key === "Failed") return "danger";
      return "warning";

    case "couponType":
      if (lower === "percentage") return "success";
      if (lower === "fixed") return "info";
      return "violet";

    case "couponStatus":
      if (key === "Active") return "success";
      if (key === "Expired") return "danger";
      return "neutral";

    case "ticketStatus":
      if (key === "Open") return "success";
      if (key === "Pending") return "warning";
      if (key === "Resolved") return "info";
      return "neutral";

    case "ticketPriority":
      if (key === "High") return "danger";
      if (key === "Medium") return "orange";
      return "success";

    case "product":
      if (key === "Published") return "success";
      if (key === "Draft") return "warning";
      return "neutral";

    case "productCategory":
      if (lower.includes("furniture")) return "success";
      if (lower.includes("accessor")) return "violet";
      if (lower.includes("automotive") || lower.includes("vehicle")) return "info";
      if (lower.includes("home") || lower.includes("decor")) return "pink";
      if (lower.includes("electron")) return "indigo";
      return "neutral";

    case "plan":
      if (lower === "enterprise") return "success";
      if (lower === "professional" || lower === "pro" || lower === "business") return "violet";
      if (lower === "basic" || lower === "starter") return "info";
      if (lower === "trial") return "warning";
      return "neutral";

    default:
      return "neutral";
  }
}

export function resolveStatusClass(domain: StatusDomain, value: string) {
  return statusToneClass(resolveStatusTone(domain, value));
}
