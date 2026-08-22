/** Deep links for managing one product from the client (agency) workspace. */
export function productHubLinks(input: {
  productId: string;
  productTitle?: string;
  qrRecordId?: number | null;
  /** When set, viewer/AR URLs include ?client= so the catalog sidebar can load. */
  clientUid?: string | null;
}) {
  const { productId, qrRecordId, clientUid } = input;
  const enc = encodeURIComponent(productId);
  const client = String(clientUid || "").trim();
  const clientQuery = client ? `client=${encodeURIComponent(client)}` : "";

  const viewer = clientQuery ? `/viewer/${enc}?${clientQuery}` : `/viewer/${enc}`;
  const ar = clientQuery
    ? `/viewer/${enc}?${clientQuery}&openAR=1`
    : `/viewer/${enc}?openAR=1`;

  return {
    editor: `/dashboard/products/${enc}`,
    preview: `/dashboard/products/${enc}/preview`,
    viewer,
    ar,
    qrCenter: `/dashboard/qr-center?productId=${enc}`,
    qrEdit:
      qrRecordId != null && Number.isFinite(qrRecordId)
        ? `/dashboard/qr-center/${qrRecordId}`
        : `/dashboard/qr-center?productId=${enc}`,
    share: `/dashboard/share-center?productId=${enc}`,
    embed: `/dashboard/embed-center?productId=${enc}`,
    branding: `/dashboard/branding`,
    domains: `/dashboard/settings?tab=domains`,
  } as const;
}
