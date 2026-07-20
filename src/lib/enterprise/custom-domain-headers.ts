/** Request headers set by middleware when Host is a verified custom domain. */
export const CUSTOM_DOMAIN_WORKSPACE_HEADER = "x-ar360-workspace-uid";
export const CUSTOM_DOMAIN_CUSTOMER_HEADER = "x-ar360-customer-uid";
export const CUSTOM_DOMAIN_HOST_HEADER = "x-ar360-custom-domain";

export function isPublicCustomDomainPath(pathname: string): boolean {
  return (
    pathname.startsWith("/viewer") ||
    pathname.startsWith("/embed") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/qr/") ||
    pathname.startsWith("/api/public-products") ||
    pathname.startsWith("/api/embed") ||
    pathname.startsWith("/api/assets")
  );
}

export function getPlatformHosts(): Set<string> {
  const hosts = new Set<string>();
  const add = (value?: string | null) => {
    if (!value) return;
    try {
      const normalized = value.includes("://") ? new URL(value).hostname : value.split(":")[0];
      if (normalized) hosts.add(normalized.toLowerCase());
    } catch {
      const host = value.split(":")[0].trim().toLowerCase();
      if (host) hosts.add(host);
    }
  };
  add(process.env.NEXT_PUBLIC_APP_URL);
  add(process.env.APP_URL);
  add(process.env.AR360_DOMAIN_TARGET);
  add(process.env.NEXT_PUBLIC_DOMAIN_TARGET);
  add("localhost");
  add("127.0.0.1");
  add("0.0.0.0");
  add("domains.ar360.app");
  return hosts;
}

export function normalizeRequestHost(hostHeader: string | null | undefined): string {
  return String(hostHeader || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}
