import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import {
  buildProductShadowReport,
  listProductsForShadowScan,
  runShadowScanAllProducts,
} from "@/lib/platform-versioning/product-config-resolver";
import { resolveProductComponents } from "@/lib/platform-versioning/component-resolver";
import {
  listCanaryProductIds,
  resolveRuntimeModeForProduct,
} from "@/lib/platform-versioning/runtime-selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic for Phase 3/4 shadow resolution + runtime canary status.
 * Mutations for canary use /api/master-admin/ar360/runtime-canary.
 */
export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const productId = (searchParams.get("productId") || "").trim();
    const scanAll = searchParams.get("scanAll") === "1";
    const canaryProductIds = await listCanaryProductIds();

    if (scanAll) {
      const { summary } = await runShadowScanAllProducts(500);
      return NextResponse.json({
        mode: "scan",
        summary,
        canaryProductIds,
        defaultRuntime: "legacy",
        note: "Versioned configuration shadow scan. Default production runtime remains LEGACY.",
      });
    }

    if (productId) {
      const [report, components, selection] = await Promise.all([
        buildProductShadowReport(productId),
        resolveProductComponents(productId),
        resolveRuntimeModeForProduct(productId),
      ]);
      if (!report) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json({
        mode: "product",
        report,
        components,
        runtime: {
          mode: selection.mode,
          reason: selection.reason,
          canary: canaryProductIds.includes(productId),
        },
        canaryProductIds,
        note: "Versioned configuration may be used only when canary is ON for this product.",
      });
    }

    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const products = await listProductsForShadowScan(500);
    const filtered = q
      ? products.filter(
          (p) =>
            p.id.toLowerCase().includes(q) ||
            String(p.title || "")
              .toLowerCase()
              .includes(q) ||
            String(p.customer_uid || "")
              .toLowerCase()
              .includes(q),
        )
      : products;

    return NextResponse.json({
      mode: "list",
      products: filtered.slice(0, 200).map((p) => ({
        id: p.id,
        title: p.title,
        customerUid: p.customer_uid,
        canary: canaryProductIds.includes(p.id),
      })),
      canaryProductIds,
      note: "Default runtime is LEGACY. Pointers alone do not enable VERSIONED.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/product-resolution GET]", error);
    return NextResponse.json({ error: "Unable to load product resolution" }, { status: 500 });
  }
}
