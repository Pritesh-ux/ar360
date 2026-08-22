import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertLightingRollbackKind,
  isEligibleLightingRollbackStatus,
  validateLightingEnvironmentRefs,
} from "@/lib/platform-versioning/lighting-rollback.service";
import {
  assertMaterialRollbackKind,
  isEligibleMaterialRollbackStatus,
} from "@/lib/platform-versioning/material-rollback.service";

describe("AR360 Phase 6C lighting rollback guards", () => {
  it("rejects draft status for eligibility", () => {
    assert.equal(isEligibleLightingRollbackStatus("draft"), false);
    assert.equal(isEligibleLightingRollbackStatus("active"), true);
    assert.equal(isEligibleLightingRollbackStatus("archived"), true);
  });

  it("allows only lighting kind", () => {
    assert.equal(assertLightingRollbackKind("lighting"), true);
    assert.equal(assertLightingRollbackKind("material"), false);
    assert.equal(assertLightingRollbackKind("viewer"), false);
    assert.equal(assertLightingRollbackKind("ar"), false);
    assert.equal(assertLightingRollbackKind("geometry"), false);
    assert.equal(assertLightingRollbackKind("config"), false);
  });

  it("validates HDRI/environment refs", () => {
    assert.equal(validateLightingEnvironmentRefs({ environmentImage: "neutral" }).ok, true);
    assert.equal(
      validateLightingEnvironmentRefs({
        environmentImage: "/__missing__/gone.hdr",
      }).ok,
      false,
    );
    assert.equal(
      validateLightingEnvironmentRefs({
        skyboxImage: "/does-not-exist/x.hdr",
      }).ok,
      false,
    );
  });

  it("does not regress material rollback kind guards", () => {
    assert.equal(assertMaterialRollbackKind("material"), true);
    assert.equal(isEligibleMaterialRollbackStatus("draft"), false);
  });

  it("API routes and audit wiring exist for lighting rollback", () => {
    const list = readFileSync(
      resolve(process.cwd(), "src/app/api/master-admin/ar360/lighting-rollback/route.ts"),
      "utf8",
    );
    const detail = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/master-admin/ar360/lighting-rollback/[targetId]/route.ts",
      ),
      "utf8",
    );
    assert.match(list, /listLightingRollbackTargets/);
    assert.match(detail, /previewLightingRollback/);
    assert.match(detail, /rollbackLightingRevision/);
    assert.match(detail, /ar360\.revision\.rollback/);
    assert.match(detail, /component:\s*"lighting"/);
    assert.match(detail, /recordLightingRollbackChange/);
    assert.doesNotMatch(detail, /rollbackViewerRevision/);
    assert.doesNotMatch(detail, /rollbackArRevision/);
    assert.doesNotMatch(detail, /rollbackGeometryRevision/);
  });

  it("service only updates active_lighting_revision_id", () => {
    const service = readFileSync(
      resolve(process.cwd(), "src/lib/platform-versioning/lighting-rollback.service.ts"),
      "utf8",
    );
    assert.match(service, /SET active_lighting_revision_id/);
    assert.doesNotMatch(service, /SET active_material_revision_id/);
    assert.doesNotMatch(service, /SET active_viewer_revision_id/);
    assert.doesNotMatch(service, /SET active_ar_revision_id/);
    assert.doesNotMatch(service, /SET active_geometry_revision_id/);
    assert.match(service, /LIGHTING ROLLBACK PREVIEW/);
  });
});
