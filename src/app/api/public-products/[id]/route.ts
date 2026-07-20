import { NextResponse } from "next/server";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import fs from "fs/promises";
import path from "path";
import { resolveStorageRoot } from "@/lib/storage/paths";
import { ensureProductSchema, query } from "@/lib/db";
import { getProductFolder } from "@/lib/localCustomerStorage";
import { normalizeScopedId } from "@/lib/customerIsolation";
import { checkViewerEntitlement } from "@/lib/billing/plan-enforcement";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";
import { toProtectedAssetUrl } from "@/lib/billing/asset-url";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewerBranding } from "@/lib/enterprise/branding.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PublicProductRow = {
  id: string;
  customer_uid: string | null;
  title: string;
  category: string | null;
  model_url: string | null;
  file_name: string | null;
  poster: string | null;
  thumbnail_url: string | null;
  qr_url: string | null;
  product_folder: string | null;
  status: string;
  views: number;
  public_id: string | null;
  viewer_slug: string | null;
  updated_at?: Date | string | null;
  settings?: any;
  material_settings?: any;
  variants?: any;
  hotspots?: any;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

async function readJson(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return null;
  }
}

function isPublished(product: Record<string, any> | null | undefined) {
  const status = String(product?.status || "").toLowerCase();
  return status === "published" || status === "active";
}

