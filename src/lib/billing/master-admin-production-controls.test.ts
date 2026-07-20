import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();

test("Master Admin production billing controls", async (t) => {
  const [migration, settings, controls, subscriptions, packageJson, compose, workerDockerfile] = await Promise.all([
    readFile(`${root}/database/migrations/45_master_admin_billing_controls.sql`, "utf8"),
    readFile(`${root}/src/lib/master-admin-settings.ts`, "utf8"),
    readFile(`${root}/src/app/api/master-admin/billing/controls/route.ts`, "utf8"),
    readFile(`${root}/src/app/api/master-admin/subscriptions/route.ts`, "utf8"),
    readFile(`${root}/package.json`, "utf8"),
    readFile(`${root}/docker-compose.yml`, "utf8"),
    readFile(`${root}/Dockerfile.billing-worker`, "utf8"),
  ]);

  await t.test("persists provider health, alerts, credit notes and mandate state", () => {
    for (const required of [
      "billing_admin_alerts", "billing_provider_health", "billing_credit_notes",
      "mandate_status", "next_charge_at", "publish_status",
    ]) assert.match(migration, new RegExp(required));
  });

  await t.test("encrypts persisted secrets with an environment-held key", () => {
    assert.match(settings, /BILLING_SETTINGS_ENCRYPTION_KEY/);
    assert.match(settings, /aes-256-gcm/);
    assert.match(settings, /razorpayWebhookSecret/);
  });

  await t.test("guards and audits sensitive reconciliation mutations", () => {
    assert.match(controls, /guardAdminPermission/);
    assert.match(controls, /reason\.length < 5/);
    assert.match(controls, /writeMasterAdminAudit/);
  });

  await t.test("excludes manual Enterprise from recurring MRR", () => {
    assert.match(subscriptions, /sales_channel !== "manual"/);
    assert.doesNotMatch(subscriptions, /planId === "enterprise"\) return 24990/);
    assert.match(subscriptions, /manualEnterpriseRevenue/);
  });

  await t.test("packages both production billing workers", () => {
    assert.match(packageJson, /worker:razorpay-webhook/);
    assert.match(packageJson, /worker:razorpay-reconcile/);
    assert.match(compose, /razorpay-webhook-worker:/);
    assert.match(compose, /razorpay-reconciliation-worker:/);
    assert.match(compose, /Dockerfile\.billing-worker/);
    assert.match(workerDockerfile, /COPY src \.\/src/);
    assert.match(workerDockerfile, /worker:razorpay-webhook/);
  });
});

