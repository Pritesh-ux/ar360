import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCouponsSchema } from "@/lib/db";
import { validateCouponForCheckout, calculateDiscountPaise } from "@/lib/coupons/coupon-customer.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    await ensureCouponsSchema();

    const body = await req.json();
    const code = String(body.code || "").trim();
    const amountPaise = Number(body.amountPaise || 0);

    if (!code) return NextResponse.json({ error: "Enter a coupon code." }, { status: 400 });

    const result = await validateCouponForCheckout(code, user.customerUid);
    if (!result.valid) {
      return NextResponse.json({ valid: false, error: "error" in result ? result.error : "Invalid coupon." }, { status: 400 });
    }

    let discountPaise = 0;
    if (amountPaise > 0) {
      discountPaise = calculateDiscountPaise(result.discountType, result.discountValue, amountPaise);
    }

    return NextResponse.json({
      valid: true,
      code: result.code,
      discountType: result.discountType,
      discountValue: result.discountValue,
      discountLabel: result.discountLabel,
      discountPaise,
    });
  } catch (error) {
    console.error("[billing/validate-coupon]", error);
    return NextResponse.json({ error: "Coupon validation failed." }, { status: 500 });
  }
}
