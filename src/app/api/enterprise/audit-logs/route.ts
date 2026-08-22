import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";
import { getAuditLogs, countAuditLogs } from "@/lib/enterprise/audit.service";
import { requireActiveSubscriptionApi } from "@/lib/subscription/api-subscription-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const gate = await requireActiveSubscriptionApi(user.customerUid ?? "");
  if (!gate.ok) return gate.response;

  const p = req.nextUrl.searchParams;
  const workspaceUid = p.get("workspaceUid") ?? "";
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "audit.read");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const filter = {
    workspaceUid,
    userId: p.get("userId") ? Number(p.get("userId")) : undefined,
    action: p.get("action") ?? undefined,
    resourceId: p.get("resourceId") ?? undefined,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : 50,
    offset: p.get("offset") ? Number(p.get("offset")) : 0,
  };

  const [logs, total] = await Promise.all([
    getAuditLogs(filter),
    countAuditLogs(filter),
  ]);

  return NextResponse.json({ logs, total });
}
