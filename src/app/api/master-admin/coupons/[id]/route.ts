import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureCouponsSchema } from "@/lib/db";
import {
  activateCoupon,
  deleteCoupons,
  disableCoupon,
  duplicateCoupon,
  getCouponByUid,
  updateCoupon,
} from "@/lib/master-admin/coupons.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("coupons.read");
  if (auth instanceof NextResponse) return auth;

  await ensureCouponsSchema();
  const { id } = await params;
  const coupon = await getCouponByUid(id);
  if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  return NextResponse.json({ coupon });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("coupons.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureCouponsSchema();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").toLowerCase();

  try {
    if (action === "disable") {
      await disableCoupon(id, admin.id);
    } else if (action === "activate") {
      await activateCoupon(id, admin.id);
    } else if (action === "duplicate") {
      const newUid = await duplicateCoupon(id, admin.id);
      const coupon = await getCouponByUid(newUid);
      await logAdminAudit(admin, "coupon.duplicate", "coupon", newUid, { duplicatedFrom: id });
      return NextResponse.json({ ok: true, coupon, duplicatedFrom: id });
    } else {
      await updateCoupon(
        id,
        {
          code: body.code,
          description: body.description,
          discountType: body.discountType,
          discountValue: body.discountValue != null ? Number(body.discountValue) : undefined,
          usageLimit: body.usageLimit != null ? Number(body.usageLimit) : undefined,
          expiresAt: body.expiresAt,
          status: body.status,
        },
        admin.id,
      );
    }

    const coupon = await getCouponByUid(id);
    if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    await logAdminAudit(admin, `coupon.${action || "update"}`, "coupon", id);
    return NextResponse.json({ ok: true, coupon });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("coupons.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureCouponsSchema();
  const { id } = await params;

  try {
    const result = await deleteCoupons([id], admin.id);
    if (result.deleted === 0) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }
    await logAdminAudit(admin, "coupon.delete", "coupon", id);
    return NextResponse.json({ ok: true, deleted: result.deleted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 400 },
    );
  }
}
