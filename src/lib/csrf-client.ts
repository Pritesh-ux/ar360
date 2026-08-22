/** Browser-only CSRF helpers (cookie → header / form field). */

export const CSRF_COOKIE_NAME = "ar360_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function getBrowserCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(CSRF_COOKIE_NAME.length + 1));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function ensureBrowserCsrfToken(): Promise<string | null> {
  const existing = getBrowserCsrfToken();
  if (existing) return existing;
  if (typeof window === "undefined") return null;

  const warmPaths = [
    "/api/customer/bootstrap",
    "/master-admin/login",
    "/login",
  ];

  try {
    await fetch(warmPaths[0], { cache: "no-store", credentials: "same-origin" });
  } catch {
    // Ignore bootstrap errors and continue retrying cookie reads.
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = getBrowserCsrfToken();
    if (token) return token;

    try {
      const path = warmPaths[Math.min(attempt + 1, warmPaths.length - 1)];
      await fetch(path, { cache: "no-store", credentials: "same-origin" });
    } catch {
      // Ignore warm-up errors and keep polling briefly.
    }

    await sleep(120);
  }

  return getBrowserCsrfToken();
}
