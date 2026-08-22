import { NextRequest, NextResponse } from "next/server";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import { recordShareLinkView, resolveShareLinkAccess } from "@/lib/user-panel/share-links.service";
import { resolveClientUidForDelivery } from "@/lib/user-panel/resolve-client-for-product";
import { getCleanOrigin, sanitizeUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  await ensureUserPanelSchema();

  const password = request.nextUrl.searchParams.get("p") || request.nextUrl.searchParams.get("password");
  const origin = getCleanOrigin(request);
  const access = await resolveShareLinkAccess({
    token,
    origin,
    password,
  });

  if (!access.ok) {
    if (access.reason === "password" && access.link) {
      const unlock = new URL(`/s/${token}/unlock`, origin);
      return NextResponse.redirect(unlock);
    }
    return NextResponse.redirect(new URL("/link-unavailable", origin));
  }

  await recordShareLinkView(access.link, request.headers.get("referer") || "", request);

  const target = new URL(sanitizeUrl(access.link.destinationUrl));
  if (!target.searchParams.get("source")) {
    target.searchParams.set("source", "share");
  }
  if (!target.searchParams.get("client") && access.link.productId) {
    const linkedClientUid = await resolveClientUidForDelivery({
      productId: access.link.productId,
    });
    if (linkedClientUid) {
      target.searchParams.set("client", linkedClientUid);
    }
  }
  return NextResponse.redirect(target);
}
