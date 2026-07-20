import { getCustomerUsage } from "@/lib/billing/customer-usage";

export type CustomerEntitlements = {
  planId: string;
  planName: string;
  planSlug: string;
  planLevel: number;
  subscriptionStatus: string;
  limits: {
    products: number | null;
    storageBytes: number | null;
    bandwidthBytes: number | null;
    qrCodes: number | null;
    shareLinks: number | null;
  };
  usage: {
    products: number;
    storageBytes: number;
    bandwidthBytes: number;
    qrCodes: number;
    shareLinks: number;
  };
  remaining: {
    products: number | null;
    storageBytes: number | null;
    bandwidthBytes: number | null;
    qrCodes: number | null;
    shareLinks: number | null;
  };
};

/** Backward-compatible wrapper around canonical getCustomerUsage(). */
export async function getCustomerEntitlements(customerUid: string): Promise<CustomerEntitlements> {
  const usage = await getCustomerUsage(customerUid);
  return {
    planId: usage.plan.id,
    planName: usage.plan.name,
    planSlug: usage.plan.slug,
    planLevel: usage.plan.level,
    subscriptionStatus: usage.subscription.status,
    limits: {
      products: usage.products.limit,
      storageBytes: usage.storage.limitBytes,
      bandwidthBytes: usage.bandwidth.limitBytes,
      qrCodes: usage.qrCodes.limit,
      shareLinks: usage.shareLinks.limit,
    },
    usage: {
      products: usage.products.used,
      storageBytes: usage.storage.usedBytes,
      bandwidthBytes: usage.bandwidth.usedBytes,
      qrCodes: usage.qrCodes.used,
      shareLinks: usage.shareLinks.used,
    },
    remaining: {
      products: usage.products.remaining,
      storageBytes: usage.storage.remainingBytes,
      bandwidthBytes: usage.bandwidth.remainingBytes,
      qrCodes: usage.qrCodes.remaining,
      shareLinks: usage.shareLinks.remaining,
    },
  };
}

export function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function formatLimitPair(
  used: number,
  limit: number | null,
  unit: "products" | "bytes" | "qr" | "share" = "products",
): string {
  if (unit === "products") {
    const limitLabel = limit == null ? "Unlimited" : String(limit);
    return `${used} / ${limitLabel} products`;
  }
  if (unit === "qr") {
    const limitLabel = limit == null ? "Unlimited" : String(limit);
    return `${used} / ${limitLabel} QR codes`;
  }
  if (unit === "share") {
    const limitLabel = limit == null ? "Unlimited" : String(limit);
    return `${used} / ${limitLabel} share links`;
  }
  const usedLabel = formatBytesShort(used);
  const limitLabel = limit == null ? "Unlimited" : formatBytesShort(limit);
  return `${usedLabel} / ${limitLabel}`;
}
