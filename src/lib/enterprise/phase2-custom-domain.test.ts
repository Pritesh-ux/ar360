import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getPlatformHosts,
  isPublicCustomDomainPath,
  normalizeRequestHost,
} from "@/lib/enterprise/custom-domain-headers";
import { getDomainInstructions, txtIncludesToken } from "@/lib/enterprise/domains.service";
import { isEmbedDomainAllowed } from "@/lib/growth/embed.service";

const root = process.cwd();

test("Phase 2 custom domain TXT verification helper", () => {
  assert.equal(txtIncludesToken(["arv_abc"], "arv_abc"), true);
  assert.equal(txtIncludesToken(["other", "arv_abc"], "arv_abc"), true);
  assert.equal(txtIncludesToken(["arv_nope"], "arv_abc"), false);
  assert.equal(txtIncludesToken([], "arv_abc"), false);
});

test("Phase 2 DEFAULT_PLAN_LIMITS custom domain flags", async () => {
  const { DEFAULT_PLAN_LIMITS } = await import("@/lib/billing/plan-enforcement");
  assert.equal(DEFAULT_PLAN_LIMITS.trial.allowCustomDomain, false);
  assert.equal(DEFAULT_PLAN_LIMITS.pro.allowCustomDomain, false);
  assert.equal(DEFAULT_PLAN_LIMITS.business.allowCustomDomain, true);
  assert.equal(DEFAULT_PLAN_LIMITS.enterprise.allowCustomDomain, true);
});

test("Phase 2 domain instructions use _arverify TXT host", () => {
  const instructions = getDomainInstructions({
    id: 1,
    workspace_uid: "ws_1",
    customer_uid: "cu_1",
    domain: "ar.brand.com",
    verification_token: "arv_token123",
    status: "pending",
    ssl_status: "none",
    is_primary: 0,
    last_check_at: null,
    last_error: null,
    verified_at: null,
    created_at: "",
    updated_at: "",
  });
  assert.equal(instructions.txtHost, "_arverify.ar.brand.com");
  assert.equal(instructions.txtValue, "arv_token123");
  assert.equal(instructions.cnameHost, "ar.brand.com");
  assert.match(instructions.sslNote, /does not issue certificates/i);
});

test("Phase 2 public path matcher for Host middleware", () => {
  assert.equal(isPublicCustomDomainPath("/viewer/abc"), true);
  assert.equal(isPublicCustomDomainPath("/c/cli_abc"), true);
  assert.equal(isPublicCustomDomainPath("/embed/abc"), true);
  assert.equal(isPublicCustomDomainPath("/s/token"), true);
  assert.equal(isPublicCustomDomainPath("/qr/code"), true);
  assert.equal(isPublicCustomDomainPath("/api/public-products/x"), true);
  assert.equal(isPublicCustomDomainPath("/dashboard/settings"), false);
  assert.equal(normalizeRequestHost("Ar.Brand.Com:443"), "ar.brand.com");
  assert.ok(getPlatformHosts().has("localhost"));
});

test("Phase 2 embed allowlist enforcement", () => {
  assert.equal(isEmbedDomainAllowed([], "https://shop.example.com/page"), true);
  assert.equal(isEmbedDomainAllowed(["shop.example.com"], "https://shop.example.com/page"), true);
  assert.equal(isEmbedDomainAllowed(["example.com"], "https://shop.example.com/page"), true);
  assert.equal(isEmbedDomainAllowed(["shop.example.com"], "https://evil.com/page"), false);
  assert.equal(isEmbedDomainAllowed(["shop.example.com"], ""), false);
});

test("Phase 2 wiring: gates, middleware, logo assertCan, branded origin", async (t) => {
  const [
    migration,
    permissions,
    domainsApi,
    logoRoute,
    middleware,
    publishRoute,
    brandingService,
    domainsService,
  ] = await Promise.all([
    readFile(`${root}/database/migrations/52_custom_domain_phase2.sql`, "utf8"),
    readFile(`${root}/src/lib/billing/permissions.ts`, "utf8"),
    readFile(`${root}/src/app/api/enterprise/domains/route.ts`, "utf8"),
    readFile(`${root}/src/app/api/enterprise/branding/logo/route.ts`, "utf8"),
    readFile(`${root}/middleware.ts`, "utf8"),
    readFile(`${root}/src/app/api/products/[id]/publish/route.ts`, "utf8"),
    readFile(`${root}/src/lib/enterprise/branding.service.ts`, "utf8"),
    readFile(`${root}/src/lib/enterprise/domains.service.ts`, "utf8"),
  ]);

  await t.test("migration seeds allow_custom_domain", () => {
    assert.match(migration, /allow_custom_domain/);
    assert.match(migration, /is_primary/);
    assert.match(migration, /last_error/);
  });

  await t.test("assertCan includes custom_domain", () => {
    assert.match(permissions, /"custom_domain"/);
    assert.match(permissions, /allowCustomDomain/);
  });

  await t.test("domains API enforces custom_domain permission", () => {
    assert.match(domainsApi, /enforcePermission/);
    assert.match(domainsApi, /custom_domain/);
    assert.match(domainsApi, /domains\.manage/);
  });

  await t.test("logo route uses assertCan via enforcePermission", () => {
    assert.match(logoRoute, /enforcePermission/);
    assert.match(logoRoute, /custom_branding/);
    assert.doesNotMatch(logoRoute, /getBillingEntitlement/);
  });

  await t.test("middleware maps custom Host for public surfaces", () => {
    assert.match(middleware, /withCustomDomainContext/);
    assert.match(middleware, /\/viewer\/:path\*/);
    assert.match(middleware, /\/embed\/:path\*/);
    assert.match(middleware, /\/api\/internal\/custom-domain/);
  });

  await t.test("publish uses branded origin helper", () => {
    assert.match(publishRoute, /resolveBrandedOriginForCustomer/);
  });

  await t.test("getViewerBranding documents workspace preference rule", () => {
    assert.match(brandingService, /primary verified custom domain/i);
    assert.match(brandingService, /ORDER BY created_at ASC/);
  });

  await t.test("resolveBrandedOrigin prefers verified primary domain", () => {
    assert.match(domainsService, /export async function resolveBrandedOrigin/);
    assert.match(domainsService, /getPrimaryCustomDomainOrigin/);
    assert.match(domainsService, /dns\.resolveTxt|resolveTxt/);
  });
});
