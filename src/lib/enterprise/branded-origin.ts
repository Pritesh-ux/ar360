import { resolveBrandedOrigin } from "@/lib/enterprise/domains.service";

function requestOriginFromHeaders(req: Request | { headers: Headers; nextUrl?: { origin: string } }) {
  if ("nextUrl" in req && req.nextUrl?.origin) {
    // Prefer env/app URL for dashboard-originated API calls; branded origin wins later.
  }
  const headers = req.headers;
  const origin = headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const proto = headers.get("x-forwarded-proto") || "http";
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  if ("nextUrl" in req && req.nextUrl?.origin) return req.nextUrl.origin.replace(/\/$/, "");
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Prefer verified primary custom domain for share / QR / embed / publish URLs. */
export async function resolveBrandedOriginForCustomer(
  customerUid: string,
  req?: Request | { headers: Headers; nextUrl?: { origin: string } },
): Promise<string> {
  const fallback = req ? requestOriginFromHeaders(req) : null;
  return resolveBrandedOrigin({ customerUid, fallbackOrigin: fallback });
}
