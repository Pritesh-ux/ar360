import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { getPlanProviderControls, refreshBillingAdminAlerts } from "@/lib/master-admin/production-billing.service";
import { runProviderReconciliationBatch } from "@/server/billing/provider-reconciliation.service";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("billing.read", { request: req });
  if (auth instanceof NextResponse) return auth;
  const [plans, alerts] = await Promise.all([getPlanProviderControls(), refreshBillingAdminAlerts()]);
  return NextResponse.json({ plans, alerts });
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission(["billing.refund", "subscriptions.update", "settings.manage"], { request: req });
  if (auth instanceof NextResponse) return auth;
  const denied = await guardBillingMutation(req, `admin:${auth.admin.id}`);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const reason = String(body.reason || "").trim();
  if (body.confirm !== true || reason.length < 5) {
    return NextResponse.json({ error: "Explicit confirmation and a reason of at least 5 characters are required." }, { status: 400 });
  }

  let result: unknown;
  const entityId = String(body.customerUid || body.alertUid || "billing");
  if (action === "reconcile") {
    if (body.customerUid) {
      await query("UPDATE customer_subscriptions SET reconciliation_required = 1 WHERE customer_uid = ?", [String(body.customerUid)]);
    }
    result = await runProviderReconciliationBatch(body.customerUid ? 1 : Math.min(100, Math.max(1, Number(body.limit || 50))));
  } else if (action === "resolve_alert") {
    await query(`UPDATE billing_admin_alerts SET status='resolved', resolved_at=NOW()
      WHERE alert_uid = ?`, [String(body.alertUid || "")]);
    result = { resolved: true };
  } else {
    return NextResponse.json({ error: "Unsupported billing control action." }, { status: 400 });
  }

  await writeMasterAdminAudit({
    adminId: auth.admin.id,
    action: `billing.${action}`,
    entityType: action === "resolve_alert" ? "billing_alert" : "billing_reconciliation",
    entityId,
    metadata: { reason, result },
  });
  return NextResponse.json({ success: true, result });
}

