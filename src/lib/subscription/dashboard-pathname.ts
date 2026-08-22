import { cookies, headers } from "next/headers";

/** Must stay in sync with middleware.ts PATHNAME_COOKIE / PATHNAME_HEADER. */
export const PATHNAME_HEADER = "x-ar360-pathname";
export const PATHNAME_COOKIE = "ar360_pathname";

function cleanPath(raw: string) {
  return String(raw || "").trim().split("?")[0] || "";
}

/**
 * Pathname from the middleware request header only.
 * Cookie alone is unsafe: it still reflects the previous route on the first
 * paint after a redirect (e.g. /login → /dashboard/onboarding), which caused
 * ERR_TOO_MANY_REDIRECTS self-loops on onboarding.
 */
export async function getTrustedDashboardPathname() {
  const headerStore = await headers();
  return cleanPath(headerStore.get(PATHNAME_HEADER) || "");
}

/**
 * Current dashboard path for subscription/onboarding exempt checks.
 * Prefers the middleware request header; falls back to the pathname cookie
 * because some Next.js builds drop custom request headers in Server Components.
 */
export async function getDashboardPathname() {
  const fromHeader = await getTrustedDashboardPathname();
  if (fromHeader) return fromHeader;

  const cookieStore = await cookies();
  return cleanPath(cookieStore.get(PATHNAME_COOKIE)?.value || "");
}
