import { NextRequest, NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import { getQrCodeById, updateCustomerQrCode } from "@/lib/growth/qr.service.impl";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gateUser() {
  const user = await requireScopedApiUser();
  if (!user) return { error: rejectScopedApiUser() };
  const permission = await enforcePermission(user.customerUid, "qr");
  if (!permission.ok) return { error: permission.response };
  return { user };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await gateUser();
  if ("error" in gate && gate.error) return gate.error;

  const { id } = await context.params;
  const qrId = Number(id);
  if (!Number.isFinite(qrId)) return NextResponse.json({ error: "Invalid QR id." }, { status: 400 });

  const qr = await getQrCodeById(qrId, gate.user!.customerUid, gate.user!.id, request.nextUrl.origin);
  if (!qr) return NextResponse.json({ error: "QR not found." }, { status: 404 });

  return NextResponse.json({ success: true, qrCode: qr });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await gateUser();
  if ("error" in gate && gate.error) return gate.error;

  const { id } = await context.params;
  const qrId = Number(id);
  const body = await request.json().catch(() => ({}));

  const result = await updateCustomerQrCode({
    customerUid: gate.user!.customerUid,
    userId: gate.user!.id,
    id: qrId,
    patch: {
      foregroundColor: body.foregroundColor,
      backgroundColor: body.backgroundColor,
      patternStyle: body.patternStyle,
      cornerStyle: body.cornerStyle,
      logoUrl: body.logoUrl,
      logoSize: body.logoSize,
      frameEnabled: body.frameEnabled,
      frameStyle: body.frameStyle,
      frameColor: body.frameColor,
      frameText: body.frameText,
    },
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ success: true });
}
