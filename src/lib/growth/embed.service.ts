import { query, type QueryValue } from "@/lib/db";
import { ensureProductSchema } from "@/lib/db";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import { parseBrowser, parseDevice } from "@/server/analytics/analytics.middleware";

export type EmbedConfigRecord = {
  id: number;
  productId: string;
  publicId: string | null;
  status: "active" | "inactive";
  allowedDomains: string[];
  viewCount: number;
  uniqueVisitors: number;
  lastViewAt: string | null;
  embedUrl: string;
  htmlSnippet: string;
  reactSnippet: string;
  nextSnippet: string;
  title: string;
  poster: string;
};

function buildSnippets(origin: string, publicId: string) {
  const src = `${origin}/embed/${encodeURIComponent(publicId)}`;
  const html = `<iframe src="${src}" title="AR360 3D Viewer" width="100%" height="480" style="border:0;border-radius:16px;" allow="xr-spatial-tracking; gyroscope; accelerometer; magnetometer; camera; fullscreen"></iframe>`;
  const react = `export function ProductEmbed() {\n  return (\n    <iframe\n      src="${src}"\n      title="AR360 3D Viewer"\n      width="100%"\n      height={480}\n      style={{ border: 0, borderRadius: 16 }}\n      allow="xr-spatial-tracking; gyroscope; accelerometer; magnetometer; camera; fullscreen"\n    />\n  );\n}`;
  const nextjs = `import ProductEmbed from "@/components/ProductEmbed";\n\n// components/ProductEmbed.tsx — paste the React snippet above\n\nexport default function Page() {\n  return <ProductEmbed />;\n}`;
  return { embedUrl: src, htmlSnippet: html, reactSnippet: react, nextSnippet: nextjs };
}

