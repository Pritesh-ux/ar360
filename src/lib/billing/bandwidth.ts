import crypto from "crypto";
import { query } from "@/lib/db";
import { getCustomerBillingPeriod } from "@/lib/billing/billing-period";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import { usageThresholdState } from "@/lib/billing/limit-normalization";

type CustomerBandwidthRow = {
  bandwidth_used_mb: string | number;
  plan_id: string | null;
};

let bandwidthEventsTableReady: boolean | null = null;

async function ensureBandwidthEventsTable() {
  if (bandwidthEventsTableReady === true) return true;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS bandwidth_usage_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        customer_uid VARCHAR(64) NOT NULL,
        product_id VARCHAR(160) NULL,
        asset_id BIGINT UNSIGNED NULL,
        event_type VARCHAR(40) NOT NULL,
        bytes_transferred BIGINT UNSIGNED NOT NULL DEFAULT 0,
        measurement_mode ENUM('recorded','estimated') NOT NULL DEFAULT 'recorded',
        viewer_type VARCHAR(40) NULL,
        share_link_id BIGINT UNSIGNED NULL,
        qr_code_id BIGINT UNSIGNED NULL,
        session_id VARCHAR(64) NULL,
        billing_period_key VARCHAR(32) NOT NULL,
        occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bandwidth_events_customer_period (customer_uid, billing_period_key),
        INDEX idx_bandwidth_events_occurred (occurred_at),
        INDEX idx_bandwidth_events_session (session_id, event_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    bandwidthEventsTableReady = true;
    return true;
  } catch {
    bandwidthEventsTableReady = false;
    return false;
  }
}

export type BandwidthEventType =
  | "viewer_glb_load"
  | "embed_glb_load"
  | "usdz_download"
  | "poster_load"
  | "thumbnail_load"
  | "other_asset_delivery";

export type RecordBandwidthInput = {
  customerUid: string;
  bytes: number;
  eventType?: BandwidthEventType;
  productId?: string | null;
  assetId?: number | null;
  measurementMode?: "recorded" | "estimated";
  viewerType?: string | null;
  shareLinkId?: number | null;
  qrCodeId?: number | null;
  sessionId?: string | null;
};

/** Legacy counter — used when events table unavailable or as fast path. */
export async function getCustomerBandwidthUsedMb(customerUid: string): Promise<number> {
  if (!customerUid) return 0;

  const rows = await query<CustomerBandwidthRow>(
    `SELECT COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb, c.plan_id
       FROM customers c
      WHERE c.customer_uid = ?
      LIMIT 1`,
    [customerUid],
  ).catch(() => []);

  return Number(rows[0]?.bandwidth_used_mb || 0);
}

export async function getCustomerBandwidthUsedGb(customerUid: string): Promise<number> {
  const period = await getCustomerBillingPeriod(customerUid);
  const bytes = await getBandwidthUsedBytesInPeriod(customerUid, period.periodKey);
  return Number((bytes / (1024 * 1024 * 1024)).toFixed(4));
}

/** Sum bandwidth events for the current billing period; falls back to legacy counter. */
export async function getBandwidthUsedBytesInPeriod(
  customerUid: string,
  periodKey: string,
): Promise<number> {
  if (!customerUid) return 0;

  const hasEvents = await ensureBandwidthEventsTable();
  if (hasEvents) {
    try {
      const rows = await query<{ total: string | number | null }>(
        `SELECT COALESCE(SUM(bytes_transferred), 0) AS total
           FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ?`,
        [customerUid, periodKey],
      );
      const eventTotal = Number(rows[0]?.total || 0);
      if (eventTotal > 0) return eventTotal;
    } catch {
      // fall through
    }
  }

  const usedMb = await getCustomerBandwidthUsedMb(customerUid);
  return Math.round(usedMb * 1024 * 1024);
}

/**
 * Records bytes served against the customer's billing-period bandwidth quota.
 * Fire-and-forget safe — errors are logged but do not block the response.
 */
export async function recordBandwidthUsage(
  customerUid: string,
  bytes: number,
  options?: Omit<RecordBandwidthInput, "customerUid" | "bytes">,
): Promise<void> {
  if (!customerUid || !Number.isFinite(bytes) || bytes <= 0) return;

  const deltaMb = bytes / (1024 * 1024);
  const period = await getCustomerBillingPeriod(customerUid);
  const eventType = options?.eventType || "other_asset_delivery";
  const sessionId = options?.sessionId || null;

  const hasEvents = await ensureBandwidthEventsTable();
  if (hasEvents && sessionId) {
    try {
      const existing = await query<{ id: number }>(
        `SELECT id FROM bandwidth_usage_events
          WHERE customer_uid = ? AND billing_period_key = ? AND session_id = ? AND event_type = ?
          LIMIT 1`,
        [customerUid, period.periodKey, sessionId, eventType],
      );
      if (existing[0]) return;
    } catch {
      // continue
    }
  }

  if (hasEvents) {
    await query(
      `INSERT INTO bandwidth_usage_events
         (customer_uid, product_id, asset_id, event_type, bytes_transferred, measurement_mode,
          viewer_type, share_link_id, qr_code_id, session_id, billing_period_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerUid,
        options?.productId || null,
        options?.assetId || null,
        eventType,
        Math.round(bytes),
        options?.measurementMode || "recorded",
        options?.viewerType || null,
        options?.shareLinkId || null,
        options?.qrCodeId || null,
        sessionId,
        period.periodKey,
      ],
    ).catch((err) => console.warn("[bandwidth] event insert failed:", err));
  }

  await query(
    `UPDATE customers
        SET bandwidth_used_mb = COALESCE(bandwidth_used_mb, 0) + ?,
            updated_at = NOW()
      WHERE customer_uid = ?`,
    [deltaMb, customerUid],
  ).catch((err) => {
    console.warn("[bandwidth] Failed to record usage:", err);
  });
}

export type BandwidthCheckResult = {
  allowed: boolean;
  reason?: string;
  usedMb: number;
  usedBytes: number;
  limitGb: number | null;
  limitBytes: number | null;
  threshold: ReturnType<typeof usageThresholdState>;
};

export async function checkCustomerBandwidth(customerUid: string): Promise<BandwidthCheckResult> {
  const sub = await checkSubscription(customerUid);
  if (!sub.active) {
    return {
      allowed: false,
      reason: "This AR experience is temporarily unavailable.",
      usedMb: 0,
      usedBytes: 0,
      limitGb: 0,
      limitBytes: 0,
      threshold: "exceeded",
    };
  }

  const plan = await resolveCustomerPlanLimits(customerUid);
  const period = await getCustomerBillingPeriod(customerUid);
  const usedBytes = await getBandwidthUsedBytesInPeriod(customerUid, period.periodKey);
  const usedMb = usedBytes / (1024 * 1024);
  const limitGb = plan.unlimitedBandwidth ? null : Number(plan.bandwidthGb ?? 0) || null;
  const limitBytes = limitGb == null ? null : Math.round(limitGb * 1024 * 1024 * 1024);
  const threshold = usageThresholdState(usedBytes, limitBytes);

  if (limitGb != null && limitGb > 0 && usedMb / 1024 >= limitGb) {
    return {
      allowed: false,
      reason: "Monthly bandwidth limit reached for this account.",
      usedMb,
      usedBytes,
      limitGb,
      limitBytes,
      threshold: "exceeded",
    };
  }

  return { allowed: true, usedMb, usedBytes, limitGb, limitBytes, threshold };
}

export function bandwidthSessionId(parts: (string | null | undefined)[]) {
  const raw = parts.filter(Boolean).join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
