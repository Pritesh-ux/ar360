import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  getWorkspaceByDomain,
  markSslActiveFromHttpsHost,
} from "@/lib/enterprise/domains.service";
import {
  getPlatformHosts,
  normalizeRequestHost,
} from "@/lib/enterprise/custom-domain-headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function internalKeyOk(req: NextRequest) {
  const expected = process.env.AR360_INTERNAL_KEY;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error("AR360_INTERNAL_KEY is not set. Internal APIs are inaccessible in production.");
      return false;
    }
    // Dev fallback — only when explicitly unset
    return req.headers.get("x-ar360-internal-key") === "ar360-dev-internal";
  }
  const provided = req.headers.get("x-ar360-internal-key") || "";
  if (!provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

/**
 * Edge middleware calls this to resolve a verified custom domain → workspace.
 * Not matched by customer-auth middleware.
 */
export async function GET(req: NextRequest) {
  if (!internalKeyOk(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const host = normalizeRequestHost(req.nextUrl.searchParams.get("host"));
  if (!host || getPlatformHosts().has(host)) {
    return NextResponse.json({ matched: false });
  }

  const row = await getWorkspaceByDomain(host).catch(() => null);
  if (!row) return NextResponse.json({ matched: false });

  const proto = req.nextUrl.searchParams.get("proto") || "https";
  if (proto === "https") {
    void markSslActiveFromHttpsHost(host);
  }

  return NextResponse.json({
    matched: true,
    workspaceUid: row.workspace_uid,
    customerUid: row.customer_uid,
    domain: row.domain,
  });
}
