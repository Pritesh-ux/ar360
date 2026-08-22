import { resolveStatusClass } from "@/components/ui/admin/status-resolver";

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial",
  free: "Free",
  basic: "Starter",
  starter: "Starter",
  professional: "Professional",
  pro: "Professional",
  business: "Business",
  enterprise: "Enterprise",
  organisation: "Enterprise",
  organization: "Enterprise",
};

export function planLabel(planId: string) {
  const key = String(planId || "free").toLowerCase().trim();
  if (key.startsWith("ecp_")) return "Enterprise";
  return PLAN_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export function planBadgeClass(planId: string) {
  return resolveStatusClass("plan", planId);
}

export function statusBadgeClass(status: string) {
  return resolveStatusClass("customer", status);
}

export function fmtStorage(mb: number | string) {
  const val = Number(mb || 0);
  if (!Number.isFinite(val) || val <= 0) return "0 MB";
  if (val >= 1024) return `${(val / 1024).toFixed(val >= 10240 ? 0 : 1)} GB`;
  if (val >= 1) return `${val >= 10 ? Math.round(val) : val.toFixed(1)} MB`;
  return `${Math.max(val, 0.1).toFixed(1)} MB`;
}

export function fmtBandwidth(mb: number | string) {
  const val = Number(mb || 0);
  if (!Number.isFinite(val) || val <= 0) return "0 MB";
  if (val >= 1024) return `${(val / 1024).toFixed(val >= 10240 ? 0 : 1)} GB`;
  return `${val >= 10 ? Math.round(val) : val.toFixed(1)} MB`;
}

export function fmtRevenue(amount: number | string) {
  const val = Number(amount || 0);
  return `₹${val.toLocaleString("en-IN")}`;
}

export function fmtDateShort(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: string | null) {
  if (!d) return { date: "Never", time: "—" };
  const date = new Date(d);
  return {
    date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

export function customerInitials(name: string) {
  const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return String(name || "U").slice(0, 2).toUpperCase();
}

export function avatarColor(seed: string) {
  const palette = [
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

const PLAN_STORAGE_MB: Record<string, number> = {
  trial: 100,
  free: 200,
  basic: 512,
  starter: 2048,
  professional: 5120,
  pro: 10240,
  business: 51200,
  enterprise: 256000,
};

const PLAN_BANDWIDTH_MB: Record<string, number> = {
  trial: 1024,
  free: 2048,
  basic: 5120,
  starter: 10240,
  professional: 51200,
  pro: 102400,
  business: 512000,
  enterprise: 512000,
};

export function planStorageLimitMb(planId: string) {
  return PLAN_STORAGE_MB[String(planId || "free").toLowerCase()] ?? 2048;
}

export function planBandwidthLimitMb(planId: string) {
  return PLAN_BANDWIDTH_MB[String(planId || "free").toLowerCase()] ?? 10240;
}

export function usagePct(used: number | string, limit: number) {
  const u = Number(used || 0);
  if (!limit || limit >= 999999999) return 0;
  return Math.min(Math.round((u / limit) * 100), 100);
}

export function timezoneFromCountry(country: string | null | undefined) {
  const key = String(country || "").toLowerCase();
  if (key.includes("india")) return "Asia/Kolkata (IST)";
  if (key.includes("united states") || key === "usa" || key === "us") return "America/New_York (EST)";
  if (key.includes("united kingdom") || key === "uk") return "Europe/London (GMT)";
  if (key.includes("germany")) return "Europe/Berlin (CET)";
  if (key.includes("canada")) return "America/Toronto (EST)";
  if (key.includes("australia")) return "Australia/Sydney (AEST)";
  if (key.includes("uae") || key.includes("emirates")) return "Asia/Dubai (GST)";
  return "UTC";
}
