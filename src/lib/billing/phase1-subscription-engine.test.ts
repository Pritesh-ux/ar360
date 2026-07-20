import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();

test("Phase 1 subscription engine wiring", async (t) => {
  const [
    migration,
    permissions,
    engine,
    pastDue,
    lifecycle,
    razorpayPlan,
    checkout,
    selfService,
  ] = await Promise.all([
    readFile(`${root}/database/migrations/51_subscription_engine_phase1.sql`, "utf8"),
    readFile(`${root}/src/lib/billing/permissions.ts`, "utf8"),
    readFile(`${root}/src/lib/billing/subscription-engine.ts`, "utf8"),
    readFile(`${root}/src/server/billing/subscription.service.ts`, "utf8"),
    readFile(`${root}/src/lib/email/lifecycle-scheduler.service.ts`, "utf8"),
    readFile(`${root}/src/server/billing/razorpay-plan.service.ts`, "utf8"),
    readFile(`${root}/src/app/dashboard/billing/checkout/CheckoutClient.tsx`, "utf8"),
    readFile(`${root}/src/lib/billing/self-service-plans.ts`, "utf8"),
  ]);

  await t.test("migration adds Object Capture columns", () => {
    assert.match(migration, /allow_object_capture/);
    assert.match(migration, /oc_captures_per_month/);
    assert.match(migration, /enterprise_custom_plans/);
  });

  await t.test("central assertCan exists for Phase 1 actions", () => {
    assert.match(permissions, /export async function assertCan/);
    for (const action of [
      "access_dashboard",
      "create_product",
      "qr",
      "share",
      "embed",
      "custom_branding",
      "object_capture",
    ]) {
      assert.match(permissions, new RegExp(`"${action}"`));
    }
  });

  await t.test("subscription engine exposes getSubscriptionContext", () => {
    assert.match(engine, /export async function getSubscriptionContext/);
    assert.match(engine, /daysRemaining/);
  });

  await t.test("past_due preserves current plan_id", () => {
    assert.match(pastDue, /markSubscriptionPastDue/);
    assert.match(pastDue, /existing\?\.plan_id \|\| "trial"/);
    assert.doesNotMatch(
      pastDue.slice(pastDue.indexOf("markSubscriptionPastDue")),
      /planId:\s*"trial"/,
    );
  });

  await t.test("expiry warnings include 14/7/3/1/0 days", () => {
    assert.match(lifecycle, /\[14, 7, 3, 1, 0\]/);
    assert.match(lifecycle, /INTERVAL 14 DAY/);
  });

  await t.test("self-service is DB sales_channel based", () => {
    assert.match(selfService, /salesChannel === "self_service"/);
    assert.match(razorpayPlan, /assertSelfServicePlan/);
    assert.doesNotMatch(razorpayPlan, /\["starter", "pro", "business"\]\.includes/);
    assert.match(checkout, /salesChannel !== "manual"/);
  });
});
