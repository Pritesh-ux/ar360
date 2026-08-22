export function normalizeWhatsAppDigits(raw: string | null | undefined): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  // Indian 10-digit mobiles are stored without country code in client settings.
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  return digits;
}

export function buildWhatsAppInterestMessage(input: {
  productTitle: string;
  productId: string;
  viewerUrl: string;
}): string {
  const title = String(input.productTitle || "this product").trim() || "this product";
  const productId = String(input.productId || "").trim() || "—";
  const viewerUrl = String(input.viewerUrl || "").trim();
  return [
    `Hi, I am interested in ${title}.`,
    "",
    `Product ID: ${productId}`,
    "",
    "View Product:",
    viewerUrl,
  ].join("\n");
}

export function buildWhatsAppHref(input: {
  number: string | null | undefined;
  productTitle: string;
  productId: string;
  viewerUrl: string;
}): string | null {
  const digits = normalizeWhatsAppDigits(input.number);
  if (!digits) return null;
  const text = buildWhatsAppInterestMessage(input);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
