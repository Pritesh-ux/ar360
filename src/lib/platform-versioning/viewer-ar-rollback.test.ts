import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertArRollbackKind,
  isEligibleArRollbackStatus,
  validateArSettings,
} from "@/lib/platform-versioning/ar-rollback.service";
import {
  assertViewerRollbackKind,
  isEligibleViewerRollbackStatus,
  validateViewerSettings,
} from "@/lib/platform-versioning/viewer-rollback.service";
import {
  assertLightingRollbackKind,
  isEligibleLightingRollbackStatus,
} from "@/lib/platform-versioning/lighting-rollback.service";
import {
  assertMaterialRollbackKind,
  isEligibleMaterialRollbackStatus,
} from "@/lib/platform-versioning/material-rollback.service";

describe("AR360 Phase 6D viewer + AR rollback guards", () => {
  it("viewer rejects draft and wrong kinds", () => {
    assert.equal(isEligibleViewerRollbackStatus("draft"), false);
    assert.equal(isEligibleViewerRollbackStatus("active"), true);
    assert.equal(assertViewerRollbackKind("viewer"), true);
    assert.equal(assertViewerRollbackKind("ar"), false);
    assert.equal(assertViewerRollbackKind("geometry"), false);
  });

  it("AR rejects draft and wrong kinds", () => {
    assert.equal(isEligibleArRollbackStatus("draft"), false);
    assert.equal(isEligibleArRollbackStatus("archived"), true);
    assert.equal(assertArRollbackKind("ar"), true);
    assert.equal(assertArRollbackKind("viewer"), false);
    assert.equal(assertArRollbackKind("geometry"), false);
  });

  it("viewer-specific validation blocks poison refs", () => {
    assert.equal(validateViewerSettings({ cameraOrbit: "0deg 75deg 105%" }).ok, true);
    assert.equal(
      validateViewerSettings({ backgroundColor: "/__missing__/x.png" }).ok,
      false,
    );
  });

  it("AR-specific validation blocks poison URLs", () => {
    assert.equal(validateArSettings({ showArButton: true, arPlacement: "floor" }).ok, true);
    const bad = validateArSettings({ arModelUrl: "/__missing__/model.glb" });
    assert.equal(bad.ok, false);
    if (bad.ok === false) assert.equal(bad.code, "AR_VALIDATION_FAILED");
  });

  it("does not regress material/lighting rollback guards", () => {
    assert.equal(assertMaterialRollbackKind("material"), true);
    assert.equal(isEligibleMaterialRollbackStatus("draft"), false);
    assert.equal(assertLightingRollbackKind("lighting"), true);
    assert.equal(isEligibleLightingRollbackStatus("draft"), false);
  });

  it("API routes exist and do not implement geometry rollback", () => {
    for (const name of ["viewer-rollback", "ar-rollback"] as const) {
      const list = readFileSync(
        resolve(process.cwd(), `src/app/api/master-admin/ar360/${name}/route.ts`),
        "utf8",
      );
      const detail = readFileSync(
        resolve(process.cwd(), `src/app/api/master-admin/ar360/${name}/[targetId]/route.ts`),
        "utf8",
      );
      assert.match(detail, /ar360\.revision\.rollback/);
      assert.doesNotMatch(detail, /rollbackGeometryRevision/);
      assert.doesNotMatch(list, /geometry-rollback/);
    }
    const core = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/pointer-rollback-core.ts"),
      "utf8",
    );
    assert.match(core, /active_viewer_revision_id/);
    assert.match(core, /active_ar_revision_id/);
    assert.doesNotMatch(core, /SET active_geometry_revision_id/);
    assert.match(core, /VIEWER ROLLBACK PREVIEW/);
    assert.match(core, /AR ROLLBACK PREVIEW/);
    assert.match(core, /DEPENDENCY_CONFLICT/);
  });
});
