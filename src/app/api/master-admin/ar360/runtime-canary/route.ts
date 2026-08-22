import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  listCanaryProductIds,
  setProductCanaryRuntime,
  resolveRuntimeModeForProduct,
} from "@/lib/platform-versioning/runtime-selection";
import { resolveProductComponents, validateVersionedRuntimeReady } from "@/lib/platform-versioning/component-resolver";
import { buildProductShadowReport } from "@/lib/platform-versioning/product-config-resolver";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const productId = (new URL(req.url).searchParams.get("productId") || "").trim();
    const canaryIds = await listCanaryProductIds();

    if (!productId) {
      return NextResponse.json({
        canaryProductIds: canaryIds,
        note: "Default runtime is LEGACY. Pointers alone do not enable VERSIONED.",
      });
    }

    const [selection, components, ready, shadow, productRows] = await Promise.all([
      resolveRuntimeModeForProduct(productId),
      resolveProductComponents(productId),
      validateVersionedRuntimeReady(productId),
      buildProductShadowReport(productId),
      query<{ id: string; title: string | null; public_id: string | null; viewer_slug: string | null }>(
        `SELECT id, title, public_id, viewer_slug FROM products WHERE id = ? LIMIT 1`,
        [productId],
      ),
    ]);

    return NextResponse.json({
      productId,
      title: productRows[0]?.title ?? null,
      publicId: productRows[0]?.public_id ?? null,
      viewerSlug: productRows[0]?.viewer_slug ?? null,
      runtimeMode: selection.mode,
      selectionReason: selection.reason,
      canary: canaryIds.includes(productId),
      canaryProductIds: canaryIds,
      components,
      compatibility: {
        pass: ready.ok,
        code: ready.code,
        message: ready.message,
      },
      shadowComparison: shadow?.comparison ?? null,
      fallbackAvailable: true,
      note: "Versioned runtime is canary-only. Production default remains LEGACY.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/runtime-canary GET]", error);
    return NextResponse.json({ error: "Unable to load canary status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const productId = String(body.productId || "").trim();
    const enabled = Boolean(body.enabled);
    const confirm = Boolean(body.confirm);

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!confirm) {
      return NextResponse.json(
        {
          error:
            "Confirmation required. Enabling VERSIONED runtime affects only this product; all others remain LEGACY.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }

    const exists = await query<{ id: string }>(
      `SELECT id FROM products WHERE id = ? LIMIT 1`,
      [productId],
    );
    if (!exists[0]) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (enabled) {
      const ready = await validateVersionedRuntimeReady(productId);
      if (!ready.ok) {
        return NextResponse.json(
          {
            error: `Cannot enable versioned runtime: ${ready.message}`,
            code: ready.code,
          },
          { status: 400 },
        );
      }
    }

    const before = await listCanaryProductIds();
    const result = await setProductCanaryRuntime({ productId, enabled });
    const afterSelection = await resolveRuntimeModeForProduct(productId);

    await logAdminAudit(
      admin,
      enabled ? "ar360.runtime_canary.enabled" : "ar360.runtime_canary.disabled",
      "ar360_runtime_canary",
      productId,
      {
        productId,
        enabled,
        beforeCanaryIds: before,
        afterCanaryIds: result.productIds,
        runtimeMode: afterSelection.mode,
        selectionReason: afterSelection.reason,
      },
    );

    return NextResponse.json({
      productId,
      enabled,
      canaryProductIds: result.productIds,
      flagEnabled: result.flagEnabled,
      runtimeMode: afterSelection.mode,
      selectionReason: afterSelection.reason,
      warning:
        "Canary change only. Global stable release is NOT activated. Other products remain LEGACY.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/runtime-canary POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update canary" },
      { status: 500 },
    );
  }
}
