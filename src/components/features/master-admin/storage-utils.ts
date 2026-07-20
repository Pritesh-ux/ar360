export const PLATFORM_STORAGE_TB = 10;
export const PLATFORM_BANDWIDTH_TB = 10;

export function mbToTb(mb: number) {
  return mb / 1024 / 1024;
}

export function bytesToMb(bytes: number) {
  return bytes / (1024 * 1024);
}

export function fmtStorageTb(tb: number) {
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  const gb = tb * 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(gb * 1024)} MB`;
}

export function fmtStorageFromMb(mb: number) {
  return fmtStorageTb(mbToTb(mb));
}

export function fmtFileSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function fmtDateShort(d: string | Date | null) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function pctUsed(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.round((used / total) * 1000) / 10, 100);
}

export function fileTypeIconClass(type: string) {
  if (type === "models") return "bg-emerald-50 text-emerald-600";
  if (type === "images") return "bg-sky-50 text-sky-600";
  if (type === "textures") return "bg-violet-50 text-violet-600";
  if (type === "videos") return "bg-orange-50 text-orange-600";
  return "bg-slate-100 text-slate-600";
}

export function planStorageLabel(planId: string) {
  const key = String(planId || "").toLowerCase();
  if (key === "enterprise") return "Enterprise";
  if (key === "professional" || key === "pro") return "Professional";
  if (key === "basic" || key === "starter") return "Starter";
  if (key === "trial" || key === "free") return "Free";
  return planId || "Unknown";
}
