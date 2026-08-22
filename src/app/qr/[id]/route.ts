import { NextRequest, NextResponse } from "next/server";
import { getQrCodeByQrCode, trackQrScan } from "@/lib/growth/qr.service.impl";
import { query } from "@/lib/db";
import { getCleanOrigin } from "@/lib/url";
import { resolveClientUidForDelivery } from "@/lib/user-panel/resolve-client-for-product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionFromRequest(request: NextRequest) {
  const cookie = request.cookies.get("ar360_qr_sess")?.value;
  if (cookie) return cookie;
  return `qr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const qrCode = decodeURIComponent(id || "").trim();
  const origin = getCleanOrigin(request);
  if (!qrCode) return NextResponse.redirect(new URL("/link-unavailable", origin));

  const qr = await getQrCodeByQrCode(qrCode);
  if (!qr || qr.effectiveStatus !== "active") {
    return NextResponse.redirect(new URL("/link-unavailable", origin));
  }

  const productRows = await query<{ public_id: string | null; status: string }>(
    `SELECT public_id, status FROM products WHERE id = ? LIMIT 1`,
    [qr.productId],
  );
  const product = productRows[0];
  if (!product || !["published", "active"].includes(String(product.status).toLowerCase())) {
    return NextResponse.redirect(new URL("/link-unavailable", origin));
  }

  const sessionId = sessionFromRequest(request);
  await trackQrScan({
    qrCodeId: qr.qrCodeId,
    qrCode: qr.qrCode,
    customerUid: qr.customerUid,
    productId: qr.productId,
    sessionId,
    request,
  });

  const viewerId = product.public_id || qr.productId;
  const target = new URL(`/viewer/${encodeURIComponent(viewerId)}`, origin);
  target.searchParams.set("source", "qr");
  target.searchParams.set("landing", "1");

  const linkedClientUid = await resolveClientUidForDelivery({
    productId: qr.productId,
    qrResourceIds: [qr.qrCode, qr.qrUid, qr.publicId].filter(Boolean),
  });
  if (linkedClientUid) {
    target.searchParams.set("client", linkedClientUid);
  }

  const response = NextResponse.redirect(target);
  if (!request.cookies.get("ar360_qr_sess")) {
    response.cookies.set("ar360_qr_sess", sessionId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}
