import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import { requireMembership, rbacErrorResponse } from "@/lib/enterprise/rbac";
import {
  ensureUsageCounters,
  getUsageCounters,
  getUsageDaily,
  getPlanLimits,
} from "@/lib/enterprise/usage.service";
import { getWorkspaceByUid } from "@/lib/enterprise/workspace.service";
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
    await requireMembership(user.id, workspaceUid);
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const workspace = await getWorkspaceByUid(workspaceUid);
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  await ensureUsageCounters(workspaceUid, user.customerUid ?? "");
  const counters = await getUsageCounters(workspaceUid);
  const limits = getPlanLimits(workspace.plan);

  const from = p.get("from") ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = p.get("to") ?? new Date().toISOString().slice(0, 10);
  const daily = await getUsageDaily(workspaceUid, from, to);

  return NextResponse.json({ counters, limits, daily, plan: workspace.plan });
}
