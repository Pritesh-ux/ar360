import { NextRequest, NextResponse } from "next/server";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import { getQrCodeByQrCode, trackQrScan } from "@/lib/growth/qr.service.impl";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionFromRequest(request: NextRequest) {
  const cookie = request.cookies.get("ar360_qr_sess")?.value;
  if (cookie) return cookie;
  return `qr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;
  await ensureUserPanelSchema();

  const qr = await getQrCodeByQrCode(publicId);
  if (!qr || qr.effectiveStatus !== "active") {
    return NextResponse.redirect(new URL("/404", request.url));
  }

  const canonical = new URL(`/qr/${encodeURIComponent(qr.qrCode)}`, request.url);
  return NextResponse.redirect(canonical, 301);
}
