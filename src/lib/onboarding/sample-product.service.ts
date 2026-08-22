import { readFile, stat } from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { createProductUid } from "@/lib/uid";
import {
  createProductFolder,
  ensureCustomerFolder,
  updateProductJson,
} from "@/lib/localCustomerStorage";
import { writeProductFile, getSecureProductPath } from "@/lib/storage";
import {
  checkEnterpriseModelLimit,
  checkProductLimit,
  checkStorageLimit,
} from "@/lib/billing/limit-enforcement";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { OnboardingErrorCode } from "@/lib/onboarding/onboarding-errors";
import { getCustomerOnboarding, updateCustomerOnboarding } from "@/lib/onboarding/onboarding.service";
import { createSampleGlbBuffer } from "@/lib/onboarding/sample-glb";
import { logOnboardingEvent } from "@/lib/onboarding/activity";

const SAMPLE_TITLE = "AR360 Sample Chair";

/** Prefer real authored models — `chair.glb` in-repo is a tiny placeholder (~6KB). */
const SAMPLE_MODEL_CANDIDATES = ["chair_01.glb", "LOCK GLB.glb"] as const;
const MIN_REAL_MODEL_BYTES = 50_000;

async function readSampleModelBuffer() {
  for (const fileName of SAMPLE_MODEL_CANDIDATES) {
    const diskPath = path.join(process.cwd(), "public", "models", fileName);
    try {
      const data = await readFile(diskPath);
      if (data.byteLength >= MIN_REAL_MODEL_BYTES) return data;
    } catch {
      // try next candidate
    }
  }
  console.warn("[sample-product] Real chair model missing; using generated placeholder GLB.");
  return createSampleGlbBuffer();
}

async function refreshSampleProductModel(input: {
  customerUid: string;
  productUid: string;
  modelBuffer: Buffer;
}) {
  const modelUrl = await writeProductFile({
    customerUid: input.customerUid,
    productUid: input.productUid,
    fileName: "model.glb",
    data: input.modelBuffer,
  });

  await updateProductJson({
    customerUid: input.customerUid,
    productUid: input.productUid,
    patch: {
      modelUrl,
      fileName: "model.glb",
      updatedAt: new Date().toISOString(),
    },
  });

  await query(
    `UPDATE products
        SET model_url = ?, file_name = 'model.glb', updated_at = NOW()
      WHERE id = ? AND customer_uid = ? AND deleted_at IS NULL
      LIMIT 1`,
    [modelUrl, input.productUid, input.customerUid],
  );

  return modelUrl;
}

async function shouldRefreshSampleModel(customerUid: string, productUid: string) {
  try {
    const filePath = getSecureProductPath(customerUid, productUid, "model.glb");
    const info = await stat(filePath);
    return info.size < MIN_REAL_MODEL_BYTES;
  } catch {
    return true;
  }
}

export type SampleProductResult =
  | { ok: true; productId: string; alreadyExists: boolean }
  | { ok: false; code: OnboardingErrorCode; message: string };

