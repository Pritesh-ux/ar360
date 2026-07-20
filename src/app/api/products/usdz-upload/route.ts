import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { enforcePermission } from "@/lib/billing/api-permission";
import {
  clientCustomerScopeIsValid,
  normalizeScopedId,
  verifyCustomerProductAccess,
  updateScopedProductRow,
} from "@/lib/customerIsolation";
import { updateProductJson } from "@/lib/localCustomerStorage";
import { ensureAppSchema } from "@/lib/db";
import {
  validateUploadedFile,
  writeProductFile,
  recalculateCustomerStorage,
  StorageValidationError,
  StorageSecurityError,
} from "@/lib/storage";

export const runtime = "nodejs";

async function syncUsdzToMysql(customerUid: string, productUid: string, usdzUrl: string) {
  try {
    await ensureAppSchema();
    await updateScopedProductRow({
      customerUid,
      productUid,
      sqlSet: "settings = JSON_SET(COALESCE(settings, JSON_OBJECT()), '$.usdzUrl', ?)",
      values: [usdzUrl],
    });
  } catch (error) {
    console.warn("[usdz-upload] MySQL sync skipped:", error);
  }
}

import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";
import { checkUploadEntitlement } from "@/lib/billing/plan-enforcement";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    // SECURITY: Require a valid customer session
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const formData = await req.formData();
    const clientCustomerUid = String(formData.get("customerUid") || "").trim();
    const productUid = normalizeScopedId(formData.get("productUid") || formData.get("id"));
    const usdz = formData.get("usdz") as File | null;

    if (!productUid) {
      return NextResponse.json({ error: "Valid productUid is required." }, { status: 400 });
    }

    // ── 2. Customer scope check ───────────────────────────────────────────────
    // SECURITY: Reject if the client-supplied customerUid doesn't match the session
    if (!clientCustomerScopeIsValid(user, clientCustomerUid)) {
      return NextResponse.json({ error: "Forbidden customer scope." }, { status: 403 });
    }

    // ── 2b. Permission engine ────────────────────────────────────────────────
    const permission = await enforcePermission(user.customerUid ?? "", "upload", { isEdit: true });
    if (!permission.ok) return permission.response;

    // ── 2c. Entitlement check ───────────────────────────────────────────────
    const billingRows = await query<any>(
      `SELECT c.customer_uid,
              (SELECT COUNT(*) FROM products p WHERE p.customer_uid = c.customer_uid) AS products_used,
              COALESCE((SELECT SUM(size_bytes) FROM product_assets a WHERE a.customer_uid = c.customer_uid), 0) / 1024 / 1024 AS storage_used_mb
         FROM customers c
        WHERE c.customer_uid = ?
        LIMIT 1`,
      [user.customerUid]
    ).catch(() => []);

    const billing = billingRows[0] || {
      customer_uid: user.customerUid,
      products_used: 0,
      storage_used_mb: 0,
    };

    const plan = await resolveCustomerPlanLimits(user.customerUid ?? "");

    const usdzSize = usdz ? usdz.size : 0;
    const uploadSizeMb = usdzSize / 1024 / 1024;

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

    // ── 3. File presence ─────────────────────────────────────────────────────
    if (!usdz) {
      return NextResponse.json({ error: "USDZ file is required." }, { status: 400 });
    }

    // ── 4. File type + size validation ────────────────────────────────────────
    // SECURITY: Extension allow-list + size limit enforced before any disk write
    validateUploadedFile(usdz);

    if (!usdz.name.toLowerCase().endsWith(".usdz")) {
      return NextResponse.json({ error: "Only .usdz file is allowed." }, { status: 400 });
    }

    // ── 5. Product ownership verification ────────────────────────────────────
    // SECURITY: Confirms this product belongs to the authenticated customer.
    // A customer cannot upload a USDZ to another customer's product.
    const ownership = await verifyCustomerProductAccess({ user, productUid });
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.reason }, { status: 403 });
    }

    const customerUid = ownership.customerUid;

    // ── 6. Write USDZ via secure path helper ──────────────────────────────────
    const usdzBuffer = Buffer.from(await usdz.arrayBuffer());
    const usdzUrl = await writeProductFile({
      customerUid,
      productUid,
      fileName: "model.usdz",
      data: usdzBuffer,
    });

    // ── 7. Update product.json ────────────────────────────────────────────────
    const product = await updateProductJson({
      customerUid,
      productUid,
      patch: { usdzUrl, usdzFileName: usdz.name },
    });

    // ── 8. Sync relative URL to MySQL ─────────────────────────────────────────
    await syncUsdzToMysql(customerUid, productUid, usdzUrl);

    // ── 9. Recalculate storage quota ─────────────────────────────────────────
    recalculateCustomerStorage(customerUid).catch((err) =>
      console.warn("[usdz-upload] Storage recalculation failed:", err)
    );

    return NextResponse.json({ success: true, product, usdzUrl, usdzFileName: usdz.name });
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof StorageSecurityError) {
      console.error("[usdz-upload] SECURITY:", error.message);
      return NextResponse.json({ error: "Upload rejected." }, { status: 403 });
    }
    console.error("[usdz-upload]", error);
    return NextResponse.json({ error: "USDZ upload failed." }, { status: 500 });
  }
}
