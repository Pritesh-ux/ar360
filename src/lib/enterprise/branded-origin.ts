import { resolveBrandedOrigin } from "@/lib/enterprise/domains.service";
import { getCleanOrigin } from "@/lib/url";

function requestOriginFromHeaders(req: Request | { headers: Headers; nextUrl?: { origin: string } }) {
  let headersObj: Headers | null = null;
  if (req && "headers" in req && req.headers instanceof Headers) {
    headersObj = req.headers;
  }
  return getCleanOrigin(headersObj || (req as Request));
}

/** Prefer verified primary custom domain for share / QR / embed / publish URLs. */
export async function resolveBrandedOriginForCustomer(
  customerUid: string,
  req?: Request | { headers: Headers; nextUrl?: { origin: string } },
): Promise<string> {
  const fallback = req ? requestOriginFromHeaders(req) : null;
  return resolveBrandedOrigin({ customerUid, fallbackOrigin: fallback });
}