function normalizePublicPath(value?: string | null) {
  if (!value) return "";

  const normalized = String(value)
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

  const publicIndex = normalized.toLowerCase().lastIndexOf("/public/");
  if (publicIndex >= 0) {
    return normalized.slice(publicIndex + "/public".length) || "";
  }

  const storageIndex = normalized.toLowerCase().lastIndexOf("/storage/");
  if (storageIndex >= 0) {
    return normalized.slice(storageIndex) || "";
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function isAbsoluteUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function isBrowserOnlyUrl(value: string) {
  return value.startsWith("blob:") || value.startsWith("data:");
}

function encodeFileName(fileName: string) {
  if (!fileName) return "";
  if (fileName.includes("%")) return fileName;
  return encodeURIComponent(fileName);
}

function getRequestOrigin(req?: Request) {
  if (!req) return "";
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

function withRequestOrigin(url: string, origin = "") {
  if (!url) return "";
  if (isBrowserOnlyUrl(url)) return url;

  if (isAbsoluteUrl(url)) {
    try {
      const parsed = new URL(url);
      if (origin && ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname)) {
        const local = `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        return toProtectedAssetUrl(local, origin);
      }
      return toProtectedAssetUrl(url, origin);
    } catch {
      return url;
    }
  }

  const relative = url.startsWith("/") ? url : `/${url}`;
  if (!origin) return toProtectedAssetUrl(relative);
  return toProtectedAssetUrl(`${origin}${relative}`, origin);
}

function normalizeAssetUrl(value?: string | null, publicFolder = "", fallbackName = "", origin = "") {
  const raw = String(value || "").trim();

  if (raw && !isBrowserOnlyUrl(raw)) {
    if (isAbsoluteUrl(raw)) return withRequestOrigin(raw, origin);
    const normalized = normalizePublicPath(raw);
    return withRequestOrigin(normalized.startsWith("/") ? normalized : `/${normalized}`, origin);
  }

  if (!publicFolder || !fallbackName) return "";
  return withRequestOrigin(`${publicFolder}/${fallbackName}`, origin);
}

function normalizeProductPayload(product: Record<string, any>, origin = ""): Record<string, any> {
  if (!product || typeof product !== "object") return product;

  const normalizedPublicFolder = normalizePublicPath(
    product.publicFolder || product.productFolder || product.folderPath,
  );
  const fileName = typeof product.fileName === "string" ? product.fileName : "";

  const normalized: Record<string, any> = {
    ...product,
    id: product.id || product.productUid,
    productUid: product.productUid || product.id,
    category: product.category || "Uncategorized",
    status: product.status || "Published",
    publicFolder: normalizedPublicFolder,
    modelUrl: normalizeAssetUrl(
      product.modelUrl,
      normalizedPublicFolder,
      fileName ? encodeFileName(fileName) : "model.glb",
      origin,
    ),
    poster: normalizeAssetUrl(product.poster, normalizedPublicFolder, "poster.png", origin),
    thumbnailUrl: normalizeAssetUrl(product.thumbnailUrl, normalizedPublicFolder, "thumbnail.png", origin),
    qrUrl: normalizeAssetUrl(product.qrUrl, normalizedPublicFolder, "qr.png", origin),
  };

  delete normalized.folderPath;
  delete normalized.productFolder;

  return normalized;
}


function parseJsonColumn(val: any) {
  if (!val) return undefined;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

function rowToPublicProduct(row: PublicProductRow, origin = "") {
  return normalizeProductPayload({
    id: row.id,
    productUid: row.id,
    customerUid: row.customer_uid ?? "",
    title: row.title,
    category: row.category ?? "Uncategorized",
    modelUrl: row.model_url ?? "",
    fileName: row.file_name ?? "",
    poster: row.poster ?? "",
    thumbnailUrl: row.thumbnail_url ?? "",
    qrUrl: row.qr_url ?? "",
    publicFolder: row.product_folder ?? "",
    status: row.status,
    views: row.views,
    publicId: row.public_id ?? undefined,
    viewerSlug: row.viewer_slug ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    settings: parseJsonColumn((row as any).settings),
    materialSettings: parseJsonColumn((row as any).material_settings),
    variants: parseJsonColumn((row as any).variants),
    hotspots: parseJsonColumn((row as any).hotspots),
  }, origin);
}

async function findPublishedProductInDb(id: string, origin = "") {
  await ensureProductSchema();
  const rows = await query<PublicProductRow>(
    `SELECT id, customer_uid, title, category, model_url, file_name, poster,
            thumbnail_url, qr_url, product_folder, status, views, public_id, viewer_slug,
            settings, material_settings, variants, hotspots, updated_at
       FROM products
      WHERE (id = ? OR public_id = ? OR viewer_slug = ?)
        AND LOWER(status) IN ('published', 'active')
      LIMIT 1`,
    [id, id, id],
  ).catch(() => []);

  const row = rows[0];
  if (!row?.customer_uid) return null;

  const json = await readJson(path.join(getProductFolder(row.customer_uid, row.id), "product.json"));
  const baseProduct = rowToPublicProduct(row, origin);

  if (json && isPublished(json)) {
    return normalizeProductPayload({
      ...baseProduct,
      ...json,
      customerUid: row.customer_uid,
      productUid: row.id,
      id: row.id,
    }, origin);
  }

  return baseProduct;
}

async function findPublishedProductOnDisk(productId: string, origin = "") {
  const storageRoot = resolveStorageRoot();

  try {
    const customers = await fs.readdir(storageRoot, { withFileTypes: true });

    for (const customer of customers) {
      if (!customer.isDirectory() || !normalizeScopedId(customer.name)) continue;

      const productsRoot = path.join(storageRoot, customer.name, "Products");
      const products = await fs.readdir(productsRoot, { withFileTypes: true }).catch(() => []);

      for (const productFolder of products) {
        if (!productFolder.isDirectory() || !normalizeScopedId(productFolder.name)) continue;

        const candidate = path.join(productsRoot, productFolder.name, "product.json");
        const product = normalizeProductPayload((await readJson(candidate)) || {}, origin);

        if (
          product &&
          isPublished(product) &&
          (product.id === productId ||
            product.productUid === productId ||
            product.publicId === productId ||
            product.viewerSlug === productId ||
            productFolder.name === productId)
        ) {
          return normalizeProductPayload({
            ...product,
            customerUid: customer.name,
            productUid: productFolder.name,
            id: productFolder.name,
          }, origin);
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function checkProductViewerEntitlement(product: Record<string, any>) {
  const customerUid = product.customerUid;
  if (!customerUid) return { allowed: true, reason: "No customer owner" };

  const sub = await checkSubscription(customerUid);
  if (!sub.active) {
    return { allowed: false, reason: "This AR experience is temporarily unavailable." };
  }

  // Also enforce trial checks or standard resource limit validations
  const billingRows = await query<any>(
    `SELECT c.customer_uid,
            (SELECT COUNT(*) FROM products p WHERE p.customer_uid = c.customer_uid) AS products_used,
            COALESCE((SELECT SUM(size_bytes) FROM product_assets a WHERE a.customer_uid = c.customer_uid), 0) / 1024 / 1024 AS storage_used_mb
       FROM customers c
      WHERE c.customer_uid = ?
      LIMIT 1`,
    [customerUid],
  ).catch(() => []);

  const billing = billingRows[0];
  if (!billing) return { allowed: true };

  const plan = await resolveCustomerPlanLimits(customerUid);
  const usage = {
    productsUsed: Number(billing.products_used || 0),
    storageUsedMb: Number(billing.storage_used_mb || 0),
    bandwidthUsedGb: await getCustomerBandwidthUsedGb(customerUid),
    trialStartedAt: sub.expiresAt ? new Date(new Date(sub.expiresAt).getTime() - 24 * 60 * 60 * 1000).toISOString() : null,
    trialEndsAt: sub.expiresAt,
    subscriptionStatus: sub.reason === "active" ? "active" : "trialing",
  };

  return checkViewerEntitlement(plan, usage);
}

async function incrementProductView(product: Record<string, any>) {
  const productId = product.productUid || product.id;
  if (!productId) return;

  await query("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = ?", [productId]).catch(() => undefined);
}

async function applyWorkspaceBranding(product: Record<string, any>) {
  const customerUid = String(product.customerUid || "");
  if (!customerUid) return product;

  try {
    const plan = await resolveCustomerPlanLimits(customerUid);
    if (!plan.allowCustomBranding) return product;

    const branding = await getViewerBranding(customerUid);
    const brandName = branding.brandName?.trim() || product.brandName || undefined;
    const brandLogoUrl =
      branding.logoUrl ||
      product.brandLogoUrl ||
      product.companyLogoUrl ||
      product.brandLogo ||
      product.companyLogo ||
      product.logoUrl ||
      undefined;

    return {
      ...product,
      // Workspace branding wins when set — otherwise product editor values remain.
      brandName,
      brandLogoUrl,
      brandLogo: brandLogoUrl || product.brandLogo,
      enterpriseBrandColor: branding.brandColor || product.enterpriseBrandColor,
      enterpriseAccentColor: branding.accentColor || product.enterpriseAccentColor,
      viewerWatermark: Boolean(branding.viewerWatermark),
      removeBranding: Boolean(branding.removeBranding),
      customViewerTheme: branding.customViewerTheme || product.customViewerTheme || "default",
      viewerTagline: branding.viewerTagline || undefined,
      ctaLabel: branding.ctaLabel || undefined,
      brandWebsiteUrl: branding.websiteUrl || undefined,
      loadingMessage: branding.loadingMessage || undefined,
      buttonStyle: branding.buttonStyle || "filled",
      headerStyle: branding.headerStyle || "glass",
      viewerFont: branding.viewerFont || "system",
      faviconUrl: branding.faviconUrl || undefined,
      showProductTitle: branding.showProductTitle !== false,
      hideInteractionHint: Boolean(branding.hideInteractionHint),
    };
  } catch {
    return product;
  }
}

export async function GET(req: Request, context: RouteContext) {
  const limited = await enforceRateLimit(req, { scope: "public-products:get", limit: 60, windowSec: 60 });
  if (limited instanceof Response) return limited;

  const params = await context.params;
  const id = normalizeScopedId(params.id);

  if (!id) {
    return jsonResponse({ error: "Product id is required." }, 400);
  }

  const requestOrigin = getRequestOrigin(req);
  const dbProduct = await findPublishedProductInDb(id, requestOrigin);
  const diskProduct = dbProduct ? null : await findPublishedProductOnDisk(id, requestOrigin);
  const product = dbProduct || diskProduct;
  const source = dbProduct ? "db" : diskProduct ? "disk" : "none";

  if (!product) {
    return jsonResponse({ error: "Published product not found.", source }, 404);
  }

  if (!product.modelUrl && !product.publicFolder) {
    return jsonResponse({ error: "Published product is missing a model URL.", source }, 404);
  }

  const entitlement = await checkProductViewerEntitlement(product);
  if (!entitlement.allowed) {
    return jsonResponse({ error: entitlement.reason || "This AR experience is temporarily unavailable.", source }, 403);
  }

  void incrementProductView(product);

  const brandedProduct = await applyWorkspaceBranding(product);
  // Keep legacy brandLogo field in sync for embed / share clients.
  if (brandedProduct.brandLogoUrl && !brandedProduct.brandLogo) {
    brandedProduct.brandLogo = brandedProduct.brandLogoUrl;
  }
  return jsonResponse({ product: normalizeProductPayload(brandedProduct, requestOrigin), source });
}
