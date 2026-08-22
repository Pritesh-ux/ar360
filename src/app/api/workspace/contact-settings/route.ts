import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import { planAllowsProductContact } from "@/lib/billing/plan-enforcement";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import {
  getDefaultWorkspaceUid,
  getWorkspaceContactSettings,
  updateWorkspaceContactSettings,
} from "@/lib/viewer-contact/workspace-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const permission = await enforcePermission(user.customerUid, "access_dashboard");
  if (!permission.ok) return permission.response;

  const result = await getWorkspaceContactSettings(user.customerUid);
  const allowed = Boolean(permission.context.limits && planAllowsProductContact(permission.context.limits));
  return NextResponse.json({
    workspaceUid: result.workspaceUid,
    settings: result.settings,
    allowed,
  });
}

export async function PATCH(request: Request) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const permission = await enforcePermission(user.customerUid, "product_contact");
  if (!permission.ok) return permission.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceUid =
    String(body.workspaceUid || "").trim() || (await getDefaultWorkspaceUid(user.customerUid));
  if (!workspaceUid) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 400 });
  }

  try {
    const settings = await updateWorkspaceContactSettings(workspaceUid, user.customerUid, {
      whatsappNumber: body.whatsappNumber != null ? String(body.whatsappNumber) : undefined,
      whatsappEnabled: body.whatsappEnabled != null ? Boolean(body.whatsappEnabled) : undefined,
      enquireEnabled: body.enquireEnabled != null ? Boolean(body.enquireEnabled) : undefined,
      enquireLabel: body.enquireLabel != null ? String(body.enquireLabel) : undefined,
      whatsappLabel: body.whatsappLabel != null ? String(body.whatsappLabel) : undefined,
    });
    return NextResponse.json({ workspaceUid, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save contact settings.";
    const status = message.includes("valid WhatsApp") ? 400 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
