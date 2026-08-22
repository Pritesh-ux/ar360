import { getPlatformSettings } from "@/lib/master-admin-settings";

export type InvoiceSellerProfile = {
  name: string;
  address: string;
  state: string;
  gstin: string;
  supportEmail: string;
};

/** Seller block on invoices: Master Admin Settings first, then env fallback. */
export async function resolveInvoiceSellerProfile(): Promise<InvoiceSellerProfile> {
  const settings = await getPlatformSettings().catch(() => null);
  return {
    name:
      settings?.companyName?.trim() ||
      process.env.BILLING_SELLER_NAME?.trim() ||
      "AR360 Studio",
    address:
      settings?.sellerAddress?.trim() ||
      process.env.BILLING_SELLER_ADDRESS?.trim() ||
      "India",
    state:
      settings?.sellerState?.trim() ||
      process.env.BILLING_SELLER_STATE?.trim() ||
      "Gujarat",
    gstin:
      settings?.gstNumber?.trim() ||
      process.env.BILLING_SELLER_GSTIN?.trim() ||
      "",
    supportEmail:
      settings?.supportEmail?.trim() ||
      process.env.BILLING_SUPPORT_EMAIL?.trim() ||
      "support@ar360.studio",
  };
}
