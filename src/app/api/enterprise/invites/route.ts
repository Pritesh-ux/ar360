import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";
import {
  createInvite,
  listInvites,
  revokeInvite,
  acceptInvite,
} from "@/lib/enterprise/invite.service";
import { writeAuditLog } from "@/lib/enterprise/audit.service";
import { ASSIGNABLE_ROLES, type WorkspaceRole } from "@/lib/enterprise/permissions";
import { hasTeamManagementAccess } from "@/lib/billing/addons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireTeamAddon(customerUid: string | null | undefined) {
  if (!customerUid) {
    return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
  }
  const active = await hasTeamManagementAccess(customerUid);
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

  const invites = await listInvites(workspaceUid);
  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const addonBlock = await requireTeamAddon(user.customerUid);
  if (addonBlock) return addonBlock;

  const body = await req.json().catch(() => ({})) as { workspaceUid?: string; email?: string; role?: string };
  const { workspaceUid = "", email = "", role = "viewer" } = body;

  if (!workspaceUid || !email) return NextResponse.json({ error: "workspaceUid and email required." }, { status: 400 });
  if (!ASSIGNABLE_ROLES.includes(role as WorkspaceRole)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "team.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const invite = await createInvite({
    workspaceUid,
    invitedByUserId: user.id,
    email,
    role: role as WorkspaceRole,
  });

  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "member.invited",
    resourceType: "invite",
    resourceId: String(invite.id),
    resourceLabel: email,
    meta: { role },
  });

  return NextResponse.json({ invite }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const addonBlock = await requireTeamAddon(user.customerUid);
  if (addonBlock) return addonBlock;

  const body = await req.json().catch(() => ({})) as { workspaceUid?: string; inviteId?: number };
  const { workspaceUid = "", inviteId } = body;
  if (!workspaceUid || !inviteId) return NextResponse.json({ error: "workspaceUid and inviteId required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "team.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  await revokeInvite(inviteId, workspaceUid);
  return NextResponse.json({ success: true });
}

// Accept invite — no workspace membership required yet
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { token?: string };
  const { token = "" } = body;
  if (!token) return NextResponse.json({ error: "token required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await acceptInvite(token, user.id);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
