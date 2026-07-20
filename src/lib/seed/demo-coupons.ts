import type { Connection } from "mysql2/promise";
import crypto from "crypto";
import { query } from "@/lib/db";
import { isDemoSeedEnabled } from "@/lib/seed/config";

export type SeedCoupon = {
  code: string;
  description: string;
  discountType: "percentage" | "fixed" | "free_trial";
  discountValue: number;
  usageCount: number;
  usageLimit: number;
  revenueSavedPaise: number;
  expiresAt: string | null;
  status: "active" | "expired" | "disabled";
};

export const DEMO_COUPONS: SeedCoupon[] = [
  { code: "WELCOME20", description: "First purchase 20% off", discountType: "percentage", discountValue: 20, usageCount: 412, usageLimit: 1000, revenueSavedPaise: 8240000, expiresAt: "2025-05-31 23:59:59", status: "active" },
  { code: "SUMMER25", description: "Summer sale discount", discountType: "percentage", discountValue: 25, usageCount: 623, usageLimit: 2000, revenueSavedPaise: 15575000, expiresAt: "2025-08-31 23:59:59", status: "active" },
  { code: "FLAT500", description: "Flat ₹500 off on annual plans", discountType: "fixed", discountValue: 500, usageCount: 189, usageLimit: 500, revenueSavedPaise: 9450000, expiresAt: "2025-06-30 23:59:59", status: "active" },
  { code: "TRIAL14", description: "14-day free trial extension", discountType: "free_trial", discountValue: 14, usageCount: 96, usageLimit: 300, revenueSavedPaise: 4800000, expiresAt: "2025-12-31 23:59:59", status: "active" },
  { code: "PRO15", description: "Professional plan 15% off", discountType: "percentage", discountValue: 15, usageCount: 278, usageLimit: 800, revenueSavedPaise: 4170000, expiresAt: "2025-07-15 23:59:59", status: "active" },
  { code: "NEWUSER10", description: "New user signup discount", discountType: "percentage", discountValue: 10, usageCount: 534, usageLimit: 0, revenueSavedPaise: 2670000, expiresAt: null, status: "active" },
  { code: "ENTERPRISE30", description: "Enterprise onboarding offer", discountType: "percentage", discountValue: 30, usageCount: 45, usageLimit: 100, revenueSavedPaise: 6750000, expiresAt: "2025-09-30 23:59:59", status: "active" },
  { code: "FLAT1000", description: "₹1000 off enterprise yearly", discountType: "fixed", discountValue: 1000, usageCount: 32, usageLimit: 50, revenueSavedPaise: 3200000, expiresAt: "2025-10-31 23:59:59", status: "active" },
  { code: "BASIC5", description: "Basic plan starter discount", discountType: "percentage", discountValue: 5, usageCount: 712, usageLimit: 0, revenueSavedPaise: 1780000, expiresAt: null, status: "active" },
  { code: "REFERRAL20", description: "Referral reward coupon", discountType: "percentage", discountValue: 20, usageCount: 156, usageLimit: 500, revenueSavedPaise: 3120000, expiresAt: "2025-11-30 23:59:59", status: "active" },
  { code: "HOLIDAY50", description: "Holiday season flat discount", discountType: "fixed", discountValue: 750, usageCount: 88, usageLimit: 200, revenueSavedPaise: 6600000, expiresAt: "2024-12-31 23:59:59", status: "expired" },
  { code: "BLACKFRIDAY40", description: "Black Friday 40% off", discountType: "percentage", discountValue: 40, usageCount: 421, usageLimit: 500, revenueSavedPaise: 16840000, expiresAt: "2024-11-30 23:59:59", status: "expired" },
  { code: "DIWALI25", description: "Diwali festival offer", discountType: "percentage", discountValue: 25, usageCount: 367, usageLimit: 400, revenueSavedPaise: 9175000, expiresAt: "2024-11-15 23:59:59", status: "expired" },
  { code: "LAUNCH50", description: "Platform launch celebration", discountType: "percentage", discountValue: 50, usageCount: 500, usageLimit: 500, revenueSavedPaise: 25000000, expiresAt: "2024-06-30 23:59:59", status: "expired" },
  { code: "EARLYBIRD", description: "Early adopter discount", discountType: "fixed", discountValue: 300, usageCount: 200, usageLimit: 200, revenueSavedPaise: 6000000, expiresAt: "2024-05-31 23:59:59", status: "expired" },
  { code: "TRIAL7OLD", description: "Legacy 7-day trial", discountType: "free_trial", discountValue: 7, usageCount: 145, usageLimit: 200, revenueSavedPaise: 2175000, expiresAt: "2024-08-31 23:59:59", status: "expired" },
  { code: "PARTNER15", description: "Partner channel discount", discountType: "percentage", discountValue: 15, usageCount: 67, usageLimit: 150, revenueSavedPaise: 1005000, expiresAt: "2025-04-30 23:59:59", status: "active" },
  { code: "STUDENT20", description: "Student verification offer", discountType: "percentage", discountValue: 20, usageCount: 123, usageLimit: 250, revenueSavedPaise: 2460000, expiresAt: "2025-12-31 23:59:59", status: "active" },
  { code: "UPGRADE10", description: "Plan upgrade incentive", discountType: "percentage", discountValue: 10, usageCount: 89, usageLimit: 300, revenueSavedPaise: 890000, expiresAt: "2025-08-15 23:59:59", status: "active" },
  { code: "FLAT250", description: "Quarterly promo flat off", discountType: "fixed", discountValue: 250, usageCount: 201, usageLimit: 400, revenueSavedPaise: 5025000, expiresAt: "2025-03-31 23:59:59", status: "expired" },
  { code: "WINBACK15", description: "Win-back cancelled users", discountType: "percentage", discountValue: 15, usageCount: 54, usageLimit: 100, revenueSavedPaise: 810000, expiresAt: "2025-06-15 23:59:59", status: "active" },
  { code: "ANNUAL20", description: "Annual billing discount", discountType: "percentage", discountValue: 20, usageCount: 176, usageLimit: 0, revenueSavedPaise: 8800000, expiresAt: null, status: "active" },
  { code: "VIP500", description: "VIP customer appreciation", discountType: "fixed", discountValue: 500, usageCount: 28, usageLimit: 50, revenueSavedPaise: 1400000, expiresAt: "2025-07-31 23:59:59", status: "active" },
  { code: "DISABLED10", description: "Disabled test coupon", discountType: "percentage", discountValue: 10, usageCount: 0, usageLimit: 100, revenueSavedPaise: 0, expiresAt: "2025-12-31 23:59:59", status: "disabled" },
];

