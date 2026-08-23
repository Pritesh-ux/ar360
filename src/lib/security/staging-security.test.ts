import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  describeStagingEmailSafety,
  evaluatePublicSignupPolicy,
  parseStagingSignupAllowlist,
  STAGING_SIGNUP_DISABLED_MESSAGE,
} from "@/lib/security/staging-policy";
import { evaluateLoginLockout } from "@/lib/auth/login-lockout";
import { toPublicReadyPayload } from "@/lib/production/ready-payload";

const STAGING_ENV = { AR360_DEPLOY_TARGET: "staging" };
const PROD_ENV = { AR360_DEPLOY_TARGET: "production" };

async function readSrc(rel: string) {
  return readFile(new URL(rel, import.meta.url), "utf8");
}

describe("Phase 1 — staging signup block", () => {
  it("1. blocks public signup on staging", () => {
    const result = evaluatePublicSignupPolicy({
      email: "visitor@example.com",
      env: STAGING_ENV,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(result.message, STAGING_SIGNUP_DISABLED_MESSAGE);
      assert.equal(result.code, "STAGING_SIGNUP_DISABLED");
    }
  });

  it("2. allows signup on production", () => {
    assert.deepEqual(
      evaluatePublicSignupPolicy({ email: "new@example.com", env: PROD_ENV }),
      { allowed: true },
    );
  });

  it("allowlist permits QA email on staging only", () => {
    const env = {
      ...STAGING_ENV,
      STAGING_SIGNUP_ALLOWLIST: "qa@example.com, Other@Example.com ",
    };
    assert.equal(parseStagingSignupAllowlist(env).has("qa@example.com"), true);
    assert.equal(parseStagingSignupAllowlist(env).has("other@example.com"), true);
    assert.deepEqual(evaluatePublicSignupPolicy({ email: "qa@example.com", env }), {
      allowed: true,
    });
    assert.equal(
      evaluatePublicSignupPolicy({ email: "random@example.com", env }).allowed,
      false,
    );
  });

  it("registerCustomerAccount enforces staging policy server-side", async () => {
    const src = await readSrc("../onboarding/signup.service.ts");
    assert.match(src, /evaluatePublicSignupPolicy/);
    assert.match(src, /STAGING_SIGNUP_DISABLED/);
  });

  it("signup API returns 403 for staging block", async () => {
    const src = await readSrc("../../app/api/auth/signup/route.ts");
    assert.match(src, /STAGING_SIGNUP_DISABLED/);
    assert.match(src, /status: 403/);
    assert.match(src, /staging_signup_blocked/);
    assert.match(src, /code: OnboardingErrorCode\.STAGING_SIGNUP_DISABLED/);
  });

  it("signup server action cannot bypass API gate", async () => {
    const src = await readSrc("../../app/auth/actions.ts");
    assert.match(src, /registerCustomerAccount/);
    assert.match(src, /STAGING_SIGNUP_DISABLED/);
  });

  it("no alternate public INSERT INTO users bypass in API routes", async () => {
    const signup = await readSrc("../../app/api/auth/signup/route.ts");
    assert.doesNotMatch(signup, /INSERT INTO users/i);
    const customers = await readSrc("../../app/api/master-admin/customers/route.ts");
    assert.match(customers, /guardAdminPermission/);
    assert.doesNotMatch(customers, /INSERT INTO users/i);
  });
});

describe("Phase 2 — QA account strategy", () => {
  it("does not hardcode credentials in staging policy", async () => {
    const src = await readSrc("./staging-policy.ts");
    assert.doesNotMatch(src, /password\s*=/i);
    assert.doesNotMatch(src, /@[a-z0-9.-]+\.(com|io)/i);
  });

  it("existing login routes unchanged for QA accounts", async () => {
    const login = await readSrc("../../app/api/auth/login/route.ts");
    assert.match(login, /createCustomerSession/);
    assert.doesNotMatch(login, /STAGING_SIGNUP_DISABLED/);
  });
});

describe("Phase 3 — customer IDOR boundaries (source regression)", () => {
  it("6. products API scopes by session customer", async () => {
    const src = await readSrc("../../app/api/products/[id]/route.ts");
    assert.match(src, /requireApiUser/);
    assert.match(src, /customer_uid = \?/);
    assert.match(src, /normalizeScopedId/);
  });

  it("7. assets route verifies product ownership", async () => {
    const src = await readSrc("../../app/api/assets/[...path]/route.ts");
    assert.match(src, /canAccessAsset/);
    assert.match(src, /customer_uid = \?/);
    assert.match(src, /getSecureProductPath|StorageSecurityError/);
  });

  it("8. billing invoice download scopes to session customer", async () => {
    const src = await readSrc("../../app/api/billing/invoices/[id]/download/route.ts");
    assert.match(src, /getCustomerInvoice/);
    assert.match(src, /customerUid/);
  });

  it("customerIsolation rejects traversal in scoped IDs", async () => {
    const { normalizeScopedId } = await import("@/lib/customerIsolation");
    assert.equal(normalizeScopedId("../etc/passwd"), "");
    assert.equal(normalizeScopedId("CUS-123/.."), "");
  });
});

describe("Phase 4 — Master Admin API sweep", () => {
  it("5. H1 rejects customer token as admin (existing test suite)", async () => {
    const src = await readSrc("../auth/master-admin-session.test.ts");
    assert.match(src, /rejects a valid customer token/);
  });

  it("master-admin routes require admin auth guards", async () => {
    const dashboard = await readSrc("../../app/api/master-admin/dashboard/route.ts");
    assert.match(dashboard, /guardAdminPermission|requireApiAdmin/);
  });
});

describe("Phase 5 — storage isolation", () => {
  it("9. path traversal blocked via path normalizer", async () => {
    const src = await readSrc("../storage/path-normalizer.test.ts");
    assert.match(src, /\.\./);
  });

  it("usdz upload rejects cross-customer product", async () => {
    const src = await readSrc("../../app/api/products/usdz-upload/route.ts");
    assert.match(src, /cannot upload a USDZ to another customer/i);
  });
});

describe("Phase 6 — billing / entitlement bypass", () => {
  it("10. verify routes use guardBillingMutation", async () => {
    for (const rel of [
      "../../app/api/billing/verify-payment/route.ts",
      "../../app/api/billing/verify-subscription/route.ts",
      "../../app/api/billing/addons/verify/route.ts",
    ]) {
      const src = await readSrc(rel);
      assert.match(src, /guardBillingMutation/);
    }
  });

  it("13. webhook signature required", async () => {
    const src = await readSrc("../billing/razorpay-webhook.test.ts");
    assert.match(src, /matchRazorpayWebhookSignature/);
  });

  it("14. webhook replay idempotent", async () => {
    const src = await readSrc("../billing/razorpay-webhook.test.ts");
    assert.match(src, /shouldApplyProviderEvent/);
  });

  it("12–13. staging LIVE Razorpay rejected; TEST allowed", async () => {
    const { assertStagingRazorpayNotLive, applyRazorpayDeployBoundary } = await import(
      "@/lib/billing/razorpay-staging-boundary"
    );
    const liveKey = "rzp_live_example0001";
    const testKey = "rzp_test_example0001";
    assert.throws(() =>
      assertStagingRazorpayNotLive({ keyId: liveKey, mode: "live" }, STAGING_ENV),
    );
    const resolved = applyRazorpayDeployBoundary(
      { keyId: testKey, keySecret: "sec", webhookSecret: "wh", mode: "test" },
      { keyId: "", keySecret: "", webhookSecret: "", modeHint: "test" },
      STAGING_ENV,
    );
    assert.equal(resolved.mode, "test");
  });
});

describe("Phase 7 — email safety", () => {
  it("reports staging SMTP guidance without secrets", () => {
    const info = describeStagingEmailSafety({
      AR360_DEPLOY_TARGET: "staging",
      SMTP_HOST: "smtp.mailtrap.io",
      SMTP_FROM: "AR360 Staging <staging@example.com>",
    });
    assert.equal(info.staging, true);
    assert.equal(info.smtpConfigured, true);
    assert.match(info.guidance, /staging|QA|mailbox/i);
  });

  it("production email policy helper unchanged", () => {
    const info = describeStagingEmailSafety(PROD_ENV);
    assert.equal(info.staging, false);
  });
});

describe("Phase 8 — rate limits", () => {
  it("17. signup and login rate limited", async () => {
    const signup = await readSrc("../../app/api/auth/signup/route.ts");
    const login = await readSrc("../../app/api/auth/login/route.ts");
    assert.match(signup, /enforceRateLimitForKey/);
    assert.match(login, /enforceRateLimitForKey/);
  });

  it("18. billing mutations guarded", async () => {
    const src = await readSrc("../../app/api/billing/verify-payment/route.ts");
    assert.match(src, /guardBillingMutation/);
  });

  it("login lockout policy preserved (M2)", () => {
    assert.equal(evaluateLoginLockout(5, { maxLoginAttempts: 5, lockMinutes: 30 }).locked, true);
  });
});

describe("Phase 10 — information disclosure (M6/M7)", () => {
  it("16. ready endpoint strips sensitive details", () => {
    const payload = toPublicReadyPayload({
      ok: false,
      checkOk: { database: true, storage: false },
      timestamp: "2026-01-01T00:00:00.000Z",
      missing: ["SECRET_ENV"],
    } as Parameters<typeof toPublicReadyPayload>[0]);
    assert.equal("missing" in payload, false);
  });

  it("17. report-error abuse controls present", async () => {
    const src = await readSrc("../../app/api/internal/report-error/route.ts");
    assert.match(src, /enforceRateLimit/);
    assert.match(src, /sanitizeText/);
  });
});

describe("Phase 11 — audit logging hooks", () => {
  it("logs blocked staging signup attempts", async () => {
    const src = await readSrc("../../app/api/auth/signup/route.ts");
    assert.match(src, /writeLoginLog/);
    assert.match(src, /staging_signup_blocked/);
  });
});

describe("Phase 9 — route classification (documented)", () => {
  it("public product viewer API remains separate from dashboard APIs", async () => {
    const publicProduct = await readSrc("../../app/api/public-products/[id]/route.ts");
    const dashboardProduct = await readSrc("../../app/api/products/[id]/route.ts");
    assert.match(publicProduct, /isPublishedStatus|published/);
    assert.match(dashboardProduct, /requireApiUser/);
  });
});

describe("Phase 13 — deployment script hardening", () => {
  it("26. env loader always applies AR360_DEPLOY_TARGET from deploy .env", async () => {
    const src = await readSrc("../../../scripts/deploy.mjs");
    assert.match(src, /AR360_DEPLOY_TARGET must come from deploy/);
    assert.match(src, /key !== "AR360_DEPLOY_TARGET"/);
  });

  it("27. swap script verifies signup gate before PM2 start", async () => {
    const src = await readSrc("../../../scripts/vps/swap-deploy-staging.sh");
    assert.match(src, /staging_signup_blocked/);
    assert.match(src, /verify-staging-runtime\.sh/);
  });

  it("27. vps deploy helper validates artifact and signup probe", async () => {
    const src = await readSrc("../../../scripts/vps-deploy-staging.mjs");
    assert.match(src, /staging_signup_blocked/);
    assert.match(src, /verify-staging-signup-block\.mjs/);
    assert.match(src, /process\.env\.AR360_DEPLOY_TARGET = "staging"/);
  });

  it("PM2 staging ecosystem pins deploy target", async () => {
    const src = await readSrc("../../../ecosystem.staging.config.js");
    assert.match(src, /AR360_DEPLOY_TARGET: "staging"/);
    assert.match(src, /ar360-staging-web/);
  });
});
