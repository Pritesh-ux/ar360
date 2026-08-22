import { query } from "@/lib/db";
import { toProtectedAssetUrl } from "@/lib/billing/asset-url";
import { parseLogoDesign } from "@/lib/branding/logo-design";
import { isClientLinkActive } from "@/lib/user-panel/client-plan";
import type { ClientCatalogProduct, ClientCatalogResult } from "@/lib/user-panel/client-catalog-types";

export type { ClientCatalogProduct, ClientCatalogResult };

function parseVariantsJson(raw: unknown): Array<{ id?: string; name?: string; poster?: string }> {
  if (Array.isArray(raw)) return raw as Array<{ id?: string; name?: string; poster?: string }>;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeAsset(value: string | null | undefined, origin = ""): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Prefer relative /api/assets/... URLs so public Viewer works on the real host
  // (api request origin is often http://127.0.0.1 behind nginx → ERR_ADDRESS_INVALID).
  const protectedUrl = toProtectedAssetUrl(raw, "");
  if (protectedUrl) return protectedUrl;
  if (origin && raw.startsWith("/") && !raw.startsWith("//")) {
    return `${origin.replace(/\/$/, "")}${raw}`;
  }
  return raw;
}

/**
 * Public catalog of products assigned to a client when viewer_catalog_enabled is on.
 * Soft mode: returns enabled:false for missing/disabled clients (UI hides sidebar).
 */
export async function getPublicClientCatalog(
  clientUidRaw: string,
  origin = "",
): Promise<ClientCatalogResult | null> {
  const clientUid = String(clientUidRaw || "").trim();
  if (!clientUid) return null;

  let clients = await query<{
    client_uid: string;
    name: string;
    status: string;
    viewer_catalog_enabled: number | boolean;
    customer_uid: string;
    logo_url?: string | null;
    brand_primary?: string | null;
    branding_json?: unknown;
    plan_starts_at?: string | Date | null;
    plan_expires_at?: string | Date | null;
    link_expires_at?: string | Date | null;
  }>(
    `SELECT client_uid, name, status, customer_uid,
            COALESCE(viewer_catalog_enabled, 0) AS viewer_catalog_enabled,
            logo_url, brand_primary, branding_json,
            plan_starts_at, plan_expires_at, link_expires_at
       FROM clients
      WHERE client_uid = ?
      LIMIT 1`,
    [clientUid],
  ).catch(() => []);

  if (!clients[0]) {
    clients = await query(
      `SELECT client_uid, name, status, customer_uid,
              COALESCE(viewer_catalog_enabled, 0) AS viewer_catalog_enabled,
              logo_url, brand_primary, branding_json
         FROM clients
        WHERE client_uid = ?
        LIMIT 1`,
      [clientUid],
    ).catch(() => []);
  }

  const client = clients[0];
  if (!client) return null;

  // Active clients always get the catalog rail when products are assigned.
  // viewer_catalog_enabled remains as an explicit opt-out (0) if ever needed later;
  // default / missing / 1 all mean enabled.
  const catalogFlag = client.viewer_catalog_enabled;
  const explicitlyDisabled =
    catalogFlag === 0 || catalogFlag === false || String(catalogFlag) === "0";
  const linkActive = isClientLinkActive(client);
  const enabled =
    String(client.status || "").toLowerCase() === "active" &&
    !explicitlyDisabled &&
    linkActive;

  if (!enabled) {
    return {
      enabled: false,
      linkExpired: !linkActive && String(client.status || "").toLowerCase() === "active",
      clientUid: client.client_uid,
      clientName: client.name,
      logoUrl: normalizeAsset(client.logo_url, origin),
      brandPrimary: client.brand_primary || undefined,
      logoDesign: parseLogoDesign(client.branding_json),
      products: [],
    };
  }

  const productIds = await query<{ resource_id: string }>(
    `SELECT resource_id FROM client_resources
      WHERE client_uid = ?
        AND resource_type = 'product'
        AND COALESCE(viewer_active, 1) = 1
      ORDER BY id ASC`,
    [clientUid],
  ).catch((): { resource_id: string }[] => []);

  if (productIds.length === 0) {
    return {
      enabled: true,
      clientUid: client.client_uid,
      clientName: client.name,
      logoUrl: normalizeAsset(client.logo_url, origin),
      brandPrimary: client.brand_primary || undefined,
      logoDesign: parseLogoDesign(client.branding_json),
      products: [],
    };
  }

  const ids = productIds.map((r) => String(r.resource_id).trim()).filter(Boolean);
  type ProductRow = {
    id: string;
    title: string;
    poster: string | null;
    thumbnail_url: string | null;
    variants: unknown;
  };
  const rows = await query<ProductRow>(
    `SELECT id, title, poster, thumbnail_url, variants
       FROM products
      WHERE customer_uid = ?
        AND deleted_at IS NULL
        AND LOWER(status) IN ('published', 'active')
        AND id IN (${ids.map(() => "?").join(",")})`,
    [client.customer_uid, ...ids],
  ).catch((): ProductRow[] => []);

  const byId = new Map(rows.map((row) => [row.id, row]));
  const products: ClientCatalogProduct[] = [];

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    const variantsRaw = parseVariantsJson(row.variants);
    const variants = variantsRaw
      .map((v) => ({
        id: String(v.id || "").trim(),
        name: String(v.name || "").trim() || "Variant",
        poster: normalizeAsset(v.poster, origin),
      }))
      .filter((v) => v.id);

    products.push({
      id: row.id,
      title: row.title || "Untitled",
      poster: normalizeAsset(row.poster, origin),
      thumbnailUrl: normalizeAsset(row.thumbnail_url, origin),
      variantCount: variants.length,
      variants: variants.slice(0, 6),
    });
  }

  return {
    enabled: true,
    clientUid: client.client_uid,
    clientName: client.name,
    logoUrl: normalizeAsset(client.logo_url, origin),
    brandPrimary: client.brand_primary || undefined,
    logoDesign: parseLogoDesign(client.branding_json),
    products,
  };
}
