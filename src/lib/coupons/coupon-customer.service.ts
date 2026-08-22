import { query } from "@/lib/db";

/** Razorpay rejects ₹0; leave at least ₹1 after discount. */
export const MIN_CHECKOUT_PAYABLE_PAISE = 100;

export type CouponValidationResult = {
  valid: false;
  error: string;
} | {
  valid: true;
  couponUid: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountLabel: string;
};

export async function validateCouponForCheckout(
  code: string,
  customerUid?: string,
): Promise<CouponValidationResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, error: "Please enter a coupon code." };

  const rows = await query<{
    coupon_uid: string;
    code: string;
    discount_type: string;
    discount_value: number;
    usage_count: number;
    usage_limit: number;
    expires_at: string | null;
    status: string;
  }>(
    `SELECT coupon_uid, code, discount_type, discount_value, usage_count, usage_limit, expires_at, status
     FROM coupons
     WHERE code = ? LIMIT 1`,
    [normalized],
  );

  const coupon = rows[0];
  if (!coupon) return { valid: false, error: "Invalid coupon code." };
  if (coupon.status !== "active") return { valid: false, error: "This coupon is no longer active." };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, error: "This coupon has expired." };
  }
  if (coupon.usage_limit > 0 && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, error: "This coupon has reached its usage limit." };
  }

  if (customerUid) {
    const prior = await query<{ id: number }>(
      `SELECT id FROM coupon_redemptions WHERE coupon_uid = ? AND customer_uid = ? LIMIT 1`,
      [coupon.coupon_uid, customerUid],
    );
    if (prior.length) {
      return { valid: false, error: "You have already used this coupon." };
    }
  }

  if (coupon.discount_type === "free_trial") {
    return { valid: false, error: "This coupon is for trial extensions only and cannot be applied at checkout." };
  }

  if (coupon.discount_type === "percentage") {
    if (coupon.discount_value <= 0 || coupon.discount_value > 100) {
      return { valid: false, error: "Invalid coupon discount configuration." };
    }
    return {
      valid: true,
      couponUid: coupon.coupon_uid,
      code: coupon.code,
      discountType: "percentage",
      discountValue: coupon.discount_value,
      discountLabel: `${coupon.discount_value}% off`,
    };
  }

  if (coupon.discount_type === "fixed") {
    if (coupon.discount_value <= 0) {
      return { valid: false, error: "Invalid coupon discount configuration." };
    }
    return {
      valid: true,
      couponUid: coupon.coupon_uid,
      code: coupon.code,
      discountType: "fixed",
      discountValue: coupon.discount_value,
      discountLabel: `₹${coupon.discount_value.toLocaleString("en-IN")} off`,
    };
  }

  return { valid: false, error: "Unsupported coupon type." };
}

export function calculateDiscountPaise(
  discountType: "percentage" | "fixed",
  discountValue: number,
  subtotalPaise: number,
): number {
  if (subtotalPaise <= MIN_CHECKOUT_PAYABLE_PAISE) return 0;

  let raw = 0;
  if (discountType === "percentage") {
    raw = Math.round((subtotalPaise * discountValue) / 100);
  } else {
    raw = Math.min(discountValue * 100, subtotalPaise);
  }

  const maxDiscount = Math.max(0, subtotalPaise - MIN_CHECKOUT_PAYABLE_PAISE);
  return Math.min(raw, maxDiscount);
}

function affectedRows(result: unknown): number {
  return Number((result as { affectedRows?: number }).affectedRows || 0);
}

/**
 * Atomically claim a coupon slot + record redemption.
 * Safe under concurrent checkout finalize; one redemption per customer per coupon.
 */
export async function recordCouponRedemption(
  couponUid: string,
  customerUid: string,
  amountSavedPaise: number,
  orderUid?: string | null,
): Promise<{ recorded: boolean; reason?: string }> {
  const existing = await query<{ id: number }>(
    `SELECT id FROM coupon_redemptions WHERE coupon_uid = ? AND customer_uid = ? LIMIT 1`,
    [couponUid, customerUid],
  );
  if (existing.length) {
    return { recorded: false, reason: "already_redeemed" };
  }

  const claim = await query(
    `UPDATE coupons
     SET usage_count = usage_count + 1,
         revenue_saved_paise = revenue_saved_paise + ?
     WHERE coupon_uid = ?
       AND status = 'active'
       AND (usage_limit = 0 OR usage_count < usage_limit)
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [Math.max(0, amountSavedPaise), couponUid],
  );

  if (affectedRows(claim) !== 1) {
    return { recorded: false, reason: "limit_reached" };
  }

  try {
    await query(
      `INSERT INTO coupon_redemptions (coupon_uid, customer_uid, order_uid, amount_saved_paise, redeemed_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [couponUid, customerUid, orderUid || null, Math.max(0, amountSavedPaise)],
    );
    return { recorded: true };
  } catch (err: unknown) {
    // Unique violation or missing order_uid column — try without order_uid
    const message = err instanceof Error ? err.message : String(err);
    if (/order_uid|Unknown column/i.test(message)) {
      try {
        await query(
          `INSERT INTO coupon_redemptions (coupon_uid, customer_uid, amount_saved_paise, redeemed_at)
           VALUES (?, ?, ?, NOW())`,
          [couponUid, customerUid, Math.max(0, amountSavedPaise)],
        );
        return { recorded: true };
      } catch (inner: unknown) {
        await query(
          `UPDATE coupons
           SET usage_count = GREATEST(0, usage_count - 1),
               revenue_saved_paise = GREATEST(0, revenue_saved_paise - ?)
           WHERE coupon_uid = ?`,
          [Math.max(0, amountSavedPaise), couponUid],
        ).catch(() => {});
        if (/Duplicate|ER_DUP_ENTRY/i.test(inner instanceof Error ? inner.message : String(inner))) {
          return { recorded: false, reason: "already_redeemed" };
        }
        throw inner;
      }
    }

    await query(
      `UPDATE coupons
       SET usage_count = GREATEST(0, usage_count - 1),
           revenue_saved_paise = GREATEST(0, revenue_saved_paise - ?)
       WHERE coupon_uid = ?`,
      [Math.max(0, amountSavedPaise), couponUid],
    ).catch(() => {});

    if (/Duplicate|ER_DUP_ENTRY/i.test(message)) {
      return { recorded: false, reason: "already_redeemed" };
    }
    throw err;
  }
}
