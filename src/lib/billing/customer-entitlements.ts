import { getCustomerUsage } from "@/lib/billing/customer-usage";
import {
  formatBytesShort,
  formatDataSize,
  formatLimitPair,
} from "@/lib/billing/format-data-size";

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

export { formatBytesShort, formatDataSize, formatLimitPair };
