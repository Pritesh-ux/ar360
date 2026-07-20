import { randomBytes } from "crypto";
import { query } from "@/lib/db";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import { getGrowthOverview } from "@/lib/growth/analytics.service";
import { createCustomerNotification } from "@/lib/account/notify.service";

export type GrowthInsight = {
  id: string;
  message: string;
  category: "traffic" | "audience" | "engagement" | "channel";
};

export async function generateGrowthInsights(customerUid: string): Promise<GrowthInsight[]> {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromWeek = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const fromPrevWeek = new Date(now.getTime() - 13 * 86400000).toISOString().slice(0, 10);
  const toPrevWeek = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const [current, previous, topProduct] = await Promise.all([
    getGrowthOverview({ customerUid, from: fromWeek, to }),
    getGrowthOverview({ customerUid, from: fromPrevWeek, to: toPrevWeek }),
    query<{ title: string; views: number }>(
      `SELECT p.title, COALESCE(SUM(a.views),0) AS views
       FROM products p
       LEFT JOIN analytics_daily a ON a.product_uid = p.id AND a.customer_uid = p.customer_uid
         AND a.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       WHERE p.customer_uid = ? AND p.deleted_at IS NULL
       GROUP BY p.id, p.title ORDER BY views DESC LIMIT 1`,
      [customerUid],
    ),
  ]);

  const insights: GrowthInsight[] = [];

  if (previous.totalViews > 0) {
    const change = Math.round(((current.totalViews - previous.totalViews) / previous.totalViews) * 100);
    if (change !== 0) {
      insights.push({
        id: "views-week",
        category: "engagement",
        message:
          change > 0
            ? `Viewer traffic increased ${change}% compared to the previous week.`
            : `Viewer traffic decreased ${Math.abs(change)}% compared to the previous week.`,
      });
    }
  }

  const topDevice = current.devices[0];
  if (topDevice?.device && topDevice.views > 0) {
    insights.push({
      id: "top-device",
      category: "audience",
      message: `${topDevice.device.charAt(0).toUpperCase()}${topDevice.device.slice(1)} users are your largest audience segment.`,
    });
  }

  if (current.qrScans > current.shareViews && current.qrScans > 0) {
    insights.push({ id: "qr-vs-share", category: "channel", message: "QR traffic is higher than Share link traffic." });
  } else if (current.shareViews > current.qrScans && current.shareViews > 0) {
    insights.push({ id: "share-vs-qr", category: "channel", message: "Share link traffic is higher than QR traffic." });
  }

  const product = topProduct[0];
  if (product?.title && product.views > 0) {
    insights.push({
      id: "top-product",
      category: "traffic",
      message: `"${product.title}" is your top product this week with ${product.views} views.`,
    });
  }

  return insights;
}

export async function notifyQrReady(customerUid: string, productTitle: string, qrCode: string) {
  await createCustomerNotification({
    customerUid,
    category: "product",
    title: "QR ready",
    body: `"${productTitle}" permanent QR ${qrCode} is ready.`,
    href: "/dashboard/qr-center",
    dedupeKey: `qr-ready:${qrCode}`,
  });
}

export async function notifyHighTraffic(customerUid: string, productTitle: string, views: number) {
  await ensureUserPanelSchema();
  const existing = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM customer_notifications
     WHERE customer_uid = ? AND category = 'system' AND title = 'High traffic' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    [customerUid],
  );
  if (Number(existing[0]?.total || 0) > 0) return;

  const uid = `ntf_${Date.now()}_${randomBytes(4).toString("hex")}`;
  await query(
    `INSERT INTO customer_notifications (notification_uid, customer_uid, category, title, body, href, is_read)
     VALUES (?, ?, 'system', 'High traffic', ?, '/dashboard/analytics', FALSE)`,
    [uid, customerUid, `"${productTitle}" received ${views} views today.`],
  );
}
