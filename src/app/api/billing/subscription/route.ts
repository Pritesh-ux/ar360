import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSubscriptionContext } from "@/lib/billing/subscription-engine";
import { getCustomerSubscription, startTrialSubscription } from "@/server/billing/subscription.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  let subscription = await getCustomerSubscription(user.customerUid);
  if (!subscription) {
    subscription = await startTrialSubscription(user.customerUid);
  }

  const context = await getSubscriptionContext(user.customerUid);
  const usage = context.usage.customerUsage;

  return NextResponse.json({
    success: true,
    subscription,
    context: {
      planId: context.planId,
      planName: context.limits.name,
      active: context.subscription.active,
      reason: context.subscription.reason,
      daysRemaining: context.daysRemaining,
      renewAt: context.renewAt,
      expiresAt: context.expiresAt,
      billingPeriod: context.billingPeriod,
      cancelAtPeriodEnd: context.cancelAtPeriodEnd,
      isEnterpriseCustom: context.isEnterpriseCustom,
      limits: {
        products: context.limits.products,
        storageMb: context.limits.storageMb,
        bandwidthGb: context.limits.bandwidthGb,
        qrCodes: context.limits.qrCodes,
        shareLinks: context.limits.shareLinks,
        allowObjectCapture: context.limits.allowObjectCapture !== false,
        allowCustomBranding: context.limits.allowCustomBranding,
        advancedAnalytics: Boolean(context.limits.advancedAnalytics),
        unlimitedStorage: Boolean(context.limits.unlimitedStorage),
        unlimitedBandwidth: Boolean(context.limits.unlimitedBandwidth),
      },
      usage: {
        products: usage.products,
        storage: usage.storage,
        bandwidth: usage.bandwidth,
        qrCodes: usage.qrCodes,
        shareLinks: usage.shareLinks,
      },
    },
  });
}
