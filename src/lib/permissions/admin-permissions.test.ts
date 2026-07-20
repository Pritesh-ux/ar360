import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_ADMIN_PERMISSIONS,
  hasAdminPermission,
  ROLE_PERMISSION_FALLBACK,
} from "./admin-permissions";

describe("Enterprise RBAC fallback permissions", () => {
  it("grants sales management only to intended operational roles", () => {
    for (const role of ["super_admin", "operations_admin", "billing_admin"] as const) {
      assert.equal(
        ROLE_PERMISSION_FALLBACK[role].includes("enterprise_requests.read"),
        true,
        `${role} should read Enterprise requests`,
      );
      assert.equal(
        ROLE_PERMISSION_FALLBACK[role].includes("enterprise_requests.manage"),
        true,
        `${role} should manage Enterprise requests`,
      );
    }
  });

  it("does not broaden support, content, analytics, or read-only fallbacks", () => {
    for (const role of ["support_admin", "content_admin", "analytics_viewer", "read_only"] as const) {
      assert.equal(ROLE_PERMISSION_FALLBACK[role].includes("enterprise_requests.read"), false);
      assert.equal(ROLE_PERMISSION_FALLBACK[role].includes("enterprise_requests.manage"), false);
    }
  });

  it("keeps super-admin override while ordinary roles require explicit permission", () => {
    assert.equal(
      hasAdminPermission("super_admin", new Set(), "enterprise_requests.manage"),
      true,
    );
    assert.equal(
      hasAdminPermission("support_admin", new Set(), "enterprise_requests.manage"),
      false,
    );
    assert.equal(
      hasAdminPermission(
        "support_admin",
        new Set(["enterprise_requests.manage"]),
        "enterprise_requests.manage",
      ),
      true,
    );
    assert.equal(ALL_ADMIN_PERMISSIONS.includes("enterprise_requests.manage"), true);
  });
});

describe("Object Capture RBAC fallback permissions", () => {
  it("grants operations full capture control", () => {
    for (const permission of ["object_capture.read", "object_capture.manage", "object_capture.download"] as const) {
      assert.equal(ROLE_PERMISSION_FALLBACK.operations_admin.includes(permission), true);
    }
  });

  it("keeps management and downloads away from read-only operational viewers", () => {
    for (const role of ["support_admin", "content_admin", "analytics_viewer", "read_only"] as const) {
      assert.equal(ROLE_PERMISSION_FALLBACK[role].includes("object_capture.read"), true);
      assert.equal(ROLE_PERMISSION_FALLBACK[role].includes("object_capture.manage"), false);
      assert.equal(ROLE_PERMISSION_FALLBACK[role].includes("object_capture.download"), false);
    }
  });
});
