/**
 * Plan quotas printed on tax invoices so Starter → Business → Custom
 * upgrades stay auditable (products, storage, bandwidth).
 */

export type InvoicePlanEntitlements = {
  products: number | null;
  storageGb: number | null;
  bandwidthGb: number | null;
  unlimitedProducts?: boolean;
  unlimitedStorage?: boolean;
  unlimitedBandwidth?: boolean;
};

function roundGb(value: number) {
  if (!Number.isFinite(value) || value < 0) return null;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded : rounded;
}

export function bytesToInvoiceGb(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return null;
  return roundGb(Number(bytes) / (1024 * 1024 * 1024));
}

function formatCount(value: number | null | undefined, unlimited: boolean | undefined, noun: string) {
  if (unlimited || value == null || value < 0) return `Unlimited ${noun}`;
  return `${Math.round(value)} ${noun}`;
}

function formatGb(value: number | null | undefined, unlimited: boolean | undefined, noun: string) {
  if (unlimited || value == null || value < 0) return `Unlimited ${noun}`;
  const n = roundGb(value);
  if (n == null) return `Unlimited ${noun}`;
  const label = Number.isInteger(n) ? String(n) : String(n);
  return `${label} GB ${noun}`;
}

/** Single invoice subtitle: "12 products · 50 GB storage · 500 GB bandwidth" */
export function formatPlanEntitlementLine(entitlements?: InvoicePlanEntitlements | null) {
  if (!entitlements) return "";
  return [
    formatCount(entitlements.products, entitlements.unlimitedProducts, "products"),
    formatGb(entitlements.storageGb, entitlements.unlimitedStorage, "storage"),
    formatGb(entitlements.bandwidthGb, entitlements.unlimitedBandwidth, "bandwidth"),
  ].join(" · ");
}

export function entitlementsFromPriceSnapshot(snapshot: unknown): InvoicePlanEntitlements | null {
  if (!snapshot) return null;
  let obj: Record<string, unknown> | null = null;
  if (typeof snapshot === "string") {
    try {
      obj = JSON.parse(snapshot) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof snapshot === "object") {
    obj = snapshot as Record<string, unknown>;
  }
  if (!obj) return null;
  const raw = (obj.entitlements || obj.planEntitlements) as InvoicePlanEntitlements | undefined;
  if (!raw || typeof raw !== "object") return null;
  const products = raw.products == null ? null : Number(raw.products);
  const storageGb = raw.storageGb == null ? null : Number(raw.storageGb);
  const bandwidthGb = raw.bandwidthGb == null ? null : Number(raw.bandwidthGb);
  if (
    products == null &&
    storageGb == null &&
    bandwidthGb == null &&
    !raw.unlimitedProducts &&
    !raw.unlimitedStorage &&
    !raw.unlimitedBandwidth
  ) {
    return null;
  }
  return {
    products: Number.isFinite(products as number) ? products : null,
    storageGb: Number.isFinite(storageGb as number) ? storageGb : null,
    bandwidthGb: Number.isFinite(bandwidthGb as number) ? bandwidthGb : null,
    unlimitedProducts: Boolean(raw.unlimitedProducts),
    unlimitedStorage: Boolean(raw.unlimitedStorage),
    unlimitedBandwidth: Boolean(raw.unlimitedBandwidth),
  };
}
