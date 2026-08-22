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
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";
import { checkUploadEntitlement } from "@/lib/billing/plan-enforcement";
import { query } from "@/lib/db";

export const runtime = "nodejs";

async function syncHdrToMysql(customerUid: string, productUid: string, environmentImage: string) {
  try {
    await ensureAppSchema();
    await updateScopedProductRow({
      customerUid,
      productUid,
      sqlSet: "settings = JSON_SET(COALESCE(settings, JSON_OBJECT()), '$.environmentImage', ?)",
      values: [environmentImage],
    });
  } catch (error) {
    console.warn("[hdr-upload] MySQL sync skipped:", error);
  }
}

async function isRadianceHdr(file: File) {
  if (!file.name.toLowerCase().endsWith(".hdr")) return false;
  const header = await file.slice(0, 128).text();
  return header.includes("#?RADIANCE") || header.includes("#?RGBE");
}

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const formData = await req.formData();
    const clientCustomerUid = String(formData.get("customerUid") || "").trim();
    const productUid = normalizeScopedId(formData.get("productUid") || formData.get("id"));
    const hdr = formData.get("hdr") as File | null;

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
    const uploadSizeMb = (hdr?.size || 0) / 1024 / 1024;
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

    if (!hdr) {
      return NextResponse.json({ error: "HDR file is required." }, { status: 400 });
    }

    validateUploadedFile(hdr);

    if (!(await isRadianceHdr(hdr))) {
      return NextResponse.json(
        { error: "Invalid HDR. Upload Radiance .hdr only." },
        { status: 400 },
      );
    }

    const ownership = await verifyCustomerProductAccess({ user, productUid });
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.reason }, { status: 403 });
    }

    const customerUid = ownership.customerUid;
    const hdrBuffer = Buffer.from(await hdr.arrayBuffer());
    const environmentImage = await writeProductFile({
      customerUid,
      productUid,
      fileName: "environment.hdr",
      data: hdrBuffer,
    });

    await updateProductJson({
      customerUid,
      productUid,
      patch: { environmentImage, useSkybox: false },
    });

    await syncHdrToMysql(customerUid, productUid, environmentImage);

    void recalculateCustomerStorage(customerUid).catch((err) =>
      console.warn("[hdr-upload] Storage recalculation failed:", err),
    );

    return NextResponse.json({
      success: true,
      environmentImage,
      fileName: hdr.name,
    });
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof StorageSecurityError) {
      console.error("[hdr-upload] SECURITY:", error.message);
      return NextResponse.json({ error: "Upload rejected." }, { status: 403 });
    }
    console.error("[hdr-upload]", error);
    return NextResponse.json({ error: "HDR upload failed." }, { status: 500 });
  }
}