/** Create a customer-owned sample product — idempotent per onboarding record. */
export async function createCustomerSampleProduct(input: {
  customerUid: string;
  userId: number;
  userName: string;
  userEmail: string;
}): Promise<SampleProductResult> {
  const onboarding = await getCustomerOnboarding(input.customerUid);
  if (onboarding?.sampleProductId) {
    const productId = onboarding.sampleProductId;
    if (await shouldRefreshSampleModel(input.customerUid, productId)) {
      const modelBuffer = await readSampleModelBuffer();
      if (modelBuffer.byteLength >= MIN_REAL_MODEL_BYTES) {
        try {
          await refreshSampleProductModel({
            customerUid: input.customerUid,
            productUid: productId,
            modelBuffer,
          });
        } catch (error) {
          console.error("[sample-product] could not refresh placeholder model", error);
        }
      }
    }
    return { ok: true, productId, alreadyExists: true };
  }

  const existingSample = await query<{ id: string }>(
    `SELECT id FROM products
      WHERE customer_uid = ? AND deleted_at IS NULL AND title = ?
      LIMIT 1`,
    [input.customerUid, SAMPLE_TITLE],
  );
  if (existingSample[0]) {
    const productId = existingSample[0].id;
    if (await shouldRefreshSampleModel(input.customerUid, productId)) {
      const modelBuffer = await readSampleModelBuffer();
      if (modelBuffer.byteLength >= MIN_REAL_MODEL_BYTES) {
        try {
          await refreshSampleProductModel({
            customerUid: input.customerUid,
            productUid: productId,
            modelBuffer,
          });
        } catch (error) {
          console.error("[sample-product] could not refresh placeholder model", error);
        }
      }
    }
    await updateCustomerOnboarding(input.customerUid, {
      sampleProductCreated: true,
      sampleProductId: productId,
      preferredCreationMethod: "sample",
      completed: true,
    });
    return { ok: true, productId, alreadyExists: true };
  }

  const plan = await resolveCustomerPlanLimits(input.customerUid);
  const [productLimit, modelLimit] = await Promise.all([
    checkProductLimit(input.customerUid, String(plan.planId)),
    checkEnterpriseModelLimit(input.customerUid, plan),
  ]);
  if (productLimit.ok === false) {
    return { ok: false, code: OnboardingErrorCode.PRODUCT_LIMIT_REACHED, message: productLimit.message };
  }
  if (modelLimit.ok === false) {
    return { ok: false, code: OnboardingErrorCode.PRODUCT_LIMIT_REACHED, message: modelLimit.message };
  }

  const modelBuffer = await readSampleModelBuffer();
  const storageLimit = await checkStorageLimit(
    input.customerUid,
    modelBuffer.length,
    0,
    String(plan.planId),
  );
  if (storageLimit.ok === false) {
    return { ok: false, code: OnboardingErrorCode.STORAGE_LIMIT_REACHED, message: storageLimit.message };
  }

  const productUid = createProductUid();

  try {
    await ensureCustomerFolder({
      customerUid: input.customerUid,
      userId: String(input.userId),
      name: input.userName,
      email: input.userEmail,
    });

    const product = await createProductFolder({
      customerUid: input.customerUid,
      title: SAMPLE_TITLE,
      category: "Sample",
      productUid,
    });

    const modelUrl = await writeProductFile({
      customerUid: input.customerUid,
      productUid: product.productUid,
      fileName: "model.glb",
      data: modelBuffer,
    });

    await updateProductJson({
      customerUid: input.customerUid,
      productUid: product.productUid,
      patch: {
        id: product.productUid,
        productUid: product.productUid,
        customerUid: input.customerUid,
        title: SAMPLE_TITLE,
        category: "Sample",
        status: "Draft",
        modelUrl,
        fileName: "model.glb",
        folder: "All",
        views: 0,
        isSample: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    await query(
      `INSERT INTO products
         (id, customer_uid, user_id, title, category, model_url, file_name, product_folder, status, views)
       VALUES (?, ?, ?, ?, 'Sample', ?, 'model.glb', 'All', 'Draft', 0)`,
      [product.productUid, input.customerUid, input.userId, SAMPLE_TITLE, modelUrl],
    );

    await updateCustomerOnboarding(input.customerUid, {
      sampleProductCreated: true,
      sampleProductId: product.productUid,
      preferredCreationMethod: "sample",
      completed: true,
    });

    await logOnboardingEvent({
      customerUid: input.customerUid,
      eventType: "sample_product_created",
      title: "Sample product created",
      meta: { productId: product.productUid },
    });

    return { ok: true, productId: product.productUid, alreadyExists: false };
  } catch (error) {
    console.error("[sample-product] failed", error);
    return {
      ok: false,
      code: OnboardingErrorCode.SAMPLE_PRODUCT_CREATION_FAILED,
      message: "Could not create the sample product. Please try again.",
    };
  }
}
