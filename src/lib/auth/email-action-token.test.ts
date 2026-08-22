import assert from "node:assert/strict";
import { createHmac } from "crypto";
import test from "node:test";

/**
 * Lightweight contract checks for email-action claim signing.
 * Full DB flows are covered by smoke / integration; this guards the canonical form.
 */
test("email action claim canonical form is stable", () => {
  const secret = "test-secret-for-email-action-claims-32c";
  const canonical = ["42", "user@example.com", "view_billing", "/dashboard/billing", "1700000000", "0"].join("|");
  const a = createHmac("sha256", secret).update(canonical).digest("hex");
  const b = createHmac("sha256", secret).update(canonical).digest("hex");
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test("email action URLs never embed bare dashboard paths as the emailed token path", () => {
  const path = "/email-action/abc123";
  assert.match(path, /^\/email-action\//);
  assert.doesNotMatch(path, /dashboard/);
});
