import type { Metadata } from "next";
import { ensureProductSchema, query } from "@/lib/db";
import { normalizeScopedId } from "@/lib/customerIsolation";
import { getViewerBranding } from "@/lib/enterprise/branding.service";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { toProtectedAssetUrl } from "@/lib/billing/asset-url";
import { sanitizeOrigin } from "@/lib/url";

type ProductMetaRow = {
  id: string;
  customer_uid: string;
  title: string;
  poster: string | null;
  thumbnail_url: string | null;
  product_folder: string | null;
  status: string;
};

function appOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://ar360studio.com";
  return sanitizeOrigin(raw.replace(/\/$/, "")) || "https://ar360studio.com";
}

function absolutePublicUrl(value?: string | null, origin = appOrigin()): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return null;
  if (raw === "__clear__" || raw === "/__clear__") return null;

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const url = new URL(raw);
      if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) {
        return `${origin}${url.pathname}${url.search}`;
      }
      return url.href;
    }
  } catch {
    return null;
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  // Disk storage paths → public asset proxy so crawlers can fetch them.
  if (/^\/?Storage\//i.test(path) || /\/Storage\/Customers\//i.test(path)) {
    return `${origin}${toProtectedAssetUrl(path) || path}`;
  }
  return `${origin}${path}`;
}

function firstImage(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const url = absolutePublicUrl(candidate);
    if (url) return url;
  }
  return null;
}

/**
 * Server metadata for /viewer/[id] so WhatsApp/Telegram/iMessage link previews
 * show the customer's poster (preferred) or brand logo — not the AR360 default.
 */
export async function buildViewerShareMetadata(input: {
  productId: string;
  clientUid?: string | null;
}): Promise<Metadata> {
  const id = normalizeScopedId(input.productId);
  const origin = appOrigin();
  const fallback: Metadata = {
    title: "AR360",
    description: "Premium 3D / AR product experience",
    metadataBase: new URL(origin),
  };

  if (!id) return fallback;

  try {
    await ensureProductSchema();
    const rows = await query<ProductMetaRow>(
      `SELECT id, customer_uid, title, poster, thumbnail_url, product_folder, status
         FROM products
        WHERE (id = ? OR public_id = ? OR viewer_slug = ?)
          AND LOWER(status) IN ('published', 'active')
          AND deleted_at IS NULL
        LIMIT 1`,
      [id, id, id],
    ).catch(() => []);

    const row = rows[0];
    if (!row?.customer_uid) return fallback;

    const productTitle = String(row.title || "").trim() || "3D Product";
    let brandName = "";
    let brandLogoUrl: string | null = null;
    let viewerTagline: string | null = null;
    let faviconUrl: string | null = null;

    const plan = await resolveCustomerPlanLimits(row.customer_uid).catch(() => null);
    if (plan?.allowCustomBranding) {
      const branding = await getViewerBranding(row.customer_uid).catch(() => null);
      brandName = String(branding?.brandName || "").trim();
      brandLogoUrl = branding?.logoUrl || null;
      viewerTagline = branding?.viewerTagline || null;
      faviconUrl = branding?.faviconUrl || null;
    }

    const scopedClient = String(input.clientUid || "").trim();
    if (scopedClient && plan?.allowCustomBranding) {
      const clients = await query<{
        logo_url: string | null;
        company_name: string | null;
        viewer_title: string | null;
        name: string;
        status: string;
      }>(
        `SELECT logo_url, company_name, viewer_title, name, status
           FROM clients
          WHERE client_uid = ? AND customer_uid = ?
          LIMIT 1`,
        [scopedClient, row.customer_uid],
      ).catch(() => []);
      const client = clients[0];
      if (client && String(client.status || "").toLowerCase() === "active") {
        brandLogoUrl = client.logo_url || brandLogoUrl;
        brandName =
          String(client.viewer_title || "").trim() ||
          String(client.company_name || "").trim() ||
          brandName ||
          client.name;
      }
    }

    const ogImage =
      firstImage(row.poster, row.thumbnail_url, brandLogoUrl, faviconUrl) ||
      `${origin}/brand/favicon-180.png`;

    const title = brandName ? `${brandName} — ${productTitle}` : productTitle;
    const description =
      String(viewerTagline || "").trim() ||
      (brandName
        ? `${brandName} · Premium 3D / AR product experience`
        : "Premium 3D / AR product experience");

    const canonicalPath = scopedClient
      ? `/viewer/${row.id}?client=${encodeURIComponent(scopedClient)}`
      : `/viewer/${row.id}`;

    const iconUrl = firstImage(faviconUrl, brandLogoUrl) || undefined;

    return {
      metadataBase: new URL(origin),
      title,
      description,
      alternates: { canonical: `${origin}${canonicalPath}` },
      icons: iconUrl
        ? {
            icon: [{ url: iconUrl }],
            apple: [{ url: iconUrl }],
            shortcut: [iconUrl],
          }
        : undefined,
      openGraph: {
        title,
        description,
        url: `${origin}${canonicalPath}`,
        siteName: brandName || "AR360",
        type: "website",
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: brandName || productTitle,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return fallback;
  }
}
