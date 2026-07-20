import { query, type QueryValue } from "@/lib/db";

export type AnalyticsExportFormat = "csv" | "json";

export type AnalyticsExportInput = {
  customerUid: string;
  productUid?: string;
  from?: string;
  to?: string;
  event?: string;
  format?: AnalyticsExportFormat;
};

export type AnalyticsExportRow = {
  id: string;
  customer_uid: string;
  product_uid: string | null;
  session_id: string | null;
  event: string;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  screen_width: number | null;
  screen_height: number | null;
  referrer: string | null;
  url: string | null;
  created_at: string;
};

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: AnalyticsExportRow[]) {
  const headers: Array<keyof AnalyticsExportRow> = [
    "id",
    "customer_uid",
    "product_uid",
    "session_id",
    "event",
    "device",
    "browser",
    "os",
    "country",
    "city",
    "language",
    "screen_width",
    "screen_height",
    "referrer",
    "url",
    "created_at",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(row[key])).join(","));
  }

  return lines.join("\n");
}

export async function getAnalyticsExportRows(input: AnalyticsExportInput) {
  const where: string[] = ["customer_uid = ?"];
  const values: QueryValue[] = [input.customerUid];

  if (input.productUid) {
    where.push("product_uid = ?");
    values.push(input.productUid);
  }

  if (input.event) {
    where.push("event = ?");
    values.push(input.event);
  }

  if (input.from) {
    where.push("created_at >= ?");
    values.push(input.from);
  }

  if (input.to) {
    where.push("created_at <= ?");
    values.push(input.to);
  }

  return query<AnalyticsExportRow>(
    `
    SELECT
      id,
      customer_uid,
      product_uid,
      session_id,
      event,
      device,
      browser,
      os,
      country,
      city,
      language,
      screen_width,
      screen_height,
      referrer,
      url,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM analytics_events
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT 5000
    `,
    values,
  );
}
