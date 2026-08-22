import { NextResponse, type NextRequest } from "next/server";
import {
  CUSTOM_DOMAIN_CUSTOMER_HEADER,
  CUSTOM_DOMAIN_HOST_HEADER,
  CUSTOM_DOMAIN_WORKSPACE_HEADER,
  getPlatformHosts,
  isPublicCustomDomainPath,
  normalizeRequestHost,
} from "@/lib/enterprise/custom-domain-headers";
import {
  generateCsrfToken,
  isCsrfCookieValid,
  setCsrfCookie,
  verifyCsrfToken,
  extractCsrfFromCookie,
  extractCsrfFromRequest,
} from "@/lib/csrf";
import { getCleanOrigin } from "@/lib/url";

const CUSTOMER_SESSION_COOKIE = "ar360_customer_session";
const ADMIN_SESSION_COOKIE = "ar360_master_admin_session";
/** Raw session token forwarded from httpOnly cookie. Verified in Node (auth.ts). */
export const ADMIN_TOKEN_HEADER = "x-ar360-admin-token";
export const ADMIN_ID_HEADER = "x-ar360-admin-id";
/** Forwarded for server layouts (e.g. expired-subscription exempt routes). */
export const PATHNAME_HEADER = "x-ar360-pathname";
/** Cookie mirror of PATHNAME_HEADER — request-header forwarding is unreliable in some Next builds. */
export const PATHNAME_COOKIE = "ar360_pathname";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/** Paths exempt from CSRF validation (webhooks, public APIs, health checks). */
const CSRF_EXEMPT_PATHS = [
  "/api/billing/webhook/",
  "/api/internal/",
  "/api/health",
  "/api/ready",
  "/api/db/health",
  "/api/public-products/",
  "/api/embed/",
  "/api/assets/",
  "/api/analytics/event",
  "/q/",
  "/qr/",
];

function hasSignedTokenShape(value?: string) {
  if (!value) return false;
  const parts = value.split(".");
  return parts.length === 2 && parts[0].length > 10 && parts[1].length > 10;
}

function redirectUsingRequestHost(request: NextRequest, pathname: string, search?: string) {
  const origin = getCleanOrigin(request);
  const url = new URL(pathname + (search || ""), origin);
  return NextResponse.redirect(url);
}

function withForwardedAdminToken(request: NextRequest, adminToken?: string) {
  const requestHeaders = new Headers(request.headers);
  // Never trust client-supplied auth headers.
  requestHeaders.delete(ADMIN_TOKEN_HEADER);
  requestHeaders.delete(ADMIN_ID_HEADER);
  requestHeaders.set(PATHNAME_HEADER, request.nextUrl.pathname);
  if (adminToken) {
    requestHeaders.set(ADMIN_TOKEN_HEADER, adminToken);
  }
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  stampPathnameCookie(request, response);
  return response;
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Strip forgeable auth headers on every matched request (including /api/assets).
  requestHeaders.delete(ADMIN_TOKEN_HEADER);
  requestHeaders.delete(ADMIN_ID_HEADER);
  requestHeaders.set(PATHNAME_HEADER, request.nextUrl.pathname);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  stampPathnameCookie(request, response);
  return response;
}

function stampPathnameCookie(request: NextRequest, response: NextResponse) {
  response.cookies.set(PATHNAME_COOKIE, request.nextUrl.pathname, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: csrfCookieSecure(request),
  });
}

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((prefix) => pathname.startsWith(prefix));
}

function isHttpsRequest(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  return proto.toLowerCase() === "https";
}

/** Secure flag only when the connection is HTTPS (AUTH_COOKIE_SECURE=true on plain HTTP breaks CSRF). */
function csrfCookieSecure(request: NextRequest): boolean {
  if (process.env.AUTH_COOKIE_SECURE === "false") return false;
  return isHttpsRequest(request);
}

function isDataRequest(request: NextRequest): boolean {
  return (
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    request.headers.get("Purpose") === "prefetch" ||
    request.nextUrl.searchParams.has("_rsc")
  );
}

async function withCsrfProtection(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const isServerAction = request.headers.has("next-action");
  const secureCookie = csrfCookieSecure(request);

  // Ensure a valid CSRF cookie exists on every GET response (refresh stale/rotated secrets).
  if (method === "GET" || method === "HEAD") {
    const existingCookie = extractCsrfFromCookie(request);
    if (!(await isCsrfCookieValid(existingCookie))) {
      const token = await generateCsrfToken();
      setCsrfCookie(response, token, secureCookie);
    }
  }

  // Validate CSRF on state-changing requests
  if (STATE_CHANGING_METHODS.has(method) && !isCsrfExempt(pathname) && !isServerAction) {
    const cookieToken = extractCsrfFromCookie(request);
    const requestToken = extractCsrfFromRequest(request);

    if (!(await verifyCsrfToken(cookieToken, requestToken))) {
      return NextResponse.json(
        { error: "Invalid or missing CSRF token." },
        { status: 403 },
      );
    }
  }

  return response;
}

