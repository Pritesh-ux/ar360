import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { evaluateLoginLockout } from "@/lib/auth/login-lockout";
import { toPublicReadyPayload } from "@/lib/production/ready-payload";
import { getClearedSessionCookieOptions } from "@/lib/auth";

describe("M1 clients DELETE ownership", () => {
  it("scopes client_resources delete to owned clients", async () => {
    const src = await readFile(
      new URL("../../app/api/clients/[id]/route.ts", import.meta.url),
      "utf8",
    );
    const start = src.indexOf("export async function DELETE");
    const end = src.indexOf("async function assertResourceOwned", start);
    const body = src.slice(start, end);
    assert.match(body, /SELECT client_uid FROM clients WHERE client_uid = \? AND customer_uid = \?/);
    assert.match(body, /DELETE FROM client_resources/);
    assert.match(body, /customer_uid = \?/);
    assert.match(body, /Client not found/);
  });
});

describe("M2 login lockout policy", () => {
  it("locks when failed attempts reach threshold", () => {
    const locked = evaluateLoginLockout(5, { maxLoginAttempts: 5, lockMinutes: 30 });
    assert.equal(locked.locked, true);
    assert.equal(locked.retryAfterSec, 1800);
  });

  it("allows attempts below threshold", () => {
    const open = evaluateLoginLockout(4, { maxLoginAttempts: 5, lockMinutes: 30 });
    assert.equal(open.locked, false);
  });

  it("customer and admin login routes enforce lockout", async () => {
    const customer = await readFile(new URL("../../app/api/auth/login/route.ts", import.meta.url), "utf8");
    const admin = await readFile(
      new URL("../../app/api/master-admin/auth/login/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(customer, /checkEmailLoginLockout/);
    assert.match(admin, /checkEmailLoginLockout/);
    assert.match(customer, /enforceRateLimitForKey/);
  });
});

describe("M3 billing verify rate limits", () => {
  it("verify routes use guardBillingMutation", async () => {
    for (const rel of [
      "../../app/api/billing/verify-payment/route.ts",
      "../../app/api/billing/verify-subscription/route.ts",
      "../../app/api/billing/addons/verify/route.ts",
    ]) {
      const src = await readFile(new URL(rel, import.meta.url), "utf8");
      assert.match(src, /guardBillingMutation/);
    }
  });
});

describe("M4 admin logout POST", () => {
  it("mutates on POST only; GET does not clear session", async () => {
    const src = await readFile(new URL("../../app/master-admin/logout/route.ts", import.meta.url), "utf8");
    assert.match(src, /export async function POST/);
    assert.match(src, /clearAdminSession/);
    const getStart = src.indexOf("export async function GET");
    const getBody = src.slice(getStart);
    assert.doesNotMatch(getBody, /clearAdminSession/);
  });
});

describe("M5 impersonation cookie clear", () => {
  it("stopCustomerImpersonation clears with domain-aware options", async () => {
    const src = await readFile(new URL("../auth.ts", import.meta.url), "utf8");
    const start = src.indexOf("export async function stopCustomerImpersonation");
    const end = src.indexOf("export async function getImpersonationContext");
    const body = src.slice(start, end);
    assert.match(body, /clearedSessionCookieOptions/);
    assert.doesNotMatch(body, /cookieStore\.delete\(/);
    const cleared = getClearedSessionCookieOptions();
    assert.equal(cleared.path, "/");
    assert.equal(cleared.maxAge, 0);
    assert.equal(cleared.sameSite, "lax");
  });
});

describe("M6 ready endpoint public payload", () => {
  it("strips details and missing env names from public payload", () => {
    const payload = toPublicReadyPayload({
      ok: false,
      checkOk: { database: true, storage: false },
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(payload.ok, false);
    assert.equal(payload.status, "degraded");
    assert.deepEqual(payload.checks.storage, { ok: false });
    assert.equal("detail" in (payload.checks.storage as object), false);
    assert.equal("missing" in payload, false);
  });

  it("requires internal key for detailed ready checks in source", async () => {
    const src = await readFile(new URL("../../app/api/ready/route.ts", import.meta.url), "utf8");
    assert.match(src, /hasInternalReadyAccess/);
    assert.match(src, /toPublicReadyPayload/);
  });
});

describe("M7 report-error abuse controls", () => {
  it("rate-limits and truncates payloads", async () => {
    const src = await readFile(
      new URL("../../app/api/internal/report-error/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(src, /enforceRateLimit/);
    assert.match(src, /MAX_MESSAGE/);
    assert.match(src, /Payload too large/);
    assert.match(src, /sanitizeText/);
  });
});
