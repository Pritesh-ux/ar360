import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";
import {
  addDomain,
  getDomainInstructions,
  listDomains,
  removeDomain,
  setPrimaryDomain,
  verifyDomain,
} from "@/lib/enterprise/domains.service";
import { writeAuditLog } from "@/lib/enterprise/audit.service";
import { enforcePermission } from "@/lib/billing/api-permission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gateDomainAccess(user: { id: number; customerUid?: string | null }, workspaceUid: string) {
  const permission = await enforcePermission(user.customerUid ?? "", "custom_domain");
  if (!permission.ok) return { error: permission.response };
  try {
    await requirePermission(user.id, workspaceUid, "domains.manage");
  } catch (e) {
    return { error: rbacErrorResponse(e) };
  }
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const workspaceUid = req.nextUrl.searchParams.get("workspaceUid") ?? "";
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  const gate = await gateDomainAccess(user, workspaceUid);
  if ("error" in gate && gate.error) return gate.error;

  const domains = await listDomains(workspaceUid);
  return NextResponse.json({
    domains,
    instructions: domains.map((row) => getDomainInstructions(row)),
    domainTarget: process.env.AR360_DOMAIN_TARGET || "domains.ar360.app",
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    workspaceUid?: string;
    domain?: string;
    action?: string;
    domainId?: number;
  };
  const { workspaceUid = "", domain = "", action } = body;
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  const gate = await gateDomainAccess(user, workspaceUid);
  if ("error" in gate && gate.error) return gate.error;

  if (action === "set_primary") {
    if (!body.domainId) return NextResponse.json({ error: "domainId required." }, { status: 400 });
    try {
      const record = await setPrimaryDomain(body.domainId, workspaceUid);
      if (!record) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
      return NextResponse.json({ domain: record, instructions: getDomainInstructions(record) });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 400 });
    }
  }

  if (!domain) return NextResponse.json({ error: "workspaceUid and domain required." }, { status: 400 });

  try {
    const record = await addDomain({ workspaceUid, customerUid: user.customerUid ?? "", domain });
    await writeAuditLog({
      workspaceUid,
      customerUid: user.customerUid ?? "",
      userId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      action: "domain.added",
      resourceType: "domain",
      resourceId: String(record.id),
      resourceLabel: domain,
    });
    return NextResponse.json(
      { domain: record, instructions: getDomainInstructions(record) },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { workspaceUid?: string; domainId?: number };
  const { workspaceUid = "", domainId } = body;
  if (!workspaceUid || !domainId) {
    return NextResponse.json({ error: "workspaceUid and domainId required." }, { status: 400 });
  }

  await ensureAppSchema();
  const gate = await gateDomainAccess(user, workspaceUid);
  if ("error" in gate && gate.error) return gate.error;

  await removeDomain(domainId, workspaceUid);
  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "domain.removed",
    resourceType: "domain",
    resourceId: String(domainId),
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    workspaceUid?: string;
    domainId?: number;
    action?: string;
  };
  const { workspaceUid = "", domainId } = body;
  if (!workspaceUid || !domainId) {
    return NextResponse.json({ error: "workspaceUid and domainId required." }, { status: 400 });
  }

  await ensureAppSchema();
  const gate = await gateDomainAccess(user, workspaceUid);
  if ("error" in gate && gate.error) return gate.error;

  if (body.action === "set_primary") {
    try {
      const record = await setPrimaryDomain(domainId, workspaceUid);
      if (!record) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
      return NextResponse.json({ domain: record, instructions: getDomainInstructions(record) });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 400 });
    }
  }

  const result = await verifyDomain(domainId, workspaceUid);
  if (result.verified) {
    await writeAuditLog({
      workspaceUid,
      customerUid: user.customerUid ?? "",
      userId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      action: "domain.verified",
      resourceType: "domain",
      resourceId: String(domainId),
    });
  }
  return NextResponse.json(result);
}
