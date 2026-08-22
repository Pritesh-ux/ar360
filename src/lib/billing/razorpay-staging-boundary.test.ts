import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  applyRazorpayDeployBoundary,
  assertStagingRazorpayNotLive,
  isStagingDeployTarget,
  resolveDeployTarget,
  sanitizeRazorpaySettingsForResponse,
  validateRazorpaySettingsWrite,
} from "@/lib/billing/razorpay-staging-boundary";

const STAGING_ENV = { AR360_DEPLOY_TARGET: "staging" };
const PROD_ENV = { AR360_DEPLOY_TARGET: "production" };

/** Fake TEST key ids — not real credentials. */
const TEST_KEY = "rzp_test_examplekey0001";
const LIVE_KEY = "rzp_live_examplekey0001";

describe("deploy target detection", () => {
  it("detects staging vs production", () => {
    assert.equal(resolveDeployTarget(STAGING_ENV), "staging");
    assert.equal(isStagingDeployTarget(STAGING_ENV), true);
    assert.equal(resolveDeployTarget(PROD_ENV), "production");
    assert.equal(isStagingDeployTarget(PROD_ENV), false);
  });
});

describe("H4 staging Razorpay LIVE hard-block", () => {
  it("allows staging + TEST credentials", () => {
    const write = validateRazorpaySettingsWrite(
      { razorpayKeyId: TEST_KEY, razorpayMode: "test" },
      STAGING_ENV,
    );
    assert.equal(write.ok, true);
    if (write.ok) assert.equal(write.patch.razorpayMode, "test");

    const resolved = applyRazorpayDeployBoundary(
      {
        keyId: TEST_KEY,
        keySecret: "test_secret_value",
        webhookSecret: "test_webhook_value",
        mode: "test",
      },
      { keyId: "", keySecret: "", webhookSecret: "", modeHint: "test" },
      STAGING_ENV,
    );
    assert.equal(resolved.mode, "test");
    assert.equal(resolved.keyId, TEST_KEY);
    assert.ok(resolved.keyId.startsWith("rzp_test_"));
  });

  it("rejects staging + rzp_live_* on settings write", () => {
    const write = validateRazorpaySettingsWrite(
      { razorpayKeyId: LIVE_KEY, razorpayMode: "live" },
      STAGING_ENV,
    );
    assert.equal(write.ok, false);
  });

  it("rejects staging attempt to set live mode without key", () => {
    const write = validateRazorpaySettingsWrite({ razorpayMode: "live" }, STAGING_ENV);
    assert.equal(write.ok, false);
  });

  it("staging database LIVE setting cannot override forced TEST mode", () => {
    const resolved = applyRazorpayDeployBoundary(
      {
        keyId: LIVE_KEY,
        keySecret: "live_secret_should_not_be_used",
        webhookSecret: "live_webhook_should_not_be_used",
        mode: "live",
      },
      {
        keyId: TEST_KEY,
        keySecret: "env_test_secret",
        webhookSecret: "env_test_webhook",
        modeHint: "test",
      },
      STAGING_ENV,
    );
    assert.equal(resolved.mode, "test");
    assert.equal(resolved.keyId, TEST_KEY);
    assert.equal(resolved.keySecret, "env_test_secret");
    assert.equal(resolved.webhookSecret, "env_test_webhook");
    assert.equal(resolved.keyId.startsWith("rzp_live_"), false);
  });

  it("staging checkout resolves TEST credentials only", () => {
    const resolved = applyRazorpayDeployBoundary(
      { keyId: LIVE_KEY, keySecret: "x", webhookSecret: "y", mode: "live" },
      { keyId: TEST_KEY, keySecret: "s", webhookSecret: "w", modeHint: "live" },
      STAGING_ENV,
    );
    assert.equal(resolved.mode, "test");
    assert.ok(resolved.keyId.startsWith("rzp_test_"));
    assert.throws(() => assertStagingRazorpayNotLive({ keyId: LIVE_KEY, mode: "live" }, STAGING_ENV));
    assert.doesNotThrow(() => assertStagingRazorpayNotLive(resolved, STAGING_ENV));
  });

  it("staging with only LIVE available yields empty key rather than LIVE", () => {
    const resolved = applyRazorpayDeployBoundary(
      { keyId: LIVE_KEY, keySecret: "x", webhookSecret: "live_wh", mode: "live" },
      { keyId: LIVE_KEY, keySecret: "x", webhookSecret: "env_wh", modeHint: "live" },
      STAGING_ENV,
    );
    assert.equal(resolved.mode, "test");
    assert.equal(resolved.keyId, "");
    assert.equal(resolved.keySecret, "");
    // LIVE DB webhook must not be used when settings were LIVE
    assert.equal(resolved.webhookSecret, "env_wh");
  });

  it("webhook configuration follows the same staging boundary", () => {
    const resolved = applyRazorpayDeployBoundary(
      {
        keyId: LIVE_KEY,
        keySecret: "live_secret",
        webhookSecret: "stored_live_webhook",
        mode: "live",
      },
      {
        keyId: TEST_KEY,
        keySecret: "test_secret",
        webhookSecret: "env_test_webhook",
        modeHint: "test",
      },
      STAGING_ENV,
    );
    assert.equal(resolved.webhookSecret, "env_test_webhook");
    assert.notEqual(resolved.webhookSecret, "stored_live_webhook");
  });
});

