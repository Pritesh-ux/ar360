import { NextResponse, type NextRequest } from "next/server";
import {
  CUSTOM_DOMAIN_CUSTOMER_HEADER,
  CUSTOM_DOMAIN_HOST_HEADER,
  CUSTOM_DOMAIN_WORKSPACE_HEADER,
  getPlatformHosts,
  isPublicCustomDomainPath,
  normalizeRequestHost,
} from "@/lib/enterprise/custom-domain-headers";

const CUSTOMER_SESSION_COOKIE = "ar360_customer_session";
const ADMIN_SESSION_COOKIE = "ar360_master_admin_session";
/** Raw session token forwarded from httpOnly cookie. Verified in Node (auth.ts). */
export const ADMIN_TOKEN_HEADER = "x-ar360-admin-token";
export const ADMIN_ID_HEADER = "x-ar360-admin-id";

function hasSignedTokenShape(value?: string) {
  if (!value) return false;
  const parts = value.split(".");
  return parts.length === 2 && parts[0].length > 10 && parts[1].length > 10;
}

/**
 * Build redirect URLs from the browser Host header — never from the listen
 * address (0.0.0.0). Binding on 0.0.0.0 makes request.url use that host, which
 * breaks cookies/CSP when the user opened the app via localhost.
 */
function redirectUsingRequestHost(request: NextRequest, pathname: string, search?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search || "";

  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (hostHeader) {
    const host = hostHeader.split(",")[0].trim();
    if (host) url.host = host;
  }

  if (url.hostname === "0.0.0.0" || url.hostname === "[::]") {
    url.hostname = "localhost";
  }

  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "http" || proto === "https") {
    url.protocol = `${proto}:`;
  }

  return NextResponse.redirect(url);
}

function withForwardedAdminToken(request: NextRequest, adminToken?: string) {
  const requestHeaders = new Headers(request.headers);
  // Never trust client-supplied auth headers.
  requestHeaders.delete(ADMIN_TOKEN_HEADER);
  requestHeaders.delete(ADMIN_ID_HEADER);
  if (adminToken) {
    requestHeaders.set(ADMIN_TOKEN_HEADER, adminToken);
  }
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

async function withCustomDomainContext(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(CUSTOM_DOMAIN_WORKSPACE_HEADER);
  requestHeaders.delete(CUSTOM_DOMAIN_CUSTOMER_HEADER);
  requestHeaders.delete(CUSTOM_DOMAIN_HOST_HEADER);

  const host = normalizeRequestHost(
    request.headers.get("x-forwarded-host") || request.headers.get("host"),
  );
  if (!host || getPlatformHosts().has(host)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  try {
    const resolveUrl = request.nextUrl.clone();
    resolveUrl.pathname = "/api/internal/custom-domain";
    resolveUrl.search = "";
    resolveUrl.searchParams.set("host", host);
    resolveUrl.searchParams.set(
      "proto",
      request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "https",
    );
    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (hostHeader) resolveUrl.host = hostHeader.split(",")[0].trim();
    if (resolveUrl.hostname === "0.0.0.0" || resolveUrl.hostname === "[::]") {
      resolveUrl.hostname = "localhost";
    }

    const response = await fetch(resolveUrl, {
      headers: {
        "x-ar360-internal-key": process.env.AR360_INTERNAL_KEY || "ar360-dev-internal",
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const customerSession = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  const hasAdminSession = hasSignedTokenShape(adminSession);
  const hasCustomerSession = hasSignedTokenShape(customerSession);

  const isMasterAdminApi = pathname.startsWith("/api/master-admin");
  const isMasterAdminPage = pathname.startsWith("/master-admin");
  const isAdminLogin =
    pathname === "/master-admin/login" || pathname.startsWith("/master-admin/login/");
  const isAdminLogout = pathname === "/master-admin/logout";

  if (isMasterAdminApi || isMasterAdminPage) {
    if (isMasterAdminPage && !isAdminLogin && !isAdminLogout && !hasAdminSession) {
      return redirectUsingRequestHost(request, "/master-admin/login");
    }
    if (isAdminLogin && hasAdminSession) {
      return redirectUsingRequestHost(request, "/master-admin");
    }
    return withForwardedAdminToken(request, hasAdminSession ? adminSession : undefined);
  }

  if (pathname.startsWith("/dashboard") && !hasCustomerSession) {
    return redirectUsingRequestHost(request, "/login", `?next=${encodeURIComponent(pathname)}`);
  }

  if (isPublicCustomDomainPath(pathname)) {
    return withCustomDomainContext(request);
  }

  return NextResponse.next();
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
    "/viewer/:path*",
    "/embed/:path*",
    "/s/:path*",
    "/qr/:path*",
    "/api/public-products/:path*",
    "/api/embed/:path*",
    "/api/assets/:path*",
  ],
};
