import { NextRequest, NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import { regenerateQrAsset } from "@/lib/growth/qr.service.impl";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { resolveBrandedOriginForCustomer } from "@/lib/enterprise/branded-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const permission = await enforcePermission(user.customerUid, "qr");
  if (!permission.ok) return permission.response;

  const { id } = await context.params;
  const qrId = Number(id);
  const origin = await resolveBrandedOriginForCustomer(user.customerUid, request);

  const result = await regenerateQrAsset({
    customerUid: user.customerUid,
    userId: user.id,
    qrId,
    origin,
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ success: true, qrLinkUrl: result.qrLinkUrl });
}
