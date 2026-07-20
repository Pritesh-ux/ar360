import assert from "node:assert/strict";
import crypto from "crypto";
import { describe, it } from "node:test";

function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

describe("Razorpay signature validation", () => {
  const secret = "test_webhook_secret";

  it("accepts valid payment signatures", () => {
    const orderId = "order_123";
    const paymentId = "pay_456";
    const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    assert.equal(verifyPaymentSignature(orderId, paymentId, expected, secret), true);
  });

  it("rejects invalid payment signatures", () => {
    assert.equal(verifyPaymentSignature("order_123", "pay_456", "bad-signature", secret), false);
  });

  it("accepts valid webhook signatures", () => {
    const payload = JSON.stringify({ event: "payment.captured", id: "evt_1" });
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    assert.equal(verifyWebhookSignature(payload, expected, secret), true);
  });

  it("rejects tampered webhook payloads", () => {
    const payload = JSON.stringify({ event: "payment.captured", id: "evt_1" });
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const tampered = payload.replace("evt_1", "evt_2");
    assert.equal(verifyWebhookSignature(tampered, expected, secret), false);
  });
});
