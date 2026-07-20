import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";
import {
  getWorkspaceMembers,
  removeMember,
  changeMemberRole,
} from "@/lib/enterprise/workspace.service";
import { writeAuditLog } from "@/lib/enterprise/audit.service";
import { ASSIGNABLE_ROLES, type WorkspaceRole } from "@/lib/enterprise/permissions";
import { hasTeamAddon } from "@/lib/billing/addons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireTeamAddon(customerUid: string | null | undefined) {
  if (!customerUid) {
    return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
  }
  const active = await hasTeamAddon(customerUid);
  if (!active) {
    return NextResponse.json(
      { error: "Team Management module is not active. Please purchase the add-on." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const addonBlock = await requireTeamAddon(user.customerUid);
  if (addonBlock) return addonBlock;

  const workspaceUid = req.nextUrl.searchParams.get("workspaceUid") ?? "";
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "team.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const members = await getWorkspaceMembers(workspaceUid);
  return NextResponse.json({ members });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const addonBlock = await requireTeamAddon(user.customerUid);
  if (addonBlock) return addonBlock;

  const body = await req.json().catch(() => ({})) as { workspaceUid?: string; userId?: number };
  const { workspaceUid = "", userId } = body;
  if (!workspaceUid || !userId) return NextResponse.json({ error: "workspaceUid and userId required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "team.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  // Cannot remove yourself if owner
  if (userId === user.id) return NextResponse.json({ error: "Cannot remove yourself." }, { status: 400 });

  await removeMember(workspaceUid, userId);
  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "member.removed",
    resourceType: "user",
    resourceId: String(userId),
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const addonBlock = await requireTeamAddon(user.customerUid);
  if (addonBlock) return addonBlock;

  const body = await req.json().catch(() => ({})) as { workspaceUid?: string; userId?: number; role?: string };
  const { workspaceUid = "", userId, role } = body;
  if (!workspaceUid || !userId || !role) return NextResponse.json({ error: "workspaceUid, userId, role required." }, { status: 400 });
  if (!ASSIGNABLE_ROLES.includes(role as WorkspaceRole)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "team.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  await changeMemberRole(workspaceUid, userId, role);
  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "member.role_changed",
    resourceType: "user",
    resourceId: String(userId),
    meta: { newRole: role },
  });

  return NextResponse.json({ success: true });
}
