import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { formatTrialDurationLabel, normalizeTrialHours } from "@/lib/billing/plan-enforcement";
import { resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getPlanDisplayName } from "@/lib/billing/plans";
import { updateCustomerOnboarding } from "@/lib/onboarding/onboarding.service";
import { checkSubscription } from "@/lib/subscription/check-subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Preview/dismiss helper for the first-time free trial welcome popup. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  const [limits, subscription] = await Promise.all([
    resolvePlanLimits("trial"),
    checkSubscription(user.customerUid).catch(() => null),
  ]);
  const trialHours = normalizeTrialHours(limits.trialHours);
  const trialDays = Math.max(1, Math.round(trialHours / 24));
  const planId = String(subscription?.plan?.id || "").toLowerCase();
  const onTrial = planId === "trial" || planId === "free";

  return NextResponse.json({
    success: true,
    trialWelcome: {
      show: true,
      planName: getPlanDisplayName("trial", limits.name),
      trialLabel: formatTrialDurationLabel(trialHours),
      trialDays,
      daysRemaining: onTrial ? subscription?.daysRemaining ?? trialDays : trialDays,
      expiresAt: onTrial ? subscription?.expiresAt || null : null,
      productsLimit: limits.products ?? null,
      storageLimitMb: limits.storageMb ?? null,
      bandwidthLimitMb: limits.bandwidthGb ? limits.bandwidthGb * 1024 : null,
      unlimitedStorage: Boolean(limits.unlimitedStorage),
      unlimitedBandwidth: Boolean(limits.unlimitedBandwidth),
    },
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  await updateCustomerOnboarding(user.customerUid, { welcomePopupDismissed: true });
  return NextResponse.json({ success: true });
}
