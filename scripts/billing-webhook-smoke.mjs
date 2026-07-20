import crypto from "node:crypto";
import { loadProjectEnv, requireReachableServer } from "./lib/env-utils.mjs";

loadProjectEnv();

const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";
const webhookSecret =
  process.env.RAZORPAY_TEST_WEBHOOK_SECRET ||
  process.env.RAZORPAY_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("RAZORPAY_TEST_WEBHOOK_SECRET (or RAZORPAY_WEBHOOK_SECRET) is required for webhook smoke.");
}

console.log(`Billing webhook smoke: ${baseUrl}`);
await requireReachableServer(baseUrl);

let failed = false;

function mark(ok, label) {
  console.log(`${ok ? "OK" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

function signBody(rawBody) {
  return crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}

async function postWebhook(payload) {
  const rawBody = JSON.stringify(payload);
  return fetch(`${baseUrl}/api/billing/webhook/razorpay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signBody(rawBody),
    },
    body: rawBody,
  });
}

const eventId = `evt_smoke_${Date.now()}`;
const paymentPayload = {
  id: eventId,
  event: "payment.captured",
  created_at: Math.floor(Date.now() / 1000),
  payload: {
    payment: {
      entity: {
        id: `pay_smoke_${Date.now()}`,
        amount: 24900,
        currency: "INR",
        status: "captured",
        order_id: `order_smoke_${Date.now()}`,
        notes: {},
      },
    },
  },
};

try {
  const res = await postWebhook(paymentPayload);
  const data = await res.json().catch(() => ({}));
  mark(res.ok, `payment.captured webhook ${res.status}`);
  if (!res.ok) console.log("  ", data.error || data);
} catch (error) {
  mark(false, `payment.captured ${error instanceof Error ? error.message : error}`);
}

try {
  const dupRes = await postWebhook(paymentPayload);
  const dupData = await dupRes.json().catch(() => ({}));
  mark(dupRes.status === 202 && dupData.success && dupData.accepted, `idempotent replay ${dupRes.status}`);
} catch (error) {
  mark(false, `idempotent replay ${error instanceof Error ? error.message : error}`);
}

try {
  const badRes = await fetch(`${baseUrl}/api/billing/webhook/razorpay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": "invalid",
    },
    body: JSON.stringify({ id: "evt_bad", event: "payment.captured", payload: {} }),
  });
  mark(badRes.status === 400, `invalid signature rejected ${badRes.status}`);
} catch (error) {
  mark(false, `invalid signature ${error instanceof Error ? error.message : error}`);
}

if (failed) process.exit(1);
console.log("\nBilling webhook smoke passed.\n");
