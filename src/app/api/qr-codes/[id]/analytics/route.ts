import { NextRequest, NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import { getQrAnalytics } from "@/lib/growth/qr.service.impl";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const permission = await enforcePermission(user.customerUid, "qr");
  if (!permission.ok) return permission.response;

  const { id } = await context.params;
  const qrId = Number(id);
  const analytics = await getQrAnalytics(qrId, user.customerUid);
  if (!analytics) return NextResponse.json({ error: "QR not found." }, { status: 404 });

  return NextResponse.json({ success: true, analytics });
}
