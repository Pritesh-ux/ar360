import { query, type QueryValue } from "@/lib/db";
import type { AnalyticsFilter, TopCity, TopCountry } from "./analytics.types";

function buildWhere(
  filter: AnalyticsFilter,
  tableAlias = "e",
): { clause: string; values: QueryValue[] } {
  const conditions: string[] = [];
  const values: QueryValue[] = [];

  if (filter.customerUid) {
    conditions.push(`${tableAlias}.customer_uid = ?`);
    values.push(filter.customerUid);
  }
  if (filter.productUid) {
    conditions.push(`${tableAlias}.product_uid = ?`);
    values.push(filter.productUid);
  }
  if (filter.from) {
    conditions.push(`${tableAlias}.created_at >= ?`);
    values.push(`${filter.from} 00:00:00`);
  }
  if (filter.to) {
    conditions.push(`${tableAlias}.created_at <= ?`);
    values.push(`${filter.to} 23:59:59`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

export async function getTopCountries(filter: AnalyticsFilter, limit = 10): Promise<TopCountry[]> {
  const { clause, values } = buildWhere(filter);
  values.push(limit);

  const rows = await query<{ country: string; views: number }>(
    `SELECT COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS country, COUNT(DISTINCT session_id) AS views
     FROM analytics_events e ${clause}
     GROUP BY 1 ORDER BY views DESC LIMIT ?`,
    values,
  );

  const total = rows.reduce((s, r) => s + Number(r.views), 0);
  return rows.map((r) => ({
    country: r.country || "Unknown",
    views: Number(r.views),
    percent: total > 0 ? Math.round((Number(r.views) / total) * 1000) / 10 : 0,
  }));
}

export async function getTopCities(filter: AnalyticsFilter, limit = 15): Promise<TopCity[]> {
  const { clause, values } = buildWhere(filter);
  values.push(limit);

  const rows = await query<{ city: string; country: string; views: number }>(
    `SELECT
       COALESCE(NULLIF(TRIM(city), ''), 'Unknown') AS city,
       COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS country,
       COUNT(DISTINCT session_id) AS views
     FROM analytics_events e ${clause}
     GROUP BY 1, 2
     ORDER BY views DESC
     LIMIT ?`,
    values,
  );

  const total = rows.reduce((s, r) => s + Number(r.views), 0);
  return rows.map((r) => {
    const city = r.city || "Unknown";
    const country = r.country || "Unknown";
    const label =
      city === "Unknown"
        ? country === "Unknown"
          ? "Unknown"
          : `Unknown · ${country}`
        : country !== "Unknown"
          ? `${city}, ${country}`
          : city;
    return {
      city,
      country,
      label,
      views: Number(r.views),
      percent: total > 0 ? Math.round((Number(r.views) / total) * 1000) / 10 : 0,
    };
  });
}
