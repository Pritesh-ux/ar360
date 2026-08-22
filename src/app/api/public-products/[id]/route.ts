import { NextResponse } from "next/server";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import fs from "fs/promises";
import path from "path";
import { resolveStorageRoot } from "@/lib/storage/paths";
import { ensureProductSchema, query } from "@/lib/db";
import { getProductFolder } from "@/lib/localCustomerStorage";
import { normalizeScopedId } from "@/lib/customerIsolation";
import { checkArEntitlement, checkViewerEntitlement, planAllowsProductContact } from "@/lib/billing/plan-enforcement";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";
import { toProtectedAssetUrl } from "@/lib/billing/asset-url";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewerBranding } from "@/lib/enterprise/branding.service";
import { parseLogoDesign, type LogoDesign } from "@/lib/branding/logo-design";
import { getWorkspaceContactSettings } from "@/lib/viewer-contact/workspace-settings";
import { readProductContactOverride, resolveViewerContact } from "@/lib/viewer-contact/resolve";
import { applyControlledRuntimeToProduct } from "@/lib/platform-versioning/apply-versioned-runtime";

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

/** Fill modelBytes / arModelUrl from disk when product.json is missing them. */
async function enrichModelAssetMeta(product: Record<string, any>) {
  const customerUid = String(product.customerUid || "");
  const productUid = String(product.productUid || product.id || "");
  if (!customerUid || !productUid) return product;

  const folder = getProductFolder(customerUid, productUid);
  const next = { ...product };

  if (!(Number(next.modelBytes) > 0)) {
    try {
      const st = await fs.stat(path.join(folder, "model.glb"));
      if (st.isFile() && st.size > 0) next.modelBytes = st.size;
    } catch {
      // optional
    }
  }

  if (!next.arModelUrl) {
    try {
      const st = await fs.stat(path.join(folder, "model.ar.glb"));
      if (st.isFile() && st.size > 0) {
        const modelUrl = String(next.modelUrl || "");
        if (modelUrl.includes("/api/assets/") && /model\.glb/i.test(modelUrl)) {
          next.arModelUrl = modelUrl.replace(/model\.glb/i, "model.ar.glb");
        } else if (next.publicFolder) {
          next.arModelUrl = `${String(next.publicFolder).replace(/\/$/, "")}/model.ar.glb`;
        }
      }
    } catch {
      // optional
    }
  }

  if (!next.usdzUrl) {
    try {
      const st = await fs.stat(path.join(folder, "model.usdz"));
      if (st.isFile() && st.size > 0) {
        const modelUrl = String(next.modelUrl || "");
        if (modelUrl.includes("/api/assets/") && /model\.glb/i.test(modelUrl)) {
          next.usdzUrl = modelUrl.replace(/model\.glb/i, "model.usdz");
        } else if (next.publicFolder) {
          next.usdzUrl = `${String(next.publicFolder).replace(/\/$/, "")}/model.usdz`;
        }
      }
    } catch {
      // optional
    }
  }

  return next;
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

const MATERIAL_TEXTURE_FIELDS = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "emissiveTexture",
  "occlusionTexture",
  "bumpTexture",
] as const;

function normalizeMaterialSettingUrls(
  setting: Record<string, any> | null | undefined,
  origin = "",
): Record<string, any> | null | undefined {
  if (!setting || typeof setting !== "object") return setting;
  const next: Record<string, any> = { ...setting };
  for (const field of MATERIAL_TEXTURE_FIELDS) {
    const raw = next[field];
    if (typeof raw === "string" && raw.trim() && !raw.startsWith("data:") && !raw.startsWith("blob:") && raw !== "__clear__") {
      next[field] = withRequestOrigin(raw, origin);
    }
  }
  if (next.logoLayer && typeof next.logoLayer === "object") {
    const image = next.logoLayer.image;
    if (typeof image === "string" && image.trim() && !image.startsWith("data:") && !image.startsWith("blob:")) {
      next.logoLayer = {
        ...next.logoLayer,
        image: withRequestOrigin(image, origin),
      };
    }
  }
  return next;
}

function normalizeMaterialSettingsMap(
  settings: Record<string, any> | null | undefined,
  origin = "",
) {
  if (!settings || typeof settings !== "object") return settings;
  const next: Record<string, any> = {};
  for (const [key, value] of Object.entries(settings)) {
    next[key] = normalizeMaterialSettingUrls(value as Record<string, any>, origin);
  }
  return next;
}

