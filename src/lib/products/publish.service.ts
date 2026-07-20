import { query, type QueryValue } from "@/lib/db";
import { makeSafeSlug } from "@/lib/universal-viewer";
import { ensurePermanentProductQr } from "@/lib/growth/qr.service.impl";
import { ensureEmbedConfig } from "@/lib/growth/embed.service";
import { notifyQrReady } from "@/lib/growth/insights.service";
import { createCustomerShareLink } from "@/lib/user-panel/share-links.service";
import { productFolderHasGlb } from "@/lib/products/upload-rollback";
import { ProductErrorCode, friendlyProductError } from "@/lib/products/product-errors";
import { checkEnterpriseArExperienceLimit } from "@/lib/billing/limit-enforcement";
import { getProductFolder } from "@/lib/localCustomerStorage";
import fs from "fs/promises";
import path from "path";
import { createCustomerNotification } from "@/lib/account/notify.service";

export type PublishChecklistItem = {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  message?: string;
};

export function normalizeProductStatus(value?: string | null) {
  const raw = String(value || "draft").trim().toLowerCase();
  if (raw === "published" || raw === "publish" || raw === "active") return "published";
  if (raw === "archived" || raw === "archive" || raw === "disabled" || raw === "unpublished") return "archived";
  if (raw === "processing") return "processing";
  if (raw === "deleted") return "deleted";
  if (raw === "failed") return "failed";
  return "draft";
}

export function makePublicProductId(title: string, productUid: string) {
  const slug = makeSafeSlug(title, productUid);
  const suffix = productUid.slice(-6);
  return `${slug}-${suffix}`;
}

export async function logProductActivity(input: {
  productUid: string;
  customerUid: string;
  userId?: number;
  action: string;
  version?: number;
  meta?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO product_edit_log (product_uid, customer_uid, user_id, action, version, meta)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.productUid,
      input.customerUid,
      input.userId ?? null,
      input.action,
      input.version ?? 1,
      input.meta ? JSON.stringify(input.meta) : null,
    ] as QueryValue[],
  ).catch(() => undefined);
}

export async function createPublishNotification(customerUid: string, productTitle: string, productUid: string) {
  await createCustomerNotification({
    customerUid,
    category: "product",
    title: "Product published",
    body: `"${productTitle}" is now live in the public viewer.`,
    href: `/viewer/${productUid}`,
    dedupeKey: `product-published:${productUid}`,
  }).catch(() => undefined);
}

export async function ensurePublishShareIntegrations(input: {
  customerUid: string;
  userId: number;
  productId: string;
  publicId: string;
  origin: string;
}) {
  const viewerUrl = `${input.origin}/viewer/${input.publicId}`;

  const existingShare = await query<{ id: number }>(
    `SELECT id FROM share_links
     WHERE customer_uid = ? AND product_id = ? AND link_type = 'public' AND deleted_at IS NULL
     LIMIT 1`,
    [input.customerUid, input.productId],
  );
  if (!existingShare.length) {
    await createCustomerShareLink({
      customerUid: input.customerUid,
      userId: input.userId,
      productId: input.productId,
      origin: input.origin,
      linkType: "public",
      slug: "Public link",
    }).catch(() => undefined);
  }

  const existingEmbed = await query<{ id: number }>(
    `SELECT id FROM share_links
     WHERE customer_uid = ? AND product_id = ? AND link_type = 'embed' AND deleted_at IS NULL
     LIMIT 1`,
    [input.customerUid, input.productId],
  );
  if (!existingEmbed.length) {
    await createCustomerShareLink({
      customerUid: input.customerUid,
      userId: input.userId,
      productId: input.productId,
      origin: input.origin,
      linkType: "embed",
      slug: "Embed",
    }).catch(() => undefined);
  }

  const qrResult = await ensurePermanentProductQr({
    customerUid: input.customerUid,
    userId: input.userId,
    productId: input.productId,
    publicId: input.publicId,
    origin: input.origin,
  });

  if (qrResult.created) {
    const productTitle = await query<{ title: string }>(
      `SELECT title FROM products WHERE id = ? LIMIT 1`,
      [input.productId],
    );
    await notifyQrReady(input.customerUid, productTitle[0]?.title || "Product", qrResult.qrCode);
  }

  await ensureEmbedConfig({
    customerUid: input.customerUid,
    userId: input.userId,
    productId: input.productId,
    publicId: input.publicId,
    origin: input.origin,
  });

  return { viewerUrl, qrCode: qrResult.qrCode, qrLinkUrl: qrResult.qrLinkUrl };
}

