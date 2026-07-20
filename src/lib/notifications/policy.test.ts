import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_NOTIFICATION_CATEGORIES,
  validateDeleteNotificationPayload,
  validateReadNotificationPayload,
} from "./policy";

test("read payload accepts one, many, and mark-all", () => {
  assert.deepEqual(validateReadNotificationPayload({ ids: ["a", "b", "a"] }), {
    ok: true,
    data: { markAll: false, ids: ["a", "b"] },
  });
  assert.deepEqual(validateReadNotificationPayload({ markAll: true }), {
    ok: true,
    data: { markAll: true, ids: [] },
  });
});

test("read payload rejects empty, ambiguous, and malformed requests", () => {
  assert.equal(validateReadNotificationPayload({}).ok, false);
  assert.equal(validateReadNotificationPayload({ ids: [] }).ok, false);
  assert.equal(validateReadNotificationPayload({ ids: ["bad id"] }).ok, false);
  assert.equal(validateReadNotificationPayload({ ids: ["a"], markAll: true }).ok, false);
  assert.equal(validateReadNotificationPayload({ markAll: "true" }).ok, false);
});

test("delete payload enforces explicit scoped or clear-all policy", () => {
  assert.deepEqual(validateDeleteNotificationPayload({ ids: ["ntf-1"] }), {
    ok: true,
    data: { clearAll: false, ids: ["ntf-1"] },
  });
  assert.deepEqual(validateDeleteNotificationPayload({ clearAll: true }), {
    ok: true,
    data: { clearAll: true, ids: [] },
  });
  assert.equal(validateDeleteNotificationPayload({}).ok, false);
  assert.equal(validateDeleteNotificationPayload({ ids: ["x"], clearAll: true }).ok, false);
});

test("customer category contract includes producer categories", () => {
  assert.deepEqual(CUSTOMER_NOTIFICATION_CATEGORIES, [
    "billing",
    "support",
    "product",
    "subscription",
    "storage",
    "bandwidth",
    "system",
    "security",
    "welcome",
  ]);
});
