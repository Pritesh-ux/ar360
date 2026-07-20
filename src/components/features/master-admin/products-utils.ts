import { resolveStatusClass } from "@/components/ui/admin/status-resolver";

export function productStatusLabel(status?: string | null) {
  const value = String(status || "draft").toLowerCase();
  if (value === "published" || value === "active") return "Published";
  if (value === "archived" || value === "suspended") return "Archived";
  return "Draft";
}

export function productStatusClass(status: string) {
  return resolveStatusClass("product", status);
}

export function categoryBadgeClass(category: string) {
  return resolveStatusClass("productCategory", category);
}

export function fmtFileSize(mb: number) {
  if (mb <= 0) return "—";
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  if (mb < 1) return `${Math.max(0.1, Math.round(mb * 10) / 10)} MB`;
  return `${Math.round(mb * 10) / 10} MB`;
}

export function fmtStorageShort(mb: number) {
  if (mb <= 0) return "0 MB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtDateShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function productCode(id: string, prefix = "PRD") {
  const digits = String(id || "").replace(/\D/g, "");
  const suffix = (digits.slice(-5) || String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(-5) || "00001").padStart(5, "0");
  return `${prefix}-${suffix}`;
}

export function fmtStorageTB(mb: number) {
  if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(2)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${Math.round(mb)} MB`;
}

export function countJsonItems(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as object).length;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.length;
      if (parsed && typeof parsed === "object") return Object.keys(parsed).length;
    } catch {
      return 0;
    }
  }
  return 0;
}
