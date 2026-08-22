import { NextRequest, NextResponse } from "next/server";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import { getQrCodeByQrCode } from "@/lib/growth/qr.service.impl";
import { getCleanOrigin } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;
  await ensureUserPanelSchema();

  const qr = await getQrCodeByQrCode(publicId);
  const origin = getCleanOrigin(request);
  if (!qr || qr.effectiveStatus !== "active") {
    return NextResponse.redirect(new URL("/link-unavailable", origin));
  }

  const canonical = new URL(`/qr/${encodeURIComponent(qr.qrCode)}`, origin);
  return NextResponse.redirect(canonical, 301);
}