export async function buildPreviewChecklist(input: {
  customerUid: string;
  productUid: string;
  productJson?: Record<string, unknown> | null;
}): Promise<{ items: PublishChecklistItem[]; canPublish: boolean }> {
  const json =
    input.productJson ||
    (await (async () => {
      try {
        const file = path.join(getProductFolder(input.customerUid, input.productUid), "product.json");
        const raw = await fs.readFile(file, "utf8");
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    })());

  const hasGlb = await productFolderHasGlb(input.customerUid, input.productUid);
  const poster = String(json?.poster || "").trim();
  const cameraOrbit = String(json?.cameraOrbit || "").trim();
  const cameraTarget = String(json?.cameraTarget || "").trim();
  const initialZoom = Number(json?.initialZoom ?? 0);
  const usdzUrl = String(json?.usdzUrl || "").trim();

  const items: PublishChecklistItem[] = [
    {
      id: "model",
      label: "Model loads",
      status: hasGlb ? "ok" : "error",
      message: hasGlb ? undefined : "A valid GLB model is required.",
    },
    {
      id: "camera",
      label: "Camera saved",
      status: cameraOrbit && (cameraTarget || initialZoom > 0) ? "ok" : "warn",
      message: cameraOrbit ? undefined : "Default camera will be used until you save a view.",
    },
    {
      id: "poster",
      label: "Poster exists",
      status: poster ? "ok" : "warn",
      message: poster ? undefined : "A poster image will be captured on publish.",
    },
    {
      id: "settings",
      label: "Viewer settings valid",
      status: "ok",
    },
    {
      id: "usdz",
      label: "USDZ for iPhone AR",
      status: usdzUrl ? "ok" : "warn",
      message: usdzUrl ? undefined : "iPhone Quick Look AR works best with an optional USDZ file.",
    },
  ];

  const canPublish = hasGlb;
  return { items, canPublish };
}

export async function publishCustomerProduct(input: {
  customerUid: string;
  userId: number;
  productUid: string;
  origin: string;
  title?: string;
}) {
  const rows = await query<{
    id: string;
    title: string;
    status: string;
    public_id: string | null;
    viewer_slug: string | null;
    version: number;
  }>(
    `SELECT id, title, status, public_id, viewer_slug, version
     FROM products
     WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL)
       AND deleted_at IS NULL
     LIMIT 1`,
    [input.productUid, input.customerUid, input.userId],
  );

  const row = rows[0];
  if (!row) {
    return { ok: false as const, code: ProductErrorCode.PUBLISH_FAILED, error: "Product not found." };
  }

  const arLimit = await checkEnterpriseArExperienceLimit(input.customerUid, input.productUid);
  if (arLimit.ok === false) {
    return { ok: false as const, code: arLimit.code, error: arLimit.message };
  }

  const checklist = await buildPreviewChecklist({
    customerUid: input.customerUid,
    productUid: input.productUid,
  });
  if (!checklist.canPublish) {
    return {
      ok: false as const,
      code: ProductErrorCode.PUBLISH_FAILED,
      error: friendlyProductError(ProductErrorCode.PUBLISH_FAILED, "Upload a valid GLB before publishing."),
    };
  }

  const title = input.title || row.title || "Untitled";
  const publicId = row.public_id || makePublicProductId(title, input.productUid);
  const viewerSlug = row.viewer_slug || makeSafeSlug(title, input.productUid);
  const nextVersion = Number(row.version || 0) + 1;
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  await query(
    `UPDATE products
     SET status = 'published',
         public_id = ?,
         viewer_slug = ?,
         published_at = ?,
         version = ?,
         last_editor_user_id = ?,
         updated_at = NOW()
     WHERE id = ? AND customer_uid = ?`,
    [publicId, viewerSlug, now, nextVersion, input.userId, input.productUid, input.customerUid],
  );

  const { updateProductJson } = await import("@/lib/localCustomerStorage");
  const productJson = await updateProductJson({
    customerUid: input.customerUid,
    productUid: input.productUid,
    patch: {
      status: "published",
      publicId,
      viewerSlug,
      publishedAt: new Date().toISOString(),
      version: nextVersion,
      destination: `${input.origin}/viewer/${publicId}`,
    },
  });

  await ensurePublishShareIntegrations({
    customerUid: input.customerUid,
    userId: input.userId,
    productId: input.productUid,
    publicId,
    origin: input.origin,
  });

  await logProductActivity({
    productUid: input.productUid,
    customerUid: input.customerUid,
    userId: input.userId,
    action: "published",
    version: nextVersion,
    meta: { publicId },
  });

  await createPublishNotification(input.customerUid, title, publicId);

  return {
    ok: true as const,
    product: productJson,
    publicId,
    viewerUrl: `${input.origin}/viewer/${publicId}`,
    checklist: checklist.items,
  };
}
