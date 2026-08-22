import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertCan, type PermissionAction } from "@/lib/billing/permissions";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_MAP: Record<string, PermissionAction> = {
  upload: "upload",
  upload_product: "create_product",
  create_product: "create_product",
  edit: "upload",
  save: "upload",
  publish: "upload",
  viewer: "viewer",
  ar: "ar",
  qr: "qr",
  share: "share",
  embed: "embed",
  analytics: "analytics",
  object_capture: "object_capture",
  custom_branding: "custom_branding",
  custom_domain: "custom_domain",
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawAction = searchParams.get("action") || "upload";
  const action = ACTION_MAP[rawAction] || "upload";

  const result = await assertCan(user.customerUid, action, {
    isEdit: rawAction === "edit",
  });

  const bandwidthUsedGb = await getCustomerBandwidthUsedGb(user.customerUid).catch(() => 0);
  const ctx = result.context;

  const entitlement = result.allowed
    ? { allowed: true, reason: null, upgradeRequired: false, trialExpired: false, limitType: null }
    : {
        allowed: false,
        reason: (result as { message: string }).message,
        upgradeRequired: (result as { upgradeRequired: boolean }).upgradeRequired,
        trialExpired: (result as { trialExpired?: boolean }).trialExpired ?? false,
        limitType: (result as { limitType?: string }).limitType ?? null,
      };

  const snapshot = {
    customerUid: user.customerUid,
    plan: {
      ...ctx.limits,
      planId: ctx.planId,
      priceMonthlyInr: null as number | null,
      priceYearlyInr: null as number | null,
      features: null as string[] | null,
    },
    usage: {
      productsUsed: ctx.usage.productsUsed,
      modelsUsed: ctx.usage.modelsUsed,
      arExperiencesUsed: ctx.usage.arExperiencesUsed,
      qrCodesUsed: ctx.usage.qrCodesUsed,
      shareLinksUsed: ctx.usage.shareLinksUsed,
      storageUsedMb: ctx.usage.storageUsedMb,
      storageUsedGb: Number((ctx.usage.storageUsedMb / 1024).toFixed(3)),
      bandwidthUsedMb: Number((bandwidthUsedGb * 1024).toFixed(4)),
      bandwidthUsedGb,
      trialStartedAt: null,
      trialEndsAt: ctx.expiresAt,
      currentPeriodEnd: ctx.expiresAt,
      subscriptionStatus: ctx.subscription.reason,
    },
    entitlement,
    action: rawAction,
  };

  return NextResponse.json(
    { success: true, ...snapshot },
    { headers: { "Cache-Control": "no-store" } },
  );
}
