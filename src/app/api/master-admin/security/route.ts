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
      case "lock": {
        await query("UPDATE customers SET status = 'Suspended', updated_at = NOW() WHERE customer_uid = ?", [customerUid]);
        await query(
          `UPDATE users u INNER JOIN customers c ON c.user_id = u.id
           SET u.status = 'Suspended' WHERE c.customer_uid = ?`,
          [customerUid],
        );
        await query("DELETE FROM customer_sessions WHERE customer_uid = ?", [customerUid]).catch(() => {});
        break;
      }
      case "unlock": {
        await query("UPDATE customers SET status = 'Active', updated_at = NOW() WHERE customer_uid = ?", [customerUid]);
        await query(
          `UPDATE users u INNER JOIN customers c ON c.user_id = u.id
           SET u.status = 'Active' WHERE c.customer_uid = ? AND u.status = 'Suspended'`,
          [customerUid],
        );
        break;
      }
      case "block": {
        await query("UPDATE customers SET status = 'Suspended', updated_at = NOW() WHERE customer_uid = ?", [customerUid]);
        await query(
          `UPDATE users u INNER JOIN customers c ON c.user_id = u.id
           SET u.status = 'Suspended' WHERE c.customer_uid = ?`,
          [customerUid],
        );
        await query("DELETE FROM customer_sessions WHERE customer_uid = ?", [customerUid]).catch(() => {});
        break;
      }
      case "force_logout": {
        await query("DELETE FROM customer_sessions WHERE customer_uid = ?", [customerUid]).catch(() => []);
        break;
      }
      case "reset_failed_logins": {
        const emailRows = await query<{ email: string }>("SELECT email FROM customers WHERE customer_uid = ? LIMIT 1", [customerUid]);
        if (emailRows[0]?.email) {
          await query("DELETE FROM auth_login_logs WHERE email = ? AND status = 'failed'", [emailRows[0].email]);
        }
        break;
      }
      case "toggle_2fa": {
        const userRows = await query<{ id: number; two_factor_enabled: number }>(
          "SELECT u.id, u.two_factor_enabled FROM users u INNER JOIN customers c ON c.user_id = u.id WHERE c.customer_uid = ? LIMIT 1",
          [customerUid],
        );
        if (userRows[0]) {
          const newVal = userRows[0].two_factor_enabled ? 0 : 1;
          await query("UPDATE users SET two_factor_enabled = ? WHERE id = ?", [newVal, userRows[0].id]);
        }
        break;
      }
      case "revoke_api_keys": {
        await query("UPDATE api_keys SET status = 'revoked', updated_at = NOW() WHERE customer_uid = ? AND status != 'revoked'", [customerUid]).catch(() => {});
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    await logAdminAudit(auth.admin, `security.${action}`, "customer", customerUid);
    return NextResponse.json({ ok: true, action, customerUid });
  } catch (error) {
    console.error("[master-admin/security]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 },
    );
  }
}
