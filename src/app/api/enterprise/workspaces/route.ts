import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import {
  getWorkspacesForUser,
  ensureDefaultWorkspace,
} from "@/lib/enterprise/workspace.service";
import { requireActiveSubscriptionApi } from "@/lib/subscription/api-subscription-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const gate = await requireActiveSubscriptionApi(user.customerUid ?? "");
  if (!gate.ok) return gate.response;

  await ensureAppSchema();
  const ws = await ensureDefaultWorkspace({
    userId: user.id,
    customerUid: user.customerUid ?? "",
    name: user.name ?? "My Workspace",
  });
  const workspaces = await getWorkspacesForUser(user.id);

  return NextResponse.json({ workspaces, defaultWorkspaceUid: ws.workspace_uid });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const gate = await requireActiveSubscriptionApi(user.customerUid ?? "");
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({})) as { name?: string };
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });

  await ensureAppSchema();
  const { createWorkspace } = await import("@/lib/enterprise/workspace.service");
  const workspace = await createWorkspace({
    name,
    ownerUserId: user.id,
    customerUid: user.customerUid ?? "",
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
