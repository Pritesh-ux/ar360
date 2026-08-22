import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  hasAdminPermission,
  ROLE_PERMISSION_FALLBACK,
} from "@/lib/permissions/admin-permissions";
import { encodeSigned } from "@/lib/signed-token";
import {
  decodeMasterAdminSessionToken,
  isAcceptableMasterAdminSessionPayload,
  isMasterAdminSessionTimeValid,
  MASTER_ADMIN_TOKEN_TYP,
} from "@/lib/auth";

const nowSec = Math.floor(Date.now() / 1000);

function mintAdminToken(overrides: Record<string, unknown> = {}) {
  return encodeSigned({
    id: 1,
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
    typ: MASTER_ADMIN_TOKEN_TYP,
    iat: nowSec,
    exp: nowSec + 3600,
    ...overrides,
  });
}

function mintCustomerToken(overrides: Record<string, unknown> = {}) {
  return encodeSigned({
    id: 1,
    name: "Customer",
    email: "customer@example.com",
    role: "user",
    customerUid: "cust_abc",
    sessionUid: "sess_abc",
    sessionVersion: 1,
    ...overrides,
  });
}

describe("H1 master-admin session privilege confusion", () => {
  it("rejects a valid customer token used as a master-admin token", () => {
    const customerToken = mintCustomerToken({ id: 1 });
    assert.equal(decodeMasterAdminSessionToken(customerToken), null);
    assert.equal(
      isAcceptableMasterAdminSessionPayload({
        id: 1,
        role: "user",
        customerUid: "cust_abc",
        sessionUid: "sess_abc",
      }),
      false,
    );
  });

  it("rejects customer id that collides with a master_admins id", () => {
    // Same numeric id as an admin row would have — must still fail without role/typ.
    const collidingCustomer = mintCustomerToken({ id: 42 });
    assert.equal(decodeMasterAdminSessionToken(collidingCustomer), null);

    // Customer-shaped payload even if an attacker somehow set role:admin without secret
    // (shape check still blocks customer markers).
    assert.equal(
      isAcceptableMasterAdminSessionPayload({
        id: 42,
        role: "admin",
        customerUid: "cust_collide",
        sessionUid: "sess_collide",
        sessionVersion: 1,
        typ: MASTER_ADMIN_TOKEN_TYP,
        exp: nowSec + 60,
      }),
      false,
    );
  });

  it("accepts a valid master-admin token (with typ)", () => {
    const token = mintAdminToken({ id: 7 });
    const decoded = decodeMasterAdminSessionToken(token);
    assert.ok(decoded);
    assert.equal(decoded.id, 7);
    assert.equal(decoded.role, "admin");
    assert.equal(decoded.typ, MASTER_ADMIN_TOKEN_TYP);
  });

  it("accepts legacy master-admin tokens that have role:admin but no typ", () => {
    const legacy = encodeSigned({
      id: 3,
      name: "Legacy Admin",
      email: "legacy@example.com",
      role: "admin",
      iat: nowSec,
      exp: nowSec + 3600,
    });
    const decoded = decodeMasterAdminSessionToken(legacy);
    assert.ok(decoded);
    assert.equal(decoded.id, 3);
    assert.equal(decoded.role, "admin");
  });

  it("rejects forged / invalid tokens", () => {
    assert.equal(decodeMasterAdminSessionToken(undefined), null);
    assert.equal(decodeMasterAdminSessionToken(""), null);
    assert.equal(decodeMasterAdminSessionToken("not.a.token"), null);
    assert.equal(decodeMasterAdminSessionToken("aaaa.bbbb"), null);

    const valid = mintAdminToken();
    const [body] = valid.split(".");
    assert.equal(decodeMasterAdminSessionToken(`${body}.tamperedSignatureXXXX`), null);

    assert.equal(
      isAcceptableMasterAdminSessionPayload({ id: 1, role: "admin", typ: "customer" }),
      false,
    );
    assert.equal(isAcceptableMasterAdminSessionPayload({ id: 1 }), false);
    assert.equal(isAcceptableMasterAdminSessionPayload({ id: -1, role: "admin" }), false);
  });

  it("rejects expired master-admin tokens", () => {
    const expired = mintAdminToken({ exp: nowSec - 10 });
    assert.equal(decodeMasterAdminSessionToken(expired), null);
    assert.equal(isMasterAdminSessionTimeValid({ exp: nowSec - 1 }, nowSec), false);
    assert.equal(isMasterAdminSessionTimeValid({ exp: nowSec + 10 }, nowSec), true);
  });

  it("keeps RBAC permission checks independent of session identity", () => {
    // guardAdminPermission still loads permissions after identity is established.
    assert.equal(
      hasAdminPermission("super_admin", new Set(), "admins.manage"),
      true,
    );
    assert.equal(
      hasAdminPermission("support_admin", new Set(ROLE_PERMISSION_FALLBACK.support_admin), "admins.manage"),
      false,
    );
    assert.equal(
      hasAdminPermission(
        "support_admin",
        new Set(["customers.read"]),
        "customers.read",
      ),
      true,
    );
  });
});

describe("H1 source contracts", () => {
  it("getCurrentMasterAdmin uses decodeMasterAdminSessionToken before DB lookup", async () => {
    const authSrc = await readFile(new URL("../auth.ts", import.meta.url), "utf8");
    assert.match(authSrc, /decodeMasterAdminSessionToken/);
    assert.match(authSrc, /MASTER_ADMIN_TOKEN_TYP/);
    assert.match(authSrc, /isAcceptableMasterAdminSessionPayload/);
    // Must not decode admin cookies with raw decodeSigned alone in getCurrentMasterAdmin.
    const fnStart = authSrc.indexOf("export async function getCurrentMasterAdmin");
    const fnEnd = authSrc.indexOf("export async function getAnyCurrentUser");
    assert.ok(fnStart >= 0 && fnEnd > fnStart);
    const body = authSrc.slice(fnStart, fnEnd);
    assert.match(body, /decodeMasterAdminSessionToken/);
    assert.doesNotMatch(body, /decodeSigned</);
  });

  it("guardAdminPermission still resolves admins via requireApiAdmin", async () => {
    const rbacSrc = await readFile(
      new URL("../permissions/admin-rbac.ts", import.meta.url),
      "utf8",
    );
    assert.match(rbacSrc, /requireApiAdmin/);
    assert.match(rbacSrc, /export async function guardAdminPermission/);
    assert.match(rbacSrc, /loadAdminRbac/);
  });

  it("createMasterAdminSession mints typ + role admin", async () => {
    const authSrc = await readFile(new URL("../auth.ts", import.meta.url), "utf8");
    const fnStart = authSrc.indexOf("export async function createMasterAdminSession");
    const fnEnd = authSrc.indexOf("function clearedSessionCookieOptions");
    const body = authSrc.slice(fnStart, fnEnd);
    assert.match(body, /role:\s*"admin"/);
    assert.match(body, /typ:\s*MASTER_ADMIN_TOKEN_TYP/);
  });
});
