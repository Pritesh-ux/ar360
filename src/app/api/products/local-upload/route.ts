import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { clientCustomerScopeIsValid, normalizeScopedId } from "@/lib/customerIsolation";
import {
  createProductFolder,
  ensureCustomerFolder,
  updateProductJson,
} from "@/lib/localCustomerStorage";
import { query } from "@/lib/db";
import {
  validateUploadedFile,
  writeProductFile,
  recalculateCustomerStorage,
  StorageValidationError,
  StorageSecurityError,
  getSecureProductPath,
} from "@/lib/storage";
import { validateGlbUpload } from "@/lib/products/glb-validator";
import { optimizeGlbBuffer, describeGlbOptimizeStats, buildArLiteGlb } from "@/lib/products/glb-optimize";
import {
  ensureGlbBuffer,
  isAcceptedModelExtension,
  MAX_SOURCE_MODEL_BYTES,
  ModelConversionError,
  modelExtension,
} from "@/lib/products/convert-model-to-glb";
import { ProductErrorCode, friendlyProductError } from "@/lib/products/product-errors";
import { rollbackProductUpload } from "@/lib/products/upload-rollback";
import fs from "fs/promises";

export const runtime = "nodejs";
/** Large GLB uploads — keep the route handler alive for big files. */
export const maxDuration = 300;


async function syncProductToMysql(product: {
  productUid: string;
  customerUid: string;
  title: string;
  category?: string;
  description?: string;
  modelUrl?: string;
  fileName?: string;
  publicFolder: string;
  userId?: number;
  status?: string;
}) {
  // Do NOT call ensureAppSchema() here — it is very slow on every upload.
  await query(
    `INSERT INTO products (id, customer_uid, user_id, title, category, description, model_url, file_name, product_folder, status, views)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       customer_uid   = VALUES(customer_uid),
       user_id        = VALUES(user_id),
       title          = VALUES(title),
       category       = VALUES(category),
       description    = COALESCE(VALUES(description), description),
       model_url      = VALUES(model_url),
       file_name      = VALUES(file_name),
       product_folder = VALUES(product_folder),
       status         = VALUES(status)`,
    [
      product.productUid,
      product.customerUid,
      product.userId ?? null,
      product.title,
      product.category ?? "Uncategorized",
      product.description ?? null,
      product.modelUrl ?? null,
      product.fileName ?? null,
      "All",
      product.status ?? "processing",
    ],
  );
}

import { BillingErrorCode } from "@/lib/billing/billing-errors";
import { enforcePermission } from "@/lib/billing/api-permission";
import { checkUploadEntitlement } from "@/lib/billing/plan-enforcement";
import {
  checkEnterpriseModelLimit,
  checkProductLimit,
  checkStorageLimit,
} from "@/lib/billing/limit-enforcement";

