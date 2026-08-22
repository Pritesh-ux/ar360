import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { enforcePermission } from "@/lib/billing/api-permission";
import {
  clientCustomerScopeIsValid,
  normalizeScopedId,
  verifyCustomerProductAccess,
} from "@/lib/customerIsolation";
import { recalculateCustomerStorage, StorageSecurityError } from "@/lib/storage";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";
import { checkUploadEntitlement } from "@/lib/billing/plan-enforcement";
import { query } from "@/lib/db";
import {
  ProductSaveError,
  saveProductAssetsTransactional,
} from "@/lib/products/product-save.service";
import { ProductErrorCode } from "@/lib/products/product-errors";
import { checkEnterpriseArExperienceLimit } from "@/lib/billing/limit-enforcement";

export const runtime = "nodejs";
/** Large poster + material texture persist can exceed default serverless window. */
export const maxDuration = 300;

/** Strip internal path fields that must never be overwritten by client input. */
function cleanPatch(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const blocked = new Set(["folderPath", "productFolder", "customerUid", "productUid"]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (blocked.has(key) || value === undefined) continue;
    patch[key] = value;
  }

  // Never persist browser-only HDR data URLs — they blank the canvas on reopen.
  const env = String(patch.environmentImage || "");
  if (env.startsWith("blob:") || env.startsWith("data:") || env.length > 2048) {
    patch.environmentImage = "/hdr/neutral.hdr";
    patch.useSkybox = false;
  }

  return patch;
}

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const clientCustomerUid = String(body.customerUid || "").trim();
    const productUid = normalizeScopedId(body.productUid || body.id);
    const posterDataUrl = String(body.posterDataUrl || "");
    const destination = String(body.destination || "");
    const status = String(body.status || "published");
    const productPatch = cleanPatch(body.productPatch || body.product || {});
    const expectedVersion =
      typeof body.expectedVersion === "number"
        ? body.expectedVersion
        : typeof productPatch.version === "number"
          ? productPatch.version
          : undefined;

    if (!productUid) {
      return NextResponse.json({ error: "Valid productUid is required." }, { status: 400 });
    }

    if (!clientCustomerScopeIsValid(user, clientCustomerUid)) {
      return NextResponse.json({ error: "Forbidden customer scope." }, { status: 403 });
    }

    const permission = await enforcePermission(user.customerUid ?? "", "upload", { isEdit: true });
    if (!permission.ok) return permission.response;

    const billingRows = await query<any>(
      `SELECT c.customer_uid,
              (SELECT COUNT(*) FROM products p WHERE p.customer_uid = c.customer_uid) AS products_used,
              COALESCE((SELECT SUM(size_bytes) FROM product_assets a WHERE a.customer_uid = c.customer_uid), 0) / 1024 / 1024 AS storage_used_mb
         FROM customers c
        WHERE c.customer_uid = ?
        LIMIT 1`,
      [user.customerUid],
    ).catch(() => []);

    const billing = billingRows[0] || {
      customer_uid: user.customerUid,
      products_used: 0,
      storage_used_mb: 0,
    };

    const plan = await resolveCustomerPlanLimits(user.customerUid ?? "");
    
    const posterSize = posterDataUrl ? Buffer.from(posterDataUrl.split(',')[1] || '', 'base64').length : 0;
    const uploadSizeMb = posterSize / 1024 / 1024;

    const usage = {
      productsUsed: Number(billing.products_used || 0),
      storageUsedMb: Number(billing.storage_used_mb || 0),
      bandwidthUsedGb: await getCustomerBandwidthUsedGb(user.customerUid ?? ""),
      trialStartedAt: null,
      trialEndsAt: permission.context.expiresAt,
      subscriptionStatus: permission.context.subscription.reason === "active" ? "active" : "trialing",
    };

    const entitlement = checkUploadEntitlement(plan, usage, true, uploadSizeMb);
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }

    const ownership = await verifyCustomerProductAccess({ user, productUid });
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.reason }, { status: 403 });
    }

    if (["published", "active"].includes(status.toLowerCase())) {
      const arLimit = await checkEnterpriseArExperienceLimit(
        ownership.customerUid,
        productUid,
        plan,
      );
      if (arLimit.ok === false) {
        return NextResponse.json(
          { success: false, code: arLimit.code, error: arLimit.message },
          { status: 403 },
        );
      }
    }

    const result = await saveProductAssetsTransactional({
      customerUid: ownership.customerUid,
      productUid,
      userId: user.id,
      posterDataUrl,
      destination,
      status,
      patch: productPatch,
      expectedVersion,
    });

    recalculateCustomerStorage(ownership.customerUid).catch((err) =>
      console.warn("[save-assets] Storage recalculation failed:", err),
    );

    return NextResponse.json({
      success: true,
      product: result.product,
      posterUrl: result.posterUrl,
      thumbnailUrl: result.thumbnailUrl,
      qrUrl: result.qrUrl,
      version: result.version,
    });
  } catch (error) {
    if (error instanceof ProductSaveError) {
      const status =
        error.phase === "conflict"
          ? 409
          : error.phase === "mysql"
            ? 502
            : error.phase === "validation"
              ? 400
              : 500;
      return NextResponse.json(
        {
          error: error.message,
          code: error.code || ProductErrorCode.SAVE_FAILED,
          ...(typeof error.currentVersion === "number"
            ? { currentVersion: error.currentVersion }
            : {}),
        },
        { status },
      );
    }
    if (error instanceof StorageSecurityError) {
      console.error("[save-assets] SECURITY:", error.message);
      return NextResponse.json({ error: "Asset save rejected." }, { status: 403 });
    }
    console.error("[save-assets]", error);
    return NextResponse.json({ error: "Product assets save failed." }, { status: 500 });
  }
}

