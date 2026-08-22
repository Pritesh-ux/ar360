/** Client-safe QR center logo constants (no Node fs/sharp). */

/** Full AR360 STUDIO lockup for QR center (default for all product QRs). */
export const AR360_QR_CENTER_LOGO_PATH = "/brand/qr-center-logo.png";

/** Width of the logo plate as a percent of the QR canvas (default brand lockup is wide). */
export const AR360_QR_CENTER_LOGO_SIZE = 32;

/** Brand lockup width÷height after trim (~596×150). */
export const AR360_QR_CENTER_LOGO_ASPECT = 4;

/** Fallback size when a square custom logo is used. */
export const CUSTOM_QR_CENTER_LOGO_SIZE = 22;

export function isAr360QrLogoUrl(url: string) {
  const value = url.trim().toLowerCase();
  return (
    value.includes("/brand/qr-center-logo.png") ||
    value.endsWith("qr-center-logo.png") ||
    value.includes("/brand/ui-mark.png") ||
    value.includes("/brand/ar360-mark")
  );
}

/**
 * Decide which logo sits in the QR center.
 * - Custom logo only when the plan allows branding AND a user logo is set
 * - Otherwise always AR360 Studio
 */
export function resolveQrCenterLogo(input: {
  customLogoUrl?: string | null;
  allowCustomBranding: boolean;
  customLogoSize?: number | null;
  brandLogoUrl?: string;
}): { logoUrl: string; logoSize: number; isCustom: boolean; source: "ar360" | "custom" } {
  const custom = String(input.customLogoUrl || "").trim();
  if (input.allowCustomBranding && custom && !isAr360QrLogoUrl(custom)) {
    const size = Number(input.customLogoSize);
    return {
      logoUrl: custom,
      logoSize: Number.isFinite(size) && size >= 12 && size <= 40 ? size : CUSTOM_QR_CENTER_LOGO_SIZE,
      isCustom: true,
      source: "custom",
    };
  }
  return {
    logoUrl: input.brandLogoUrl || AR360_QR_CENTER_LOGO_PATH,
    logoSize: AR360_QR_CENTER_LOGO_SIZE,
    isCustom: false,
    source: "ar360",
  };
}
