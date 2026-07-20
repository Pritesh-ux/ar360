/** Deep links for managing one product from the client (agency) workspace. */
export function productHubLinks(input: {
  productId: string;
  productTitle?: string;
  qrRecordId?: number | null;
}) {
  const { productId, qrRecordId } = input;
  const enc = encodeURIComponent(productId);

  return {
    editor: `/dashboard/products/${enc}`,
    preview: `/dashboard/products/${enc}/preview`,
    viewer: `/viewer/${enc}`,
    ar: `/viewer/${enc}?openAR=1`,
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
