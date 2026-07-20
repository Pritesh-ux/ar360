import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureCouponsSchema } from "@/lib/db";
import { getCouponByUid, getCouponRedemptions } from "@/lib/master-admin/coupons.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("coupons.read");
  if (auth instanceof NextResponse) return auth;

  await ensureCouponsSchema();
  const { id } = await params;
  const coupon = await getCouponByUid(id);
  if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit") || 50)));
  const redemptions = await getCouponRedemptions(id, limit);

  return NextResponse.json({ coupon, redemptions });
}
