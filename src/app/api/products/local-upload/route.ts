import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { clientCustomerScopeIsValid, normalizeScopedId } from "@/lib/customerIsolation";
import {
  createProductFolder,
  ensureCustomerFolder,
  updateProductJson,
} from "@/lib/localCustomerStorage";
import { ensureAppSchema, query } from "@/lib/db";
import {
  validateUploadedFile,
  writeProductFile,
  recalculateCustomerStorage,
  StorageValidationError,
  StorageSecurityError,
  getSecureProductPath,
} from "@/lib/storage";
import { validateGlbUpload } from "@/lib/products/glb-validator";
import { ProductErrorCode, friendlyProductError } from "@/lib/products/product-errors";
import { rollbackProductUpload } from "@/lib/products/upload-rollback";
import fs from "fs/promises";

export const runtime = "nodejs";


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
  try {
    await ensureAppSchema();
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
        product.publicFolder,
        product.status ?? "processing",
      ],
    );
  } catch (error) {
    console.warn("[local-upload] MySQL sync skipped:", error);
  }
}

import { BillingErrorCode } from "@/lib/billing/billing-errors";
import { enforcePermission } from "@/lib/billing/api-permission";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";
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

    const productLimitCheck = await checkProductLimit(user.customerUid ?? "", resolvedPlanId);
    if (productLimitCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: productLimitCheck.code, error: productLimitCheck.message },
        { status: 403 },
      );
    }

    const modelLimitCheck = await checkEnterpriseModelLimit(user.customerUid ?? "", plan);
    if (modelLimitCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: modelLimitCheck.code, error: modelLimitCheck.message },
        { status: 403 },
      );
    }

    const modelSize = model ? model.size : 0;
    const usdzSize = usdz ? usdz.size : 0;
    const uploadSizeMb = (modelSize + usdzSize) / 1024 / 1024;

    const storageLimitCheck = await checkStorageLimit(user.customerUid ?? "", modelSize + usdzSize, 0, resolvedPlanId);
    if (storageLimitCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: storageLimitCheck.code, error: storageLimitCheck.message },
        { status: 403 },
      );
    }

    const usage = {
      productsUsed: Number(billing.products_used || 0),
      storageUsedMb: Number(billing.storage_used_mb || 0),
      bandwidthUsedGb: await getCustomerBandwidthUsedGb(user.customerUid ?? ""),
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
        { success: false, code: ProductErrorCode.INVALID_GLB, error: "GLB model file is required." },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json({ success: false, error: "Product name is required." }, { status: 400 });
    }

    // ── 4. File type + size validation ────────────────────────────────────────
    validateUploadedFile(model);
    if (usdz) validateUploadedFile(usdz);

    if (!model.name.toLowerCase().endsWith(".glb")) {
      return NextResponse.json(
        { success: false, code: ProductErrorCode.INVALID_GLB, error: "Only .glb model file is allowed." },
        { status: 400 },
      );
    }

    const modelBuffer = Buffer.from(await model.arrayBuffer());
    const glbCheck = validateGlbUpload({
      buffer: modelBuffer,
      fileName: model.name,
      mimeType: model.type,
      sizeBytes: model.size,
    });
    if (glbCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: glbCheck.code, error: glbCheck.message },
        { status: 400 },
      );
    }

    // ── 6. Ensure customer folder exists ─────────────────────────────────────
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
      await syncProductToMysql({
        productUid: product.productUid,
        customerUid: customer.customerUid,
        title,
        category,
        description: description || undefined,
        publicFolder: product.publicFolder,
        userId: user.id,
        status: "processing",
      });

      const modelUrl = await writeProductFile({
        customerUid: customer.customerUid,
        productUid: product.productUid,
        fileName: "model.glb",
        data: modelBuffer,
      });

      const modelDiskPath = getSecureProductPath(
        customer.customerUid,
        product.productUid,
        "model.glb",
      );
      await fs.access(modelDiskPath);

      let usdzUrl = "";
      let usdzFileName = "";

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
          usdzUrl: usdzUrl || undefined,
          usdzFileName: usdzFileName || undefined,
          publicFolder: product.publicFolder,
          status: "draft",
          activeVariantId: "default",
          initialZoom: 100,
          fov: 45,
          cameraOrbit: "35deg 58deg 100%",
          cameraTarget: "auto auto auto",
          backgroundType: "solid",
          variants: [
            {
              id: "default",
              name: "Default",
              materialSettings: {},
              environmentImage: "neutral",
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
              initialZoom: 100,
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
        status: "draft",
      });

      uploadCommitted = true;
      recalculateCustomerStorage(customer.customerUid).catch((err) =>
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
          usdzUrl: usdzUrl || undefined,
          usdzFileName: usdzFileName || undefined,
          folder: "All",
          poster: "",
          views: 0,
          status: "Draft",
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
    return NextResponse.json(
      {
        success: false,
        code: ProductErrorCode.UPLOAD_FAILED,
        error: friendlyProductError(ProductErrorCode.UPLOAD_FAILED),
      },
      { status: 500 },
    );
  }
}
