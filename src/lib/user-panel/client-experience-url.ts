import type { ClientWorkspaceProduct } from "@/lib/user-panel/client-workspace";

function isPublishedStatus(status: string | undefined | null): boolean {
  const s = String(status || "").trim().toLowerCase();
  return s === "published" || s === "active";
}

/** First assigned product suitable for opening the client catalog viewer. */
export function pickClientExperienceProduct(
  products: ClientWorkspaceProduct[],
): ClientWorkspaceProduct | null {
  const eligible = products.filter(
    (p) => isPublishedStatus(p.status) && p.viewer_active !== false && Number(p.viewer_active) !== 0,
  );
  if (eligible.length === 0) return null;
  return eligible[0];
}

export function viewerSlugForProduct(product: ClientWorkspaceProduct): string {
  const publicId = String(product.public_id || "").trim();
  return publicId || String(product.product_uid || "").trim();
}

/** Stable client showroom path — does not embed a product id. */
export function buildClientShowroomPath(clientUid: string): string {
  const client = encodeURIComponent(String(clientUid || "").trim());
  return client ? `/c/${client}` : "/";
}

export function buildClientShowroomUrl(origin: string, clientUid: string): string {
  const path = buildClientShowroomPath(clientUid);
  const base = String(origin || "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

/** @deprecated Prefer buildClientShowroomPath — product URLs break if that product is deleted. */
export function buildClientExperienceViewerPath(clientUid: string, productSlug: string): string {
  const slug = encodeURIComponent(String(productSlug || "").trim());
  const client = encodeURIComponent(String(clientUid || "").trim());
  if (!slug || !client) return "/";
  return `/viewer/${slug}?client=${client}`;
}

export function buildClientExperienceViewerUrl(
  origin: string,
  clientUid: string,
  productSlug: string,
): string {
  const path = buildClientExperienceViewerPath(clientUid, productSlug);
  const base = String(origin || "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

export function resolveClientExperienceUrl(origin: string, clientUid: string): string | null {
  const uid = String(clientUid || "").trim();
  if (!uid) return null;
  return buildClientShowroomUrl(origin, uid);
}
