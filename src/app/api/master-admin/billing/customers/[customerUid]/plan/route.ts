import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getBillingPlans, getCustomerPlan, setCustomerPlan } from "@/lib/billing/admin-plans";
import { getCustomerProductionBilling } from "@/lib/master-admin/production-billing.service";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ customerUid: string }>;

export async function GET(_request: Request, context: { params: Params }) {
  const auth = await guardAdminPermission("subscriptions.read");
  if (auth instanceof NextResponse) return auth;
  const { customerUid } = await context.params;
  const [subscription, plans, production] = await Promise.all([
    getCustomerPlan(customerUid).catch(() => null),
    getBillingPlans({ activeOnly: true }).catch(() => []),
    getCustomerProductionBilling(customerUid).catch(() => null),
  ]);
  return NextResponse.json({
    success: true,
    customerUid,
    subscription,
    plans,
    production,
  });
}

export async function PUT(request: Request, context: { params: Params }) {
  const auth = await guardAdminPermission("subscriptions.update");
  if (auth instanceof NextResponse) return auth;
  const { customerUid } = await context.params;
  const body = await request.json();
  const planId = String(body.planId || "").trim();
  const reason = String(body.reason || "").trim();

  if (!planId) {
    return NextResponse.json({ success: false, message: "planId is required" }, { status: 400 });
  }
  if (body.confirm !== true || reason.length < 5) {
    return NextResponse.json({ success: false, message: "Confirmation and a reason of at least 5 characters are required." }, { status: 400 });
  }
  const current = await getCustomerProductionBilling(customerUid);
  if (current.subscription?.provider_subscription_id) {
    return NextResponse.json({ success: false, message: "Provider-managed subscriptions must be changed through Razorpay lifecycle controls." }, { status: 409 });
  }
  if (planId === "enterprise" && body.salesChannel !== "manual") {
    return NextResponse.json({ success: false, message: "Enterprise is manual-only and requires salesChannel=manual." }, { status: 400 });
  }

  const subscription = await setCustomerPlan({
    customerUid,
    planId,
    status: body.status,
    trialHours: body.trialHours ?? undefined,
    periodDays: body.periodDays ?? undefined,
    trialStartedAt: body.trialStartedAt ?? undefined,
    trialEndsAt: body.trialEndsAt ?? undefined,
    currentPeriodStart: body.currentPeriodStart ?? undefined,
    currentPeriodEnd: body.currentPeriodEnd ?? undefined,
  });
  await writeMasterAdminAudit({
    adminId: auth.admin.id,
    action: "billing.customer_plan_override",
    entityType: "customer_subscription",
    entityId: customerUid,
    metadata: { reason, planId, status: body.status, manualEnterprise: planId === "enterprise" },
  });

  return NextResponse.json({ success: true, subscription });
}