function couponUid() {
  return `cpn_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

type ExecFn = Pick<Connection, "execute">;

async function countCoupons(exec: ExecFn) {
  const [rows]: any = await exec.execute("SELECT COUNT(*) AS count FROM coupons");
  return Number(rows[0]?.count || 0);
}

export async function seedDemoCoupons(exec?: ExecFn) {
  if (!isDemoSeedEnabled()) {
    console.log("Skipping demo coupon seed (SEED_DEMO_DATA disabled).");
    return { inserted: 0, skipped: true };
  }

  if (exec) {
    const existing = await countCoupons(exec);
    if (existing > 0) {
      console.log(`Skipping demo coupon seed (${existing} coupons already exist).`);
      return { inserted: 0, skipped: true };
    }

    for (const coupon of DEMO_COUPONS) {
      await exec.execute(
        `INSERT INTO coupons (
          coupon_uid, code, description, discount_type, discount_value,
          usage_count, usage_limit, revenue_saved_paise, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          couponUid(),
          coupon.code,
          coupon.description,
          coupon.discountType,
          coupon.discountValue,
          coupon.usageCount,
          coupon.usageLimit,
          coupon.revenueSavedPaise,
          coupon.expiresAt,
          coupon.status,
        ],
      );
    }
    console.log(`Seeded ${DEMO_COUPONS.length} demo coupons.`);
    return { inserted: DEMO_COUPONS.length, skipped: false };
  }

  const existing = await query<{ count: number }>("SELECT COUNT(*) AS count FROM coupons");
  if (Number(existing[0]?.count || 0) > 0) {
    return { inserted: 0, skipped: true };
  }

  for (const coupon of DEMO_COUPONS) {
    await query(
      `INSERT INTO coupons (
        coupon_uid, code, description, discount_type, discount_value,
        usage_count, usage_limit, revenue_saved_paise, expires_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        couponUid(),
        coupon.code,
        coupon.description,
        coupon.discountType,
        coupon.discountValue,
        coupon.usageCount,
        coupon.usageLimit,
        coupon.revenueSavedPaise,
        coupon.expiresAt,
        coupon.status,
      ],
    );
  }

  return { inserted: DEMO_COUPONS.length, skipped: false };
}
