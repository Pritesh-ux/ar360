import { getCustomerUsage } from "@/lib/billing/customer-usage";
import { createCustomerNotification } from "@/lib/account/notify.service";
import { sendUsageLimitEmail } from "@/lib/email/customer-lifecycle.service";

function periodKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bytesToGb(bytes: number) {
  return bytes / (1024 * 1024 * 1024);
}

/** Fire storage/bandwidth threshold alerts (deduped per period). */
export async function maybeNotifyUsageThresholds(customerUid: string) {
  const usage = await getCustomerUsage(customerUid);
  const period = periodKey();

  const storageUsedGb = bytesToGb(usage.storage.usedBytes);
  const storageLimitGb = usage.storage.limitBytes != null ? bytesToGb(usage.storage.limitBytes) : null;
  const bandwidthUsedGb = bytesToGb(usage.bandwidth.usedBytes);
  const bandwidthLimitGb = usage.bandwidth.limitBytes != null ? bytesToGb(usage.bandwidth.limitBytes) : null;

  if (usage.storage.threshold === "warning") {
    await createCustomerNotification({
      customerUid,
      category: "storage",
      title: "Storage almost full",
      body: `You've used ${storageUsedGb.toFixed(1)} GB of your ${storageLimitGb?.toFixed(1) ?? "—"} GB storage limit.`,
      href: "/dashboard/billing",
      dedupeKey: `usage:storage:warning:${period}`,
    }).catch(() => {});
    await sendUsageLimitEmail({
      customerUid,
      resource: "storage",
      level: "warning",
      usedGb: storageUsedGb,
      limitGb: storageLimitGb,
      eventKey: period,
    }).catch(() => undefined);
  }

  if (usage.storage.threshold === "exceeded") {
    await createCustomerNotification({
      customerUid,
      category: "storage",
      title: "Storage limit reached",
      body: "You've reached your storage limit. Upgrade your plan or remove unused assets.",
      href: "/dashboard/billing",
      dedupeKey: `usage:storage:exceeded:${period}`,
    }).catch(() => {});
    await sendUsageLimitEmail({
      customerUid,
      resource: "storage",
      level: "exceeded",
      usedGb: storageUsedGb,
      limitGb: storageLimitGb,
      eventKey: period,
    }).catch(() => undefined);
  }

  if (usage.bandwidth.threshold === "warning") {
    await createCustomerNotification({
      customerUid,
      category: "storage",
      title: "Bandwidth almost full",
      body: `You've used ${bandwidthUsedGb.toFixed(1)} GB of your ${bandwidthLimitGb?.toFixed(1) ?? "—"} GB bandwidth limit.`,
      href: "/dashboard/billing",
      dedupeKey: `usage:bandwidth:warning:${period}`,
    }).catch(() => {});
    await sendUsageLimitEmail({
      customerUid,
      resource: "bandwidth",
      level: "warning",
      usedGb: bandwidthUsedGb,
      limitGb: bandwidthLimitGb,
      eventKey: period,
    }).catch(() => undefined);
  }

  if (usage.bandwidth.threshold === "exceeded") {
    await createCustomerNotification({
      customerUid,
      category: "storage",
      title: "Bandwidth limit reached",
      body: "You've reached your monthly bandwidth limit.",
      href: "/dashboard/billing",
      dedupeKey: `usage:bandwidth:exceeded:${period}`,
    }).catch(() => {});
    await sendUsageLimitEmail({
      customerUid,
      resource: "bandwidth",
      level: "exceeded",
      usedGb: bandwidthUsedGb,
      limitGb: bandwidthLimitGb,
      eventKey: period,
    }).catch(() => undefined);
  }
}
