import { NextResponse } from "next/server";
import { trackEmbedView } from "@/lib/growth/embed.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const productId = String(body.productId || "").trim();
  const sessionId = String(body.sessionId || `embed-${Date.now()}`).trim();
  const referrerDomain = String(body.referrerDomain || "").trim();

  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  await trackEmbedView({
    productId,
    sessionId,
    request,
    referrerDomain,
  });

  return NextResponse.json({ success: true });
}