export async function ensureEmbedConfig(input: {
  customerUid: string;
  userId: number;
  productId: string;
  publicId: string;
  origin: string;
}) {
  await ensureProductSchema();
  await ensureUserPanelSchema();

  const existing = await query<{ id: number }>(
    `SELECT id FROM product_embed_configs WHERE product_id = ? AND customer_uid = ? LIMIT 1`,
    [input.productId, input.customerUid],
  );

  if (!existing.length) {
    await query(
      `INSERT INTO product_embed_configs (customer_uid, user_id, product_id, public_id, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [input.customerUid, input.userId, input.productId, input.publicId],
    );
  } else {
    // Preserve active/inactive — republish must not silently re-activate.
    await query(
      `UPDATE product_embed_configs SET public_id = ?, updated_at = NOW() WHERE product_id = ?`,
      [input.publicId, input.productId],
    );
  }
}

export async function listCustomerEmbeds(input: {
  customerUid: string;
  userId: number;
  origin: string;
  q?: string;
  productId?: string;
}) {
  await ensureUserPanelSchema();
  const params: QueryValue[] = [input.customerUid, input.userId];
  let where = `e.customer_uid = ? AND (e.user_id = ? OR e.user_id IS NULL) AND LOWER(p.status) IN ('published','active')`;
  if (input.q?.trim()) {
    where += " AND p.title LIKE ?";
    params.push(`%${input.q.trim()}%`);
  }
  if (input.productId?.trim()) {
    where += " AND e.product_id = ?";
    params.push(input.productId.trim());
  }

  const rows = await query<{
    id: number;
    product_id: string;
    public_id: string | null;
    status: string;
    allowed_domains_json: string | null;
    view_count: number;
    unique_visitors: number;
    last_view_at: string | null;
    title: string;
    poster: string | null;
    thumbnail_url: string | null;
  }>(
    `SELECT e.*, p.title, p.poster, p.thumbnail_url
     FROM product_embed_configs e
     INNER JOIN products p ON p.id = e.product_id
     WHERE ${where}
     ORDER BY e.updated_at DESC`,
    params,
  );

  return rows.map((row) => {
    const publicId = row.public_id || row.product_id;
    const snippets = buildSnippets(input.origin, publicId);
    let allowedDomains: string[] = [];
    try {
      allowedDomains = row.allowed_domains_json ? (JSON.parse(row.allowed_domains_json) as string[]) : [];
    } catch {
      allowedDomains = [];
    }
    return {
      id: row.id,
      productId: row.product_id,
      publicId,
      status: row.status as "active" | "inactive",
      allowedDomains,
      viewCount: Number(row.view_count || 0),
      uniqueVisitors: Number(row.unique_visitors || 0),
      lastViewAt: row.last_view_at,
      title: row.title,
      poster: row.poster ?? row.thumbnail_url ?? "",
      ...snippets,
    } satisfies EmbedConfigRecord;
  });
}

export async function updateEmbedConfig(input: {
  customerUid: string;
  userId: number;
  embedId: number;
  status?: "active" | "inactive";
  allowedDomains?: string[];
}) {
  const rows = await query<{ id: number }>(
    `SELECT id FROM product_embed_configs WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL) LIMIT 1`,
    [input.embedId, input.customerUid, input.userId],
  );
  if (!rows.length) return { error: "Embed config not found." as const };

  const sets: string[] = [];
  const params: QueryValue[] = [];
  if (input.status) { sets.push("status = ?"); params.push(input.status); }
  if (input.allowedDomains) { sets.push("allowed_domains_json = ?"); params.push(JSON.stringify(input.allowedDomains)); }
  if (!sets.length) return { error: "No changes." as const };

  await query(`UPDATE product_embed_configs SET ${sets.join(", ")}, updated_at = NOW() WHERE id = ?`, [...params, input.embedId]);
  return { success: true as const };
}

export async function trackEmbedView(input: {
  productId: string;
  sessionId: string;
  request: Request;
  referrerDomain?: string;
}) {
  const ua = input.request.headers.get("user-agent") ?? "";
  const device = parseDevice(ua);
  const browser = parseBrowser(ua);
  const country = input.request.headers.get("x-vercel-ip-country") ?? input.request.headers.get("cf-ipcountry") ?? "";

  const configs = await query<{ id: number; customer_uid: string; view_count: number }>(
    `SELECT id, customer_uid, view_count FROM product_embed_configs WHERE product_id = ? AND status = 'active' LIMIT 1`,
    [input.productId],
  );
  const config = configs[0];
  if (!config) return;

  const prior = await query<{ id: number }>(
    `SELECT id FROM embed_view_events WHERE embed_config_id = ? AND anonymous_session_id = ? LIMIT 1`,
    [config.id, input.sessionId],
  );
  const isUnique = prior.length === 0;

  await query(
    `UPDATE product_embed_configs SET view_count = view_count + 1, unique_visitors = unique_visitors + ?, last_view_at = NOW() WHERE id = ?`,
    [isUnique ? 1 : 0, config.id],
  );

  await query(
    `INSERT INTO embed_view_events (embed_config_id, customer_uid, product_id, anonymous_session_id, referrer_domain, device, browser, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [config.id, config.customer_uid, input.productId, input.sessionId, input.referrerDomain || "", device, browser, country],
  );
}

export async function getEmbedAnalytics(embedId: number, customerUid: string) {
  const rows = await query<{ view_count: number; unique_visitors: number }>(
    `SELECT view_count, unique_visitors FROM product_embed_configs WHERE id = ? AND customer_uid = ? LIMIT 1`,
    [embedId, customerUid],
  );
  if (!rows.length) return null;

  const [domains, devices, countries] = await Promise.all([
    query<{ referrer_domain: string; count: number }>(
      `SELECT referrer_domain, COUNT(*) AS count FROM embed_view_events WHERE embed_config_id = ? AND referrer_domain <> '' GROUP BY referrer_domain ORDER BY count DESC LIMIT 10`,
      [embedId],
    ),
    query<{ device: string; count: number }>(
      `SELECT device, COUNT(*) AS count FROM embed_view_events WHERE embed_config_id = ? GROUP BY device ORDER BY count DESC LIMIT 10`,
      [embedId],
    ),
    query<{ country: string; count: number }>(
      `SELECT country, COUNT(*) AS count FROM embed_view_events WHERE embed_config_id = ? AND country <> '' GROUP BY country ORDER BY count DESC LIMIT 10`,
      [embedId],
    ),
  ]);

  return {
    views: Number(rows[0].view_count || 0),
    uniqueVisitors: Number(rows[0].unique_visitors || 0),
    domains,
    devices,
    countries,
  };
}

export function isEmbedDomainAllowed(allowedDomains: string[], referrer: string) {
  if (!allowedDomains.length) return true;
  try {
    const host = referrer ? new URL(referrer).hostname : "";
    if (!host) return false;
    return allowedDomains.some((d) => {
      const domain = String(d || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
      if (!domain) return false;
      return host === domain || host.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}

/** Look up embed allowlist for a product (by product id or public_id). Empty list = allow all. */
export async function getEmbedAllowedDomainsForProduct(productKey: string): Promise<string[]> {
  await ensureUserPanelSchema();
  const key = String(productKey || "").trim();
  if (!key) return [];
  const rows = await query<{ allowed_domains_json: string | null }>(
    `SELECT allowed_domains_json FROM product_embed_configs
      WHERE (product_id = ? OR public_id = ?) AND status = 'active'
      LIMIT 1`,
    [key, key],
  );
  if (!rows[0]) return [];
  try {
    const parsed = rows[0].allowed_domains_json
      ? (JSON.parse(rows[0].allowed_domains_json) as string[])
      : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function getEmbedConfigStatus(productKey: string): Promise<"active" | "inactive" | null> {
  await ensureUserPanelSchema();
  const key = String(productKey || "").trim();
  if (!key) return null;
  const rows = await query<{ status: string }>(
    `SELECT status FROM product_embed_configs
      WHERE product_id = ? OR public_id = ?
      ORDER BY updated_at DESC
      LIMIT 1`,
    [key, key],
  );
  const status = String(rows[0]?.status || "").toLowerCase();
  if (status === "active" || status === "inactive") return status;
  return null;
}

export async function assertEmbedReferrerAllowed(productKey: string, referrer: string) {
  const status = await getEmbedConfigStatus(productKey);
  // Explicitly inactive embeds must not render for anyone.
  if (status === "inactive") return false;
  const allowed = await getEmbedAllowedDomainsForProduct(productKey);
  // No config row yet (legacy products) — allow. Active with empty allowlist — allow all.
  return isEmbedDomainAllowed(allowed, referrer);
}
