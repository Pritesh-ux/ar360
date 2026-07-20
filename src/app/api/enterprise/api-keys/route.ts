import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
} from "@/lib/enterprise/api-keys.service";
import { writeAuditLog } from "@/lib/enterprise/audit.service";
import type { ApiScope } from "@/lib/enterprise/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SCOPES: ApiScope[] = ["products.read", "products.write", "viewer.read", "analytics.read", "assets.write"];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const workspaceUid = req.nextUrl.searchParams.get("workspaceUid") ?? "";
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "api.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const keys = await listApiKeys(workspaceUid);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    workspaceUid?: string;
    name?: string;
    scopes?: string[];
    expiresAt?: string;
  };
  const { workspaceUid = "", name = "", scopes = [], expiresAt } = body;
  if (!workspaceUid || !name) return NextResponse.json({ error: "workspaceUid and name required." }, { status: 400 });

  const validScopes = scopes.filter((s) => VALID_SCOPES.includes(s as ApiScope)) as ApiScope[];
  if (!validScopes.length) return NextResponse.json({ error: "At least one valid scope required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "api.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const { key, rawKey } = await createApiKey({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    createdByUserId: user.id,
    name,
    scopes: validScopes,
    expiresAt: expiresAt ?? null,
  });

  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "api_key.created",
    resourceType: "api_key",
    resourceId: key.key_uid,
    resourceLabel: name,
  });

  // rawKey shown only once
  return NextResponse.json({ key, rawKey }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { workspaceUid?: string; keyUid?: string };
  const { workspaceUid = "", keyUid = "" } = body;
  if (!workspaceUid || !keyUid) return NextResponse.json({ error: "workspaceUid and keyUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "api.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  await revokeApiKey(keyUid, workspaceUid);
  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "api_key.revoked",
    resourceType: "api_key",
    resourceId: keyUid,
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { workspaceUid?: string; keyUid?: string; action?: string };
  const { workspaceUid = "", keyUid = "", action } = body;
  if (!workspaceUid || !keyUid || action !== "rotate") {
    return NextResponse.json({ error: "workspaceUid, keyUid, and action=rotate required." }, { status: 400 });
  }

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "api.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const { rawKey } = await rotateApiKey(keyUid, workspaceUid);
  return NextResponse.json({ rawKey });
}
