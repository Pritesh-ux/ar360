import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import {
  countActiveSubscriptionsForPlan,
  deleteBillingPlan,
  getBillingPlans,
  replaceBillingPlans,
  upsertBillingPlan,
  type AdminBillingPlan,
} from "@/lib/billing/admin-plans";
import { getRazorpayRuntimeConfig } from "@/lib/billing/razorpay-config";
import { syncConfiguredRazorpayPlanPrices } from "@/server/billing/razorpay-plan.service";
import { getPlanProviderControls } from "@/lib/master-admin/production-billing.service";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validatePlan(input: Partial<AdminBillingPlan>) {
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim();
  if (!id || !/^[a-z0-9_-]{2,40}$/.test(id)) return "Use a valid plan ID (2–40 lowercase letters, numbers, _ or -).";
  if (!name) return "Plan name is required.";
  if (name.length > 80) return "Plan name is too long.";

  const nonNegative: Array<[string, unknown]> = [
    ["Monthly price", input.priceMonthlyInr],
    ["Yearly price", input.priceYearlyInr],
    ["Storage", input.storageGb],
    ["Bandwidth", input.bandwidthGb],
    ["Products", input.products],
    ["Trial hours", input.trialHours],
    ["QR limit", input.qrLimit],
    ["Share link limit", input.shareLinkLimit],
    ["Sort order", input.sortOrder],
  ];
  for (const [label, value] of nonNegative) {
    if (value == null) continue;
    if (!Number.isFinite(Number(value)) || Number(value) < 0) return `${label} cannot be negative.`;
  }
  if (input.products != null && !Number.isInteger(Number(input.products))) return "Products must be a whole number.";
  if (input.qrLimit != null && !Number.isInteger(Number(input.qrLimit))) return "QR limit must be a whole number.";
  if (input.shareLinkLimit != null && !Number.isInteger(Number(input.shareLinkLimit))) {
    return "Share link limit must be a whole number.";
  }
  return null;
}

export async function GET() {
  const auth = await guardAdminPermission(["billing.read", "settings.read"]);
  if (auth instanceof NextResponse) return auth;
  const [plans, providerControls] = await Promise.all([getBillingPlans(), getPlanProviderControls()]);
  return NextResponse.json({ success: true, plans, providerControls }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const reason = String(body.reason || "").trim();
  if (body.confirm !== true || reason.length < 5) {
    return NextResponse.json({ success: false, message: "Confirmation and a reason of at least 5 characters are required." }, { status: 400 });
  }

  if (!Array.isArray(body.plans)) {
    return NextResponse.json({ success: false, message: "plans array is required" }, { status: 400 });
  }
  const ids = new Set<string>();
  for (const rawPlan of body.plans as Partial<AdminBillingPlan>[]) {
    const validationError = validatePlan(rawPlan);
    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }
    const id = String(rawPlan.id);
    if (ids.has(id)) {
      return NextResponse.json({ success: false, message: `Duplicate plan ID: ${id}` }, { status: 409 });
    }
    ids.add(id);
  }

  const plans = await replaceBillingPlans(body.plans);
  const razorpay = await getRazorpayRuntimeConfig();
  if (razorpay.keyId && razorpay.hasKeySecret) {
    for (const plan of plans) await syncConfiguredRazorpayPlanPrices(plan);
  }
  return NextResponse.json({ success: true, plans });
}

export async function POST(request: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim();
    if (body.confirm !== true || reason.length < 5) {
      return NextResponse.json({ success: false, message: "Confirmation and a reason of at least 5 characters are required." }, { status: 400 });
    }
    const rawPlan = (body.plan || body) as Partial<AdminBillingPlan>;
    const originalId = body.originalId ? String(body.originalId) : null;
    const validationError = validatePlan(rawPlan);
    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }

    const planId = String(rawPlan.id);
    if (planId === "enterprise") {
      if (rawPlan.priceMonthlyInr != null || rawPlan.priceYearlyInr != null) {
        return NextResponse.json(
          { success: false, message: "Enterprise is manual-only and cannot have provider pricing." },
          { status: 400 },
        );
      }
      rawPlan.salesChannel = "manual";
    }
    const existingPlans = await getBillingPlans();
    const existing = existingPlans.find((item) => item.id === planId);
    if (originalId && originalId !== planId) {
      return NextResponse.json(
        { success: false, message: "Plan ID cannot be changed after creation." },
        { status: 400 },
      );
    }
    if (!originalId && existing) {
      return NextResponse.json(
        { success: false, message: "A plan with this ID already exists." },
        { status: 409 },
      );
    }

    if (existing?.isActive && rawPlan.isActive === false && !body.confirmDeactivate) {
      const activeSubscriptions = await countActiveSubscriptionsForPlan(planId);
      if (activeSubscriptions > 0) {
        return NextResponse.json(
          {
            success: false,
            code: "PLAN_IN_USE",
            activeSubscriptions,
            message: `${activeSubscriptions} active subscription${activeSubscriptions === 1 ? "" : "s"} use this plan.`,
          },
          { status: 409 },
        );
      }
    }

    const plan = await upsertBillingPlan(rawPlan);
    const razorpay = await getRazorpayRuntimeConfig();
    let providerSyncWarning: string | null = null;
    if (razorpay.keyId && razorpay.hasKeySecret) {
      try {
        await syncConfiguredRazorpayPlanPrices(plan);
      } catch (syncError) {
        console.error("[master-admin/billing/plans] provider sync failed", syncError);
        providerSyncWarning =
          syncError instanceof Error
            ? syncError.message
            : "Plan saved, but Razorpay price sync failed.";
      }
    }
    try {
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "billing.plan_publish",
        entityType: "billing_plan",
        entityId: planId,
        metadata: {
          reason,
          providerMode: razorpay.mode,
          immutablePriceVersion: true,
          providerSyncWarning,
        },
      });
    } catch (auditError) {
      console.error("[master-admin/billing/plans] audit failed", auditError);
    }
    const plans = await getBillingPlans();
    return NextResponse.json({
      success: true,
      plan,
      plans,
      warning: providerSyncWarning,
    });
  } catch (error) {
    console.error("[master-admin/billing/plans] save failed", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to save plan.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(request.url);
    const planId = url.searchParams.get("id");
    if (!planId) {
      return NextResponse.json({ success: false, message: "Plan ID is required." }, { status: 400 });
    }

    const activeSubscriptions = await countActiveSubscriptionsForPlan(planId);
    if (activeSubscriptions > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete plan: ${activeSubscriptions} active subscription(s) are using it.`,
        },
        { status: 409 },
      );
    }

    await deleteBillingPlan(planId);
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "billing.plan_delete",
      entityType: "billing_plan",
      entityId: planId,
      metadata: {},
    }).catch(() => {});

    const plans = await getBillingPlans();
    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error("[master-admin/billing/plans DELETE]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to delete plan.",
      },
      { status: 500 },
    );
  }
}
