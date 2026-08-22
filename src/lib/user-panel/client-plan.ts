/** Per-client commercial plan window + public showroom link expiry. */

export type ClientPlanFields = {
  plan_starts_at?: string | Date | null;
  plan_expires_at?: string | Date | null;
  link_expires_at?: string | Date | null;
  status?: string | null;
};

/** Calendar date `YYYY-MM-DD` from MySQL DATE / ISO string. */
export function toYmd(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Empty string / invalid → null. Valid `YYYY-MM-DD` kept as-is. */
export function parseOptionalYmd(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const ymd = toYmd(value);
  if (!ymd) return undefined;
  return ymd;
}

export function resolveLinkExpiresYmd(client: ClientPlanFields): string | null {
  return toYmd(client.link_expires_at) || toYmd(client.plan_expires_at);
}

/** Inclusive: still active on the expire calendar day. */
export function isDateExpired(ymd: string | null, now = new Date()): boolean {
  if (!ymd) return false;
  return ymd < todayYmd(now);
}

export function isClientLinkActive(client: ClientPlanFields, now = new Date()): boolean {
  if (String(client.status || "active").toLowerCase() !== "active") return false;
  return !isDateExpired(resolveLinkExpiresYmd(client), now);
}

export function formatPlanRange(client: ClientPlanFields): string {
  const start = toYmd(client.plan_starts_at);
  const end = toYmd(client.plan_expires_at);
  if (!start && !end) return "—";
  const fmt = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}
