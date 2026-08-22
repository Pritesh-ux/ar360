import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, ensureAdminSchema, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("admins.manage");
  if (auth instanceof NextResponse) return auth;

  await Promise.all([ensureAppSchema(), ensureAdminSchema()]);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").trim();
  const customerUid = String(body.customerUid || "").trim();

  if (!action || !customerUid) {
    return NextResponse.json({ error: "action and customerUid are required." }, { status: 400 });
  }

  try {
    switch (action) {
      case "block_ip": {
        await query("UPDATE customers SET status = 'Suspended', updated_at = NOW() WHERE customer_uid = ?", [customerUid]);
        await query("DELETE FROM customer_sessions WHERE customer_uid = ?", [customerUid]).catch(() => {});
        break;
      }
      case "unlock": {
        await query("UPDATE customers SET status = 'Active', updated_at = NOW() WHERE customer_uid = ?", [customerUid]);
        break;
      }
      case "force_logout": {
        await query("DELETE FROM customer_sessions WHERE customer_uid = ?", [customerUid]).catch(() => {});
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    await logAdminAudit(auth.admin, `login_log.${action}`, "customer", customerUid);
    return NextResponse.json({ ok: true, action, customerUid });
  } catch (error) {
    console.error("[master-admin/login-logs]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 },
    );
  }
}
