import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema, query } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";
import {
  listProductVersions,
  getProductVersion,
  saveProductVersion,
} from "@/lib/enterprise/versions.service";
import { writeAuditLog } from "@/lib/enterprise/audit.service";
import fs from "fs/promises";
import path from "path";
import { requireActiveSubscriptionApi } from "@/lib/subscription/api-subscription-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const gate = await requireActiveSubscriptionApi(user.customerUid ?? "");
  if (!gate.ok) return gate.response;

  const p = req.nextUrl.searchParams;
  const productUid = p.get("productUid") ?? "";
  const workspaceUid = p.get("workspaceUid") ?? "";
  if (!productUid || !workspaceUid) return NextResponse.json({ error: "productUid and workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "versions.read");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const versionId = p.get("versionId");
  if (versionId) {
    const version = await getProductVersion(Number(versionId), productUid, user.customerUid ?? "");
    return NextResponse.json({ version });
  }

  const versions = await listProductVersions(productUid, user.customerUid ?? "");
  return NextResponse.json({ versions });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const gate = await requireActiveSubscriptionApi(user.customerUid ?? "");
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({})) as {
    workspaceUid?: string;
    productUid?: string;
    label?: string;
    snapshot?: Record<string, unknown>;
  };
  const { workspaceUid = "", productUid = "", label, snapshot } = body;
  if (!workspaceUid || !productUid || !snapshot) {
    return NextResponse.json({ error: "workspaceUid, productUid, snapshot required." }, { status: 400 });
  }

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "products.update");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const version = await saveProductVersion({
    productUid,
    customerUid: user.customerUid ?? "",
    workspaceUid,
    createdByUserId: user.id,
    label,
    snapshot,
  });

  return NextResponse.json({ version }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  // Restore a version
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const gate = await requireActiveSubscriptionApi(user.customerUid ?? "");
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({})) as {
    workspaceUid?: string;
    productUid?: string;
    versionId?: number;
  };
  const { workspaceUid = "", productUid = "", versionId } = body;
  if (!workspaceUid || !productUid || !versionId) {
    return NextResponse.json({ error: "workspaceUid, productUid, versionId required." }, { status: 400 });
  }

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "versions.restore");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const version = await getProductVersion(versionId, productUid, user.customerUid ?? "");
  if (!version) return NextResponse.json({ error: "Version not found." }, { status: 404 });

  // Write snapshot back to product.json
  const { getProductFolder } = await import("@/lib/localCustomerStorage");
  const folder = getProductFolder(user.customerUid ?? "", productUid);
  const filePath = path.join(folder, "product.json");
  await fs.writeFile(filePath, version.snapshot, "utf8");

  // Update MySQL product record
  const snap = JSON.parse(version.snapshot) as Record<string, unknown>;
  await query(
    `UPDATE products SET title = ?, status = ?, updated_at = NOW() WHERE id = ? AND customer_uid = ?`,
    [String(snap.title ?? ""), String(snap.status ?? "Draft"), productUid, user.customerUid ?? ""],
  );

  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "version.restored",
    resourceType: "product",
    resourceId: productUid,
    meta: { versionId, versionNumber: version.version_number },
  });

  return NextResponse.json({ success: true, version });
}
