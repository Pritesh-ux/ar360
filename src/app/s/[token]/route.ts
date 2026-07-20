import { NextRequest, NextResponse } from "next/server";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import { recordShareLinkView, resolveShareLinkAccess } from "@/lib/user-panel/share-links.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  await ensureUserPanelSchema();

  const password = request.nextUrl.searchParams.get("p") || request.nextUrl.searchParams.get("password");
  const access = await resolveShareLinkAccess({
    token,
    origin: request.nextUrl.origin,
    password,
  });

  if (!access.ok) {
    if (access.reason === "password" && access.link) {
      const unlock = new URL(request.url);
      unlock.pathname = `/s/${token}/unlock`;
      return NextResponse.redirect(unlock);
    }
    return NextResponse.redirect(new URL("/404", request.url));
  }

  await recordShareLinkView(access.link, request.headers.get("referer") || "", request);

  const target = new URL(access.link.destinationUrl);
  if (!target.searchParams.get("source")) {
    target.searchParams.set("source", "share");
  }
  return NextResponse.redirect(target);
}
