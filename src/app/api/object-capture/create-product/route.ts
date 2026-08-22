import { NextResponse } from "next/server";
import { readPrivateAsset } from "@/lib/object-capture/production-service";
import {
  CaptureProductError,
  captureProductId,
  createProductFromCaptureTransaction,
} from "@/lib/object-capture/create-product.service";
import { isApiError, requireObjectCaptureUser } from "@/lib/object-capture/api";
import { assertCan } from "@/lib/billing/permissions";
import {
  createProductFolder,
  updateProductJson,
  saveQrPng,
} from "@/lib/localCustomerStorage";
import { ensureProductSchema, query } from "@/lib/db";
import { writeProductFile, recalculateCustomerStorage } from "@/lib/storage";
import { optimizeGlbBuffer, describeGlbOptimizeStats } from "@/lib/products/glb-optimize";
import {
  checkEnterpriseModelLimit,
  checkProductLimit,
  checkStorageLimit,
} from "@/lib/billing/limit-enforcement";
import { notifyCaptureProductCreated } from "@/lib/object-capture/notifications";

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const user = await requireObjectCaptureUser();
    if (isApiError(user)) return user;
    const customerUid = user.customerUid;

    const body = await req.json();
    const jobId = String(body.jobId || "");

    if (!jobId) {
      return NextResponse.json({ success: false, error: "Job ID missing" }, { status: 400 });
    }

    const result = await createProductFromCaptureTransaction({
      customerUid,
      jobId,
      build: async (job) => {
    // Limits are intentionally rechecked while the capture job is locked.
    const permission = await assertCan(customerUid, "create_product");
    if (permission.allowed === false) {
      throw new CaptureProductError(permission.message, 403, permission.code);
    }
    const ocPermission = await assertCan(customerUid, "object_capture", {
      context: permission.context,
    });
    if (ocPermission.allowed === false) {
      throw new CaptureProductError(ocPermission.message, 403, ocPermission.code);
    }

    const plan = permission.context.limits;
    const [productLimit, modelLimit] = await Promise.all([
      checkProductLimit(customerUid, String(plan.planId)),
      checkEnterpriseModelLimit(customerUid, plan),
    ]);
    if (productLimit.ok === false) {
      throw new CaptureProductError(productLimit.message, 403, productLimit.code);
    }
    if (modelLimit.ok === false) {
      throw new CaptureProductError(modelLimit.message, 403, modelLimit.code);
    }

    // 2. Load the completed model before creating any product state.
    let modelBuffer: Buffer;
    try {
      if (!job.model_key) throw new Error("Model storage key missing.");
      modelBuffer = await readPrivateAsset(customerUid, job.model_key);
    } catch {
      throw new CaptureProductError(
        "The reconstructed model artifact is unavailable. Retry the capture job.",
        409,
      );
    }

    const storageLimit = await checkStorageLimit(
      customerUid,
      modelBuffer.length,
      0,
      String(plan.planId),
    );
    if (storageLimit.ok === false) {
      throw new CaptureProductError(storageLimit.message, 403, storageLimit.code);
    }

    // 3. Create product directory structure only after all quotas pass.
    const productFolderRecord = await createProductFolder({
      customerUid,
      title: "Captured Product 3D",
      category: "Object Capture",
      productUid: captureProductId(job.id),
    });
    const productId = productFolderRecord.productUid;

    // Photogrammetry output carries full-resolution bake textures; downscale them
    // so the captured product stays viewable on phones.
    const { buffer: storedModelBuffer, stats: optimizeStats } = await optimizeGlbBuffer(modelBuffer);
    console.info(
      `[object-capture] ${productId}: ${describeGlbOptimizeStats(optimizeStats)}`,
    );

    const modelUrl = await writeProductFile({
      customerUid,
      productUid: productId,
      fileName: "model.glb",
      data: storedModelBuffer,
    });

    // 4. Securely copy thumbnail poster if it exists
    let posterUrl = "";
    if (job.thumbnail_key) {
      try {
        const posterBuffer = await readPrivateAsset(customerUid, job.thumbnail_key);
        posterUrl = await writeProductFile({
          customerUid,
          productUid: productId,
          fileName: "poster.jpg",
          data: posterBuffer,
        });
      } catch {}
    }

    // 5. Generate QR Code
    let qrUrl = "";
    try {
      const { getAppUrl } = await import("@/lib/url");
      const appUrl = getAppUrl();
      const { resolveQrCenterLogoForCustomer } = await import("@/lib/growth/qr-logo");
      const logo = await resolveQrCenterLogoForCustomer({
        customerUid,
        customLogoUrl: null,
      });
      qrUrl = await saveQrPng({
        customerUid,
        productUid: productId,
        destination: `${appUrl}/viewer/${productId}`,
        logoUrl: logo.logoUrl,
        logoSize: logo.logoSize,
      });
    } catch (e) {
      console.warn("QR code generation skipped:", e);
    }

    // 6. Update local product.json metadata
    const productJson = await updateProductJson({
      customerUid,
      productUid: productId,
      patch: {
        title: "Captured Product 3D",
        category: "Object Capture",
        modelUrl,
        fileName: "model.glb",
        poster: posterUrl || undefined,
        thumbnailUrl: posterUrl || undefined,
        qrUrl: qrUrl || undefined,
        publicFolder: productFolderRecord.publicFolder,
        views: 0,
        status: "published",
        variants: [{ id: "default", name: "Default" }],
        materialSettings: {},
        hotspots: [],
      },
    });

    // 7. Sync product schema to MySQL
    await ensureProductSchema();
    await query(
      `INSERT INTO products 
         (id, customer_uid, user_id, title, category, model_url, file_name, poster, thumbnail_url, qr_url, product_folder, status, views, settings, material_settings, variants, hotspots)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 0, '{}', '{}', '[{"id":"default","name":"Default"}]', '[]')
       ON DUPLICATE KEY UPDATE
         title          = VALUES(title),
         category       = VALUES(category),
         model_url      = VALUES(model_url),
         file_name      = VALUES(file_name),
         poster         = VALUES(poster),
         thumbnail_url  = VALUES(thumbnail_url),
         qr_url         = VALUES(qr_url),
         product_folder = VALUES(product_folder),
         updated_at     = NOW()`,
      [
        productId,
        customerUid,
        user.id,
        "Captured Product 3D",
        "Object Capture",
        modelUrl,
        "model.glb",
        posterUrl || null,
        posterUrl || null,
        qrUrl || null,
        "All",
      ]
    );

    // Recalculate storage quotas after durable product writes.
    recalculateCustomerStorage(customerUid).catch(() => {});

    return {
      productId,
      product: {
        ...productJson,
        id: productId,
        productUid: productId,
        customerUid,
        folder: "All",
      },
    };
      },
    });
    await notifyCaptureProductCreated({
      jobId,
      customerUid,
      userId: Number(user.id),
      productId: result.productId,
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      product: result.product,
      existing: result.existing,
      redirectUrl: `/dashboard/products/${result.productId}`,
    });
  } catch (error) {
    console.error("Create product from object capture error:", error);
    const status = error instanceof CaptureProductError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        code: error instanceof CaptureProductError ? error.code : undefined,
        error: error instanceof Error ? error.message : "Failed to create product",
      },
      { status },
    );
  }
}
