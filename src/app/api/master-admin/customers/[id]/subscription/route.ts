import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import {
  ensureBillingPlanSchema,
  getBillingPlans,
  getCustomerPlan,
  setCustomerPlan,
} from "@/lib/billing/admin-plans";
import {
  applySubscriptionChangeForPlan,
  cancelCustomerSubscription,
  pauseCustomerSubscription,
  resumeCustomerSubscription,
} from "@/server/billing/subscription.service";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";
import { assertAdminPlanOverrideAllowed } from "@/lib/billing/admin-plan-override-guard";
import { SubscriptionLifecycleError } from "@/server/billing/provider-subscription.service";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import {
  sendExpiryEmail,
  sendPlanChangedEmail,
} from "@/lib/email/customer-lifecycle.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

export async function GET(_req: NextRequest, context: Context) {
  const auth = await guardAdminPermission("subscriptions.read");
  if (auth instanceof NextResponse) return auth;

  await ensureBillingPlanSchema();
  const { id } = await context.params;
  const [subscription, plans, customerRows] = await Promise.all([
    getCustomerPlan(id),
    getBillingPlans({ activeOnly: true }),
    query<{ customer_uid: string; contact_name: string; company_name: string | null; email: string; plan_id: string; status: string }>(
      `SELECT customer_uid, contact_name, company_name, email, plan_id, status FROM customers WHERE customer_uid = ? LIMIT 1`,
      [id],
    ).catch(() => []),
  ]);

  return NextResponse.json({ customer: customerRows[0] || null, subscription, plans });
}

export async function POST(req: NextRequest, context: Context) {
  const auth = await guardAdminPermission("subscriptions.update");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const denied = await guardBillingMutation(req, `admin:${String((admin as any).id || "")}`);
  if (denied) return denied;

  await ensureBillingPlanSchema();
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const reason = String(body.reason || "").trim();
  if (body.confirm !== true || reason.length < 5) {
    return NextResponse.json({ error: "Explicit confirmation and a reason of at least 5 characters are required." }, { status: 400 });
  }
  const audit = (metadata?: Record<string, unknown>) => writeMasterAdminAudit({
    adminId: admin.id,
    action: `billing.subscription_${action}`,
    entityType: "customer_subscription",
    entityId: id,
    metadata: { reason, ...metadata },
  });

  if (action === "assign_plan") {
    const planId = String(body.planId || "").trim();
    const status = String(body.status || "active") as SubscriptionStatus;
    if (!planId) return NextResponse.json({ error: "planId is required" }, { status: 400 });

    const blocked = await assertAdminPlanOverrideAllowed(id);
    if (blocked) return blocked;

    const subscription = await setCustomerPlan({ customerUid: id, planId, status });
    await audit({ planId, status });
    return NextResponse.json({ subscription });
  }

  if (action === "extend_trial") {
    const blocked = await assertAdminPlanOverrideAllowed(id);
    if (blocked) return blocked;
    const hours = Math.max(1, Math.min(Number(body.hours || 24), 24 * 365));
    const current = await getCustomerPlan(id);
    const planId = current?.planId || "trial";
    const now = new Date();
    const trialEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);

    await applySubscriptionChangeForPlan({
      customerUid: id,
      planId,
      status: "trialing",
      trialStartedAt: now,
      trialEndsAt: trialEnd,
      cancelAtPeriodEnd: false,
    });

    await audit({ hours, trialEndsAt: trialEnd.toISOString() });
    await sendPlanChangedEmail({
      customerUid: id,
      planId,
      status: "trialing",
      periodEnd: trialEnd,
      eventKey: `trial-extension:${trialEnd.toISOString()}`,
    }).catch(() => undefined);
    return NextResponse.json({ subscription: await getCustomerPlan(id) });
  }

  if (action === "suspend") {
    try {
      const subscription = await cancelCustomerSubscription(id, false, {
        type: "admin", id: String((admin as any).id || ""),
      });
      await audit({ providerFirst: true, confirmedProviderMutation: true });
      return NextResponse.json({ subscription });
    } catch (error) {
      if (error instanceof SubscriptionLifecycleError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      }
      throw error;
    }
  }

  if (action === "pause") {
    try {
      const subscription = await pauseCustomerSubscription(id, {
        type: "admin", id: String((admin as any).id || ""),
      });
      await audit({ providerFirst: true, confirmedProviderMutation: true });
      return NextResponse.json({ subscription });
    } catch (error) {
      if (error instanceof SubscriptionLifecycleError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      }
      throw error;
    }
  }

  if (action === "expire") {
    const blocked = await assertAdminPlanOverrideAllowed(id);
    if (blocked) return blocked;
    const status: SubscriptionStatus = "expired";
    const current = await getCustomerPlan(id);
    await applySubscriptionChangeForPlan({
      customerUid: id,
      planId: current?.planId || "trial",
      status,
    });
    await audit({ status });
    await sendExpiryEmail({
      customerUid: id,
      kind: current?.status === "trialing" ? "trial" : "plan",
      planId: current?.planId || "trial",
      expiresAt: new Date(),
      daysRemaining: 0,
      eventKey: `admin:${Date.now()}`,
    }).catch(() => undefined);
    return NextResponse.json({ subscription: await getCustomerPlan(id) });
  }

  if (action === "resume") {
    try {
      const subscription = await resumeCustomerSubscription(id, {
        type: "admin", id: String((admin as any).id || ""),
      });
      await audit({ providerFirst: true, confirmedProviderMutation: true });
      return NextResponse.json({ subscription });
    } catch (error) {
      if (error instanceof SubscriptionLifecycleError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      }
      throw error;
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