export async function POST(req: Request) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    // SECURITY: Require a valid customer session before touching any file
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const formData = await req.formData();
    const title = String(formData.get("title") || "Untitled Product").trim();
    const category = String(formData.get("category") || "Uncategorized");
    const description = String(formData.get("description") || "").trim();
    const model = formData.get("model") as File | null;
    const usdz = formData.get("usdz") as File | null;
    const customerUidFromClient = normalizeScopedId(formData.get("customerUid"));

    // ── 2. Customer scope check ───────────────────────────────────────────────
    // SECURITY: The customerUid in the form must match the session customerUid.
    // This prevents a customer from uploading into another customer's folder.
    if (!clientCustomerScopeIsValid(user, customerUidFromClient)) {
      return NextResponse.json({ error: "Forbidden customer scope." }, { status: 403 });
    }

    // ── 2b. Subscription + permission engine ────────────────────────────────
    const createPermission = await enforcePermission(user.customerUid ?? "", "create_product");
    if (!createPermission.ok) {
      return createPermission.response;
    }

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

    const plan = createPermission.context.limits;
    const resolvedPlanId = String(plan.planId);
    const modelSize = model ? model.size : 0;
    const usdzSize = usdz ? usdz.size : 0;
    const uploadSizeMb = (modelSize + usdzSize) / 1024 / 1024;

    // Parallel limit checks — avoid sequential DB round-trips that slow large uploads.
    const [productLimitCheck, modelLimitCheck, storageLimitCheck] = await Promise.all([
      checkProductLimit(user.customerUid ?? "", resolvedPlanId),
      checkEnterpriseModelLimit(user.customerUid ?? "", plan),
      checkStorageLimit(user.customerUid ?? "", modelSize + usdzSize, 0, resolvedPlanId),
    ]);

    if (productLimitCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: productLimitCheck.code, error: productLimitCheck.message },
        { status: 403 },
      );
    }
    if (modelLimitCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: modelLimitCheck.code, error: modelLimitCheck.message },
        { status: 403 },
      );
    }
    if (storageLimitCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: storageLimitCheck.code, error: storageLimitCheck.message },
        { status: 403 },
      );
    }

    const usage = {
      productsUsed: Number(billing.products_used || 0),
      storageUsedMb: Number(billing.storage_used_mb || 0),
      bandwidthUsedGb: 0, // not used by checkUploadEntitlement
      trialStartedAt: null,
      trialEndsAt: createPermission.context.expiresAt,
      subscriptionStatus:
        createPermission.context.subscription.reason === "active" ? "active" : "trialing",
    };

    const entitlement = checkUploadEntitlement(plan, usage, false, uploadSizeMb);
    if (!entitlement.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: entitlement.code || BillingErrorCode.STORAGE_LIMIT_REACHED,
          error: entitlement.reason,
        },
        { status: 403 },
      );
    }

    // ── 3. File presence ─────────────────────────────────────────────────────
    if (!model) {
      return NextResponse.json(
        {
          success: false,
          code: ProductErrorCode.INVALID_GLB,
          error: "3D model file is required (.glb, .obj, or .fbx).",
        },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json({ success: false, error: "Product name is required." }, { status: 400 });
    }

    // ── 4. File type + size validation ────────────────────────────────────────
    const sourceExt = modelExtension(model.name);
    if (!isAcceptedModelExtension(sourceExt)) {
      return NextResponse.json(
        {
          success: false,
          code: ProductErrorCode.INVALID_GLB,
          error: "Only .glb, .obj, or .fbx model files are allowed.",
        },
        { status: 400 },
      );
    }

    if (model.size === 0) {
      return NextResponse.json(
        { success: false, code: ProductErrorCode.INVALID_GLB, error: `File "${model.name}" is empty.` },
        { status: 400 },
      );
    }

    if (model.size > MAX_SOURCE_MODEL_BYTES) {
      return NextResponse.json(
        {
          success: false,
          code: ProductErrorCode.INVALID_GLB,
          error: `File "${model.name}" exceeds the 2 GB upload limit.`,
        },
        { status: 400 },
      );
    }

    // Source OBJ/FBX are converted to GLB and never written to durable storage.
    // Skip validateUploadedFile for the model so .obj/.fbx stay outside ALLOWED_EXTENSIONS.
    if (usdz) validateUploadedFile(usdz);

    const sourceBuffer = Buffer.from(await model.arrayBuffer());
    let modelBuffer: Buffer;
    let converted = false;
    try {
      const ensured = await ensureGlbBuffer({ buffer: sourceBuffer, fileName: model.name });
      modelBuffer = ensured.buffer;
      converted = ensured.converted;
    } catch (convertErr) {
      if (convertErr instanceof ModelConversionError) {
        const status = convertErr.code === "BLENDER_MISSING" ? 503 : 400;
        return NextResponse.json(
          {
            success: false,
            code: ProductErrorCode.UPLOAD_FAILED,
            error: convertErr.message,
          },
          { status },
        );
      }
      throw convertErr;
    }

    const glbCheck = validateGlbUpload({
      buffer: modelBuffer,
      fileName: "model.glb",
      mimeType: "model/gltf-binary",
      sizeBytes: modelBuffer.length,
    });
    if (glbCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: glbCheck.code, error: glbCheck.message },
        { status: 400 },
      );
    }

    // Oversized authoring textures crash mobile browsers, so downscale before storing.
    const { buffer: storedModelBuffer, stats: optimizeStats } = await optimizeGlbBuffer(modelBuffer);
    console.info(
      `[local-upload] ${model.name}${converted ? ` → GLB via Blender` : ""}: ${describeGlbOptimizeStats(optimizeStats)}`,
    );

    // ── 6. Ensure storage + customer folder exist ───────────────────────────
    try {
      const { ensureActiveStorageRoot } = await import("@/lib/storage/adapter");
      await ensureActiveStorageRoot();
    } catch (storageError) {
      console.error("[local-upload] storage root unavailable", storageError);
      return NextResponse.json(
        {
          success: false,
          code: ProductErrorCode.UPLOAD_FAILED,
          error:
            "Storage folder is not writable on the server. Create storage/Customers and set write permissions.",
        },
        { status: 500 },
      );
    }

    const customer = await ensureCustomerFolder({
      customerUid: user.customerUid,
      userId: String(user.id),
      name: user.name,
      email: user.email,
    });

    // ── 7. Create product folder ──────────────────────────────────────────────
    const product = await createProductFolder({
      customerUid: customer.customerUid,
      title,
      category,
    });

    let uploadCommitted = false;

    try {
      // Write file first (fast path), then one MySQL sync — skip pre-insert + dual recalc.
      const modelUrl = await writeProductFile({
        customerUid: customer.customerUid,
        productUid: product.productUid,
        fileName: "model.glb",
        data: storedModelBuffer,
        deferStorageRecalc: true,
      });

      const modelDiskPath = getSecureProductPath(
        customer.customerUid,
        product.productUid,
        "model.glb",
      );
      await fs.access(modelDiskPath);

      let usdzUrl = "";
      let usdzFileName = "";
      let arModelUrl = "";
      let arLiteStatus: "ok" | "failed" | "skipped" | "not_needed" = "not_needed";
      let arLiteMessage = "";

      // Heavy GLBs crash iOS Safari when AR runs in-tab — store a lite Scene Viewer copy.
      if (storedModelBuffer.length > 12 * 1024 * 1024) {
        try {
          const lite = await buildArLiteGlb(storedModelBuffer);
          if (lite.stats.optimized && lite.buffer.length < storedModelBuffer.length) {
            arModelUrl = await writeProductFile({
              customerUid: customer.customerUid,
              productUid: product.productUid,
              fileName: "model.ar.glb",
              data: lite.buffer,
              deferStorageRecalc: true,
            });
            arLiteStatus = "ok";
            arLiteMessage = describeGlbOptimizeStats(lite.stats);
            console.info(
              `[local-upload] AR lite ${product.productUid}: ${arLiteMessage}`,
            );
          } else {
            arLiteStatus = "skipped";
            arLiteMessage = describeGlbOptimizeStats(lite.stats);
            console.info(
              `[local-upload] AR lite skipped ${product.productUid}: ${arLiteMessage}`,
            );
          }
        } catch (arLiteErr) {
          arLiteStatus = "failed";
          arLiteMessage =
            arLiteErr instanceof Error ? arLiteErr.message.slice(0, 180) : "AR lite build failed";
          console.warn("[local-upload] AR lite failed:", arLiteErr);
        }
      }

      if (usdz) {
        if (!usdz.name.toLowerCase().endsWith(".usdz")) {
          throw new StorageValidationError("Only .usdz file is allowed for iPhone AR.");
        }
        const usdzBuffer = Buffer.from(await usdz.arrayBuffer());
        usdzUrl = await writeProductFile({
          customerUid: customer.customerUid,
          productUid: product.productUid,
          fileName: "model.usdz",
          data: usdzBuffer,
          deferStorageRecalc: true,
        });
        usdzFileName = usdz.name;
      }

      const productJson = await updateProductJson({
        customerUid: customer.customerUid,
        productUid: product.productUid,
        patch: {
          title,
          category,
          description: description || undefined,
          modelUrl,
          fileName: model.name,
          modelBytes: storedModelBuffer.length,
          arModelUrl: arModelUrl || undefined,
          arLiteStatus,
          arLiteMessage: arLiteMessage || undefined,
          usdzUrl: usdzUrl || undefined,
          usdzFileName: usdzFileName || undefined,
          publicFolder: product.publicFolder,
          status: "published",
          activeVariantId: "default",
          initialZoom: 50,
          fov: 45,
          cameraOrbit: "35deg 58deg 155%",
          cameraTarget: "auto auto auto",
          backgroundType: "solid",
          variants: [
            {
              id: "default",
              name: "Default",
              materialSettings: {},
              environmentImage: "default",
              exposure: 1,
              backgroundColor: "#ffffff",
              transparent: false,
              shadowIntensity: 1,
              shadowSoftness: 1,
              autoRotate: true,
              cameraControls: true,
              showArButton: true,
              interactionPrompt: true,
              autoPlay: true,
              fov: 45,
              initialZoom: 50,
            },
          ],
        },
      });

      await syncProductToMysql({
        productUid: product.productUid,
        customerUid: customer.customerUid,
        title,
        category,
        description: description || undefined,
        modelUrl,
        fileName: model.name,
        publicFolder: product.publicFolder,
        userId: user.id,
        status: "published",
      });

      uploadCommitted = true;
      // Background only — do not block the response on disk walk.
      void recalculateCustomerStorage(customer.customerUid).catch((err) =>
        console.warn("[local-upload] Storage recalculation failed:", err),
      );

      return NextResponse.json({
        success: true,
        stage: "completed",
        customer,
        validation: {
          meshCount: glbCheck.meshCount,
          textureCount: glbCheck.textureCount,
        },
        warnings:
          arLiteStatus === "failed"
            ? [
                "Mobile AR-lite GLB could not be built. Large models may crash Safari AR until you re-upload or add a USDZ.",
              ]
            : arLiteStatus === "skipped" && storedModelBuffer.length > 35 * 1024 * 1024
              ? [
                  "Mobile AR-lite was skipped for this heavy GLB. Prefer a smaller model or USDZ for iPhone AR.",
                ]
              : [],
        product: {
          ...productJson,
          id: product.productUid,
          productUid: product.productUid,
          customerUid: customer.customerUid,
          title,
          category,
          description: description || undefined,
          modelUrl,
          fileName: model.name,
          modelBytes: storedModelBuffer.length,
          arModelUrl: arModelUrl || undefined,
          arLiteStatus,
          arLiteMessage: arLiteMessage || undefined,
          usdzUrl: usdzUrl || undefined,
          usdzFileName: usdzFileName || undefined,
          folder: "All",
          poster: "",
          views: 0,
          status: "published",
          variants: [{ id: "default", name: "Default" }],
          materialSettings: {},
          hotspots: [],
        },
      });
    } catch (writeError) {
      if (!uploadCommitted) {
        await rollbackProductUpload(customer.customerUid, product.productUid);
      }
      throw writeError;
    }
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json(
        { success: false, code: ProductErrorCode.INVALID_GLB, error: error.message },
        { status: 400 },
      );
    }
    if (error instanceof StorageSecurityError) {
      console.error("[local-upload] SECURITY:", error.message);
      return NextResponse.json(
        { success: false, code: ProductErrorCode.UPLOAD_FAILED, error: "Upload rejected." },
        { status: 403 },
      );
    }
    console.error("[local-upload]", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Upload failed.";
    const permissionDenied =
      typeof detail === "string" &&
      (/EACCES|EPERM|permission denied|read-only/i.test(detail) ||
        (typeof (error as { code?: string })?.code === "string" &&
          /EACCES|EPERM/.test(String((error as { code?: string }).code))));

    return NextResponse.json(
      {
        success: false,
        code: ProductErrorCode.UPLOAD_FAILED,
        error: permissionDenied
          ? "Server cannot write model files. Fix storage folder permissions on the VPS."
          : friendlyProductError(ProductErrorCode.UPLOAD_FAILED),
        // Safe operational hint for VPS debugging (no stack / no secrets).
        errno: typeof (error as { code?: string })?.code === "string" ? (error as { code: string }).code : undefined,
        detail: detail.slice(0, 180),
      },
      { status: 500 },
    );
  }
}