describe("H4 production compatibility", () => {
  it("production configuration path remains allowed for LIVE", () => {
    const write = validateRazorpaySettingsWrite(
      { razorpayKeyId: LIVE_KEY, razorpayMode: "live" },
      PROD_ENV,
    );
    assert.equal(write.ok, true);
    if (write.ok) assert.equal(write.patch.razorpayMode, "live");

    const resolved = applyRazorpayDeployBoundary(
      {
        keyId: LIVE_KEY,
        keySecret: "prod_live_secret",
        webhookSecret: "prod_live_webhook",
        mode: "live",
      },
      { keyId: "", keySecret: "", webhookSecret: "", modeHint: "test" },
      PROD_ENV,
    );
    assert.equal(resolved.mode, "live");
    assert.equal(resolved.keyId, LIVE_KEY);
    assert.doesNotThrow(() => assertStagingRazorpayNotLive(resolved, PROD_ENV));
  });

  it("rejects mismatched mode/key prefix", () => {
    const mismatch = validateRazorpaySettingsWrite(
      { razorpayKeyId: TEST_KEY, razorpayMode: "live" },
      PROD_ENV,
    );
    // Key prefix wins → mode becomes test, which matches TEST_KEY
    assert.equal(mismatch.ok, true);
    if (mismatch.ok) assert.equal(mismatch.patch.razorpayMode, "test");

    const bad = validateRazorpaySettingsWrite(
      { razorpayKeyId: "rzp_other_invalid", razorpayMode: "test" },
      PROD_ENV,
    );
    assert.equal(bad.ok, false);
  });

  it("does not alter non-razorpay settings patches", () => {
    const write = validateRazorpaySettingsWrite({ companyName: "AR360" }, PROD_ENV);
    assert.equal(write.ok, true);
    if (write.ok) {
      assert.equal(write.patch.companyName, "AR360");
      assert.equal("razorpayMode" in write.patch, false);
    }
  });
});

describe("H4 response sanitization / secrets", () => {
  it("sanitizes LIVE key id from staging settings responses", () => {
    const sanitized = sanitizeRazorpaySettingsForResponse(
      { razorpayKeyId: LIVE_KEY, razorpayMode: "live" },
      STAGING_ENV,
    );
    assert.equal(sanitized.razorpayMode, "test");
    assert.equal(sanitized.razorpayKeyId, "");
  });

  it("settings route masks secrets and enforces staging validation", async () => {
    const src = await readFile(
      new URL("../../app/api/master-admin/settings/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(src, /validateRazorpaySettingsWrite/);
    assert.match(src, /maskSecrets/);
    assert.match(src, /razorpayKeySecret: settings\.razorpayKeySecret \? "\*{8}"/);
    assert.match(src, /razorpayWebhookSecret: settings\.razorpayWebhookSecret \? "\*{8}"/);
    assert.match(src, /isStagingDeployTarget/);
    assert.doesNotMatch(src, /RAZORPAY_KEY_SECRET/);
  });

  it("getRazorpayKeys applies deploy boundary", async () => {
    const settingsSrc = await readFile(
      new URL("../master-admin-settings.ts", import.meta.url),
      "utf8",
    );
    assert.match(settingsSrc, /applyRazorpayDeployBoundary/);
    assert.match(settingsSrc, /validateRazorpaySettingsWrite/);

    const configSrc = await readFile(new URL("./razorpay-config.ts", import.meta.url), "utf8");
    assert.match(configSrc, /assertStagingRazorpayNotLive/);
    assert.match(configSrc, /assertRazorpayCheckoutReady/);
  });
});
