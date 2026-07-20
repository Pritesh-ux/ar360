import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureCouponsSchema } from "@/lib/db";
import {
  createCoupon,
  exportCouponsCsv,
  getCouponAnalytics,
  getCouponByUid,
  listCoupons,
  type CouponFilterParams,
} from "@/lib/master-admin/coupons.service";
import { paginationMeta } from "@/lib/master-admin/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFilters(searchParams: URLSearchParams): CouponFilterParams {
  return {
    search: (searchParams.get("search") || "").trim(),
    status: (searchParams.get("status") || "all").trim(),
    type: (searchParams.get("type") || "all").trim(),
    validFrom: searchParams.get("validFrom") || undefined,
    validTo: searchParams.get("validTo") || undefined,
    createdFrom: searchParams.get("createdFrom") || undefined,
    createdTo: searchParams.get("createdTo") || undefined,
  };
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("coupons.read");
  if (auth instanceof NextResponse) return auth;

  await ensureCouponsSchema();

  const { searchParams } = new URL(req.url);
  const filters = parseFilters(searchParams);

  if (searchParams.get("export") === "csv") {
    const exportAuth = await guardAdminPermission(["coupons.read", "exports.download"]);
    if (exportAuth instanceof NextResponse) return exportAuth;
    try {
      const csv = await exportCouponsCsv(filters);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="coupons-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    } catch (error) {
      console.error("[master-admin/coupons export]", error);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 10)));

  try {
    const [{ coupons, pagination }, analytics] = await Promise.all([
      listCoupons({ ...filters, page, pageSize }),
      getCouponAnalytics(filters),
    ]);

    return NextResponse.json({
      coupons,
      pagination,
      summary: analytics.summary,
      analytics: analytics.analytics,
    });
  } catch (error) {
    console.error("[master-admin/coupons]", error);
    return NextResponse.json({
      coupons: [],
      pagination: paginationMeta(0, 1, pageSize),
      summary: {
        activeCoupons: 0,
        totalUsed: 0,
        expiredCoupons: 0,
        revenueSaved: 0,
        totalCount: 0,
        redemptionValueInRange: 0,
      },
      analytics: { typeBreakdown: [], topPerforming: [], revenueDaily: [], chartFrom: "", chartTo: "" },
      error: "Unable to load coupons",
    });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("coupons.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureCouponsSchema();
  const body = await req.json().catch(() => ({}));

  try {
    const couponUid = await createCoupon(
      {
        code: String(body.code || ""),
        description: String(body.description || ""),
        discountType: body.discountType || "percentage",
        discountValue: Number(body.discountValue || 0),
        usageLimit: Number(body.usageLimit || 0),
        expiresAt: body.expiresAt || null,
        status: body.status || "active",
      },
      admin.id,
    );

    const coupon = await getCouponByUid(couponUid);
    return NextResponse.json({ ok: true, coupon }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Create failed" },
      { status: 400 },
    );
  }
}
