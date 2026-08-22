import crypto from "crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { BillingErrorCode } from "@/lib/billing/billing-errors";
import { getRazorpayRuntimeConfig } from "@/lib/billing/razorpay-config";
import { uid, verifyRazorpayWebhookSignature } from "@/server/billing/razorpay";
import { parseRazorpayBillingEvent } from "@/server/billing/razorpay-webhook.types";

export const runtime = "nodejs";

function payloadHash(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  const signatureValid = await verifyRazorpayWebhookSignature(rawBody, signature);
  const { mode } = await getRazorpayRuntimeConfig();
  const providerMode = mode === "live" ? "live" : "test";

  if (!signatureValid) {
    await query(`INSERT INTO billing_provider_health
      (provider, provider_mode, last_webhook_failure_at, last_webhook_failure)
      VALUES ('razorpay', ?, NOW(), 'Invalid webhook signature')
      ON DUPLICATE KEY UPDATE last_webhook_failure_at=NOW(), last_webhook_failure=VALUES(last_webhook_failure)`,
    [providerMode]).catch(() => undefined);
    return NextResponse.json(
      { success: false, code: BillingErrorCode.WEBHOOK_SIGNATURE_INVALID, error: "Invalid signature." },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const eventType = String(body.event || "").trim();
  const hash = payloadHash(rawBody);
  const deliveryId = (
    req.headers.get("x-razorpay-event-id")
    || req.headers.get("x-razorpay-delivery-id")
    || ""
  ).trim();
  const providerEventId = deliveryId || null;
  const dedupeKey = `razorpay:${deliveryId ? `delivery:${deliveryId}` : `sha256:${hash}`}`;
  let parsed: ReturnType<typeof parseRazorpayBillingEvent> = null;
  try {
    parsed = parseRazorpayBillingEvent(payload);
  } catch {
    // Signed malformed events are still retained; the processor will retry/dead-letter them.
  }
  await query(
    `INSERT IGNORE INTO billing_webhook_events
       (event_uid, provider, provider_mode, event_type, provider_event_id, dedupe_key,
        signature_valid, payload, payload_hash, headers_json, status, event_created_at,
        provider_subscription_id, provider_payment_id, provider_refund_id)
     VALUES (?, 'razorpay', ?, ?, ?, ?, 1, ?, ?, ?, 'received', ?, ?, ?, ?)`,
    [uid("wh"), providerMode, eventType, providerEventId, dedupeKey, rawBody, hash,
      JSON.stringify({
        "x-razorpay-event-id": req.headers.get("x-razorpay-event-id"),
        "x-razorpay-delivery-id": req.headers.get("x-razorpay-delivery-id"),
      }),
      parsed?.occurredAt || Number(body.created_at || 0) || null,
      parsed?.providerSubscriptionId || null,
      parsed?.providerPaymentId || null,
      parsed?.providerRefundId || null],
  );
  await query(`INSERT INTO billing_provider_health
    (provider, provider_mode, last_webhook_at, last_webhook_event)
    VALUES ('razorpay', ?, NOW(), ?)
    ON DUPLICATE KEY UPDATE last_webhook_at=NOW(), last_webhook_event=VALUES(last_webhook_event)`,
  [providerMode, eventType]).catch(() => undefined);

  // Acknowledgement means durably accepted, not finalized. The worker owns side effects.
  return NextResponse.json({ success: true, accepted: true }, { status: 202 });
}
