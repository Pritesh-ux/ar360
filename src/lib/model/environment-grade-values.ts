export function normalizeEnvironmentTint(value?: string | null) {
  const raw = String(value || "").trim();
  if (/^#([0-9a-f]{3})$/i.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#([0-9a-f]{6})$/i.test(raw)) return raw.toLowerCase();
  return "#ffffff";
}

export function normalizeEnvironmentSaturation(value?: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0, n));
}