async function withCustomDomainContext(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(CUSTOM_DOMAIN_WORKSPACE_HEADER);
  requestHeaders.delete(CUSTOM_DOMAIN_CUSTOMER_HEADER);
  requestHeaders.delete(CUSTOM_DOMAIN_HOST_HEADER);
  requestHeaders.set(PATHNAME_HEADER, request.nextUrl.pathname);

  const host = normalizeRequestHost(
    request.headers.get("x-forwarded-host") || request.headers.get("host"),
  );
  if (!host || getPlatformHosts().has(host)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  try {
    const cleanOrigin = getCleanOrigin(request);
    const resolveUrl = new URL("/api/internal/custom-domain", cleanOrigin);
    resolveUrl.searchParams.set("host", host);
    resolveUrl.searchParams.set(
      "proto",
      request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "https",
    );

    const response = await fetch(resolveUrl, {
      headers: {
        "x-ar360-internal-key": process.env.AR360_INTERNAL_KEY || "",
      },
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as {
        matched?: boolean;
        workspaceUid?: string;
        customerUid?: string;
        domain?: string;
      };
      if (data.matched && data.workspaceUid && data.customerUid) {
        requestHeaders.set(CUSTOM_DOMAIN_WORKSPACE_HEADER, data.workspaceUid);
        requestHeaders.set(CUSTOM_DOMAIN_CUSTOMER_HEADER, data.customerUid);
        requestHeaders.set(CUSTOM_DOMAIN_HOST_HEADER, data.domain || host);
      }
    }
  } catch {
    // Unknown host stays unmapped; public routes still work on platform origin.
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

function preferredAppHost(): string | null {
  try {
    const raw = process.env.NEXT_PUBLIC_APP_URL;
    if (!raw) return null;
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Keep apex/www on the configured host so session cookies stay valid after clicks.
  const preferredHost = preferredAppHost();
  const requestHost = normalizeRequestHost(
    request.headers.get("x-forwarded-host") || request.headers.get("host"),
  );
  if (preferredHost && requestHost && requestHost !== preferredHost) {
    const preferredRoot = preferredHost.replace(/^www\./, "");
    const requestRoot = requestHost.replace(/^www\./, "");
    if (preferredRoot === requestRoot) {
      const proto = (
        request.headers.get("x-forwarded-proto") ||
        request.nextUrl.protocol.replace(":", "") ||
        "https"
      )
        .split(",")[0]
        .trim();
      const target = new URL(request.url);
      target.host = preferredHost;
      target.protocol = `${proto}:`;
      return NextResponse.redirect(target, 308);
    }
  }

  const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const customerSession = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  // Shape-only in Edge middleware — AUTH_SECRET is build-inlined and can disagree
  // with runtime .env (caused post-login ERR_TOO_MANY_REDIRECTS). Real verify is in Node auth.ts.
  const hasAdminSession = hasSignedTokenShape(adminSession);
  const hasCustomerSession = hasSignedTokenShape(customerSession);

  const isMasterAdminApi = pathname.startsWith("/api/master-admin");
  const isMasterAdminPage = pathname.startsWith("/master-admin");
  const isAdminLogin =
    pathname === "/master-admin/login" || pathname.startsWith("/master-admin/login/");
  const isAdminLogout = pathname === "/master-admin/logout";

  if (isMasterAdminApi || isMasterAdminPage) {
    if (isMasterAdminPage && !isAdminLogin && !isAdminLogout && !hasAdminSession) {
      // Prefetch/RSC without cookies must not 401/redirect — that poisons client router cache
      // and looks like an instant logout on the next sidebar click.
      if (isDataRequest(request)) {
        return NextResponse.next();
      }
      return redirectUsingRequestHost(request, "/master-admin/login");
    }
    // Do NOT redirect login → panel based on cookie shape. Invalid/stale cookies (e.g. after
    // AUTH_SECRET rotation) would bounce with requireAdmin and create ERR_TOO_MANY_REDIRECTS.
    // The login page verifies via Node getCurrentMasterAdmin() and redirects when truly valid.
    const response = withForwardedAdminToken(request, hasAdminSession ? adminSession : undefined);
    return await withCsrfProtection(request, response);
  }

  // Product GLBs/posters fetched by model-viewer from Master Admin need the
  // admin session forwarded the same way as /api/master-admin routes.
  if (pathname.startsWith("/api/assets/") && hasAdminSession) {
    const response = withForwardedAdminToken(request, adminSession);
    return await withCsrfProtection(request, response);
  }

  if (pathname.startsWith("/dashboard") && !hasCustomerSession) {
    return redirectUsingRequestHost(request, "/login", `?next=${encodeURIComponent(pathname)}`);
  }

  if (isPublicCustomDomainPath(pathname)) {
    return withCustomDomainContext(request);
  }

  const nextResponse = nextWithPathname(request);
  return await withCsrfProtection(request, nextResponse);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/master-admin",
    "/master-admin/:path*",
    "/api/master-admin",
    "/api/master-admin/:path*",
    "/api/billing/:path*",
    "/api/products/:path*",
    "/api/account/:path*",
    "/api/auth/:path*",
    "/api/growth/:path*",
    "/api/enterprise/:path*",
    "/api/analytics/:path*",
    "/api/qr-codes/:path*",
    "/api/share-links/:path*",
    "/api/support-tickets/:path*",
    "/api/clients/:path*",
    "/api/contact",
    "/api/onboarding/:path*",
    "/api/object-capture/:path*",
    "/api/customer/:path*",
    "/api/workspace/:path*",
    "/api/product-enquiries/:path*",
    "/api/web-analytics/:path*",
    "/api/dashboard/:path*",
    "/viewer/:path*",
    "/c/:path*",
    "/embed/:path*",
    "/s/:path*",
    "/qr/:path*",
    "/api/public-products/:path*",
    "/api/embed/:path*",
    "/api/assets/:path*",
  ],
};