function normalizeVariantsUrls(variants: any, origin = "") {
  if (!Array.isArray(variants)) return variants;
  return variants.map((variant) => {
    if (!variant || typeof variant !== "object") return variant;
    const next = { ...variant };
    if (next.materialSettings) {
      next.materialSettings = normalizeMaterialSettingsMap(next.materialSettings, origin);
    }
    for (const field of MATERIAL_TEXTURE_FIELDS) {
      const raw = next[field];
      if (typeof raw === "string" && raw.trim() && !raw.startsWith("data:") && !raw.startsWith("blob:")) {
        next[field] = withRequestOrigin(raw, origin);
      }
    }
    if (typeof next.poster === "string" && next.poster.trim()) {
      next.poster = withRequestOrigin(next.poster, origin);
    }
    return next;
  });
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
    arModelUrl: product.arModelUrl
      ? normalizeAssetUrl(product.arModelUrl, normalizedPublicFolder, "model.ar.glb", origin)
      : undefined,
    usdzUrl: product.usdzUrl
      ? normalizeAssetUrl(product.usdzUrl, normalizedPublicFolder, "model.usdz", origin)
      : undefined,
    modelBytes:
      Number.isFinite(Number(product.modelBytes)) && Number(product.modelBytes) > 0
        ? Number(product.modelBytes)
        : undefined,
    poster: normalizeAssetUrl(product.poster, normalizedPublicFolder, "poster.png", origin),
    thumbnailUrl: normalizeAssetUrl(product.thumbnailUrl, normalizedPublicFolder, "thumbnail.png", origin),
    qrUrl: normalizeAssetUrl(product.qrUrl, normalizedPublicFolder, "qr.png", origin),
    materialSettings: normalizeMaterialSettingsMap(product.materialSettings, origin),
    variants: normalizeVariantsUrls(product.variants, origin),
  };

  if (normalized.settings && typeof normalized.settings === "object") {
    normalized.settings = {
      ...normalized.settings,
      materialSettings: normalizeMaterialSettingsMap(
        (normalized.settings as { materialSettings?: Record<string, any> }).materialSettings,
        origin,
      ),
    };
  }

  if (Array.isArray(normalized.logoDecals)) {
    normalized.logoDecals = normalized.logoDecals.map((decal: any) => {
      if (!decal || typeof decal !== "object") return decal;
      if (typeof decal.image === "string" && decal.image.trim() && !decal.image.startsWith("data:")) {
        return { ...decal, image: withRequestOrigin(decal.image, origin) };
      }
      return decal;
    });
  }

  if (!normalized.arModelUrl) delete normalized.arModelUrl;
  if (!normalized.usdzUrl) delete normalized.usdzUrl;

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
        AND deleted_at IS NULL
      LIMIT 1`,
    [id, id, id],
  ).catch(() => []);

  const row = rows[0];
  if (!row?.customer_uid) return null;

  const json = await readJson(path.join(getProductFolder(row.customer_uid, row.id), "product.json"));
  const baseProduct = rowToPublicProduct(row, origin);

  if (json && isPublished(json)) {
    const merged = normalizeProductPayload({
      ...baseProduct,
      ...json,
      customerUid: row.customer_uid,
      productUid: row.id,
      id: row.id,
    }, origin);

    // Prefer non-empty MySQL hotspots when disk has [] / missing (stale product.json wipe).
    const mysqlHotspots = Array.isArray(baseProduct.hotspots) ? baseProduct.hotspots : [];
    const diskHotspots = Array.isArray((merged as { hotspots?: unknown }).hotspots)
      ? ((merged as { hotspots: unknown[] }).hotspots)
      : [];
    if (diskHotspots.length === 0 && mysqlHotspots.length > 0) {
      (merged as { hotspots: unknown }).hotspots = mysqlHotspots;
    }

    // Prefer MySQL materials when disk wiped them during a failed/partial save.
    const mysqlMaterials = (baseProduct as { materialSettings?: Record<string, unknown> }).materialSettings;
    const diskMaterials = (merged as { materialSettings?: Record<string, unknown> }).materialSettings;
    const diskMaterialCount = diskMaterials ? Object.keys(diskMaterials).length : 0;
    const mysqlMaterialCount = mysqlMaterials ? Object.keys(mysqlMaterials).length : 0;
    if (diskMaterialCount === 0 && mysqlMaterialCount > 0) {
      (merged as { materialSettings?: Record<string, unknown> }).materialSettings = mysqlMaterials;
    }

    // Prefer a non-default background from whichever source actually has one.
    const diskBg = String((merged as { backgroundColor?: string }).backgroundColor || "");
    const mysqlBg = String((baseProduct as { backgroundColor?: string }).backgroundColor || "");
    if ((!diskBg || diskBg === "#ffffff" || diskBg === "#F0F2F5") && mysqlBg && mysqlBg !== diskBg) {
      (merged as { backgroundColor?: string }).backgroundColor = mysqlBg;
    }

    if ((merged as { useSkybox?: boolean }).useSkybox == null && (baseProduct as any).useSkybox != null) {
      (merged as { useSkybox?: boolean }).useSkybox = (baseProduct as any).useSkybox;
    }

    // Flatten settings → top-level so ViewerRuntime / getViewerSettings always see them.
    const settingsObj =
      (merged as { settings?: Record<string, unknown> }).settings &&
      typeof (merged as { settings?: unknown }).settings === "object"
        ? ((merged as { settings: Record<string, unknown> }).settings)
        : {};
    for (const key of [
      "backgroundColor",
      "backgroundType",
      "transparent",
      "useSkybox",
      "environmentImage",
      "environmentTint",
      "environmentSaturation",
      "exposure",
      "cameraOrbit",
      "cameraTarget",
      "fov",
      "materialSettings",
      "ctaEnabled",
      "ctaType",
      "ctaLabel",
      "ctaUrl",
      "contactUseCustom",
      "contactEnquireEnabled",
      "contactWhatsappEnabled",
      "contactWhatsappNumber",
      "contactEnquireLabel",
      "contactWhatsappLabel",
    ] as const) {
      const current = (merged as Record<string, unknown>)[key];
      if ((current === undefined || current === null || current === "") && settingsObj[key] != null) {
        (merged as Record<string, unknown>)[key] = settingsObj[key];
      }
    }

    return merged;
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
  ).catch((err) => {
    console.error("[public-products] billing entitlement query failed", err);
    return null;
  });

  if (billingRows == null) {
    return { allowed: false, reason: "This AR experience is temporarily unavailable." };
  }

  const billing = billingRows[0];
  if (!billing) {
    return { allowed: false, reason: "This AR experience is temporarily unavailable." };
  }

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

async function applyWorkspaceBranding(
  product: Record<string, any>,
  clientUid?: string | null,
) {
  // Always scope branding to the product owner — never another customer's workspace.
  const customerUid = String(product.customerUid || "").trim();
  if (!customerUid) return product;

  try {
    const plan = await resolveCustomerPlanLimits(customerUid);
    const ownerLogo =
      product.brandLogoUrl ||
      product.companyLogoUrl ||
      product.brandLogo ||
      product.companyLogo ||
      product.logoUrl ||
      undefined;

    if (!plan.allowCustomBranding) {
      // Still return owner product logos only (no platform/other-client logo injection).
      return {
        ...product,
        customerUid,
        brandLogoUrl: ownerLogo || undefined,
        brandLogo: ownerLogo || product.brandLogo || undefined,
      };
    }

    const branding = await getViewerBranding(customerUid);
    let brandName = branding.brandName?.trim() || product.brandName || undefined;
    let brandLogoUrl = branding.logoUrl || ownerLogo || undefined;
    let brandColor = branding.brandColor || product.enterpriseBrandColor;
    const viewerTagline = branding.viewerTagline || undefined;
    let poweredByLabel = String(branding.poweredByLabel || "").trim() || null;
    let logoDesign: LogoDesign | undefined;

    const scopedClient = String(clientUid || "").trim();
    if (scopedClient) {
      const clients = await query<{
        logo_url: string | null;
        company_name: string | null;
        viewer_title: string | null;
        brand_primary: string | null;
        powered_by_label?: string | null;
        branding_json?: unknown;
        name: string;
        customer_uid: string;
        status: string;
      }>(
        `SELECT logo_url, company_name, viewer_title, brand_primary, powered_by_label, branding_json, name, customer_uid, status
           FROM clients
          WHERE client_uid = ? AND customer_uid = ?
          LIMIT 1`,
        [scopedClient, customerUid],
      ).catch(() => []);
      const client = clients[0];
      if (client && String(client.status || "").toLowerCase() === "active") {
        // Client branding overrides workspace for this catalog context.
        brandLogoUrl = client.logo_url || brandLogoUrl;
        brandName =
          String(client.viewer_title || "").trim() ||
          String(client.company_name || "").trim() ||
          brandName ||
          client.name;
        brandColor = client.brand_primary || brandColor;
        const clientPowered = String(client.powered_by_label || "").trim();
        if (clientPowered) poweredByLabel = clientPowered;
        logoDesign = parseLogoDesign(client.branding_json);
      }
    }

    return {
      ...product,
      customerUid,
      brandName,
      brandLogoUrl,
      brandLogo: brandLogoUrl || undefined,
      logoDesign,
      enterpriseBrandColor: brandColor || product.enterpriseBrandColor,
      enterpriseAccentColor: branding.accentColor || product.enterpriseAccentColor,
      viewerWatermark: Boolean(branding.viewerWatermark),
      removeBranding: Boolean(branding.removeBranding),
      customViewerTheme: branding.customViewerTheme || product.customViewerTheme || "default",
      viewerTagline,
      ...(branding.ctaLabel?.trim()
        ? { ctaLabel: branding.ctaLabel.trim() }
        : {}),
      brandWebsiteUrl: branding.websiteUrl || undefined,
      loadingMessage: branding.loadingMessage || undefined,
      buttonStyle: branding.buttonStyle || "filled",
      headerStyle: branding.headerStyle || "glass",
      viewerFont: branding.viewerFont || "system",
      faviconUrl: branding.faviconUrl || undefined,
      showProductTitle: branding.showProductTitle !== false,
      hideInteractionHint: Boolean(branding.hideInteractionHint),
      poweredByLabel,
    };
  } catch {
    return { ...product, customerUid };
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
  // Disk-only products must never be public — deleted DB rows used to stay viewable via leftover folders.
  const product = await findPublishedProductInDb(id, requestOrigin);
  const source = product ? "db" : "none";

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

  const clientUid = new URL(req.url).searchParams.get("client");
  const brandedProduct = await applyWorkspaceBranding(
    await enrichModelAssetMeta(product),
    clientUid,
  );
  // Keep legacy brandLogo field in sync for embed / share clients.
  if (brandedProduct.brandLogoUrl && !brandedProduct.brandLogo) {
    brandedProduct.brandLogo = brandedProduct.brandLogoUrl;
  }

  const ownerPlan = await resolveCustomerPlanLimits(String(brandedProduct.customerUid || "")).catch(() => null);
  const arAllowed = ownerPlan
    ? checkArEntitlement(ownerPlan, {
        productsUsed: 0,
        storageUsedMb: 0,
      }).allowed
    : true;

  const contactWorkspace = brandedProduct.customerUid
    ? await getWorkspaceContactSettings(String(brandedProduct.customerUid)).catch(() => null)
    : null;
  let clientPhone: string | null = null;
  const scopedClient = String(clientUid || "").trim();
  if (scopedClient && brandedProduct.customerUid) {
    const clientRows = await query<{ phone: string | null }>(
      `SELECT phone FROM clients
        WHERE client_uid = ? AND customer_uid = ?
          AND LOWER(COALESCE(status, 'active')) = 'active'
        LIMIT 1`,
      [scopedClient, String(brandedProduct.customerUid)],
    ).catch(() => []);
    clientPhone = clientRows[0]?.phone || null;
  }
  const viewerContact = resolveViewerContact(
    contactWorkspace?.settings,
    readProductContactOverride(brandedProduct as Record<string, unknown>),
    {
      planAllowed: ownerPlan ? planAllowsProductContact(ownerPlan) : false,
      clientPhone,
    },
  );

  const payload = normalizeProductPayload(
    {
      ...brandedProduct,
      allowAr: arAllowed,
      viewerContact,
    },
    requestOrigin,
  );

  // Phase 4: default LEGACY. VERSIONED overlay only for explicit canary products.
  // Pointer existence alone never switches runtime. Failures fall back to legacy.
  const { product: runtimeProduct } = await applyControlledRuntimeToProduct(
    payload as Record<string, unknown>,
  );

  return jsonResponse({
    product: normalizeProductPayload(runtimeProduct, requestOrigin),
    source,
  });
}
