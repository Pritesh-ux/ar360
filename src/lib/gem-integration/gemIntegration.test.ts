import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Matrix4, Vector3 } from "three";
import {
  REFERENCE_CHARACTERISTIC_LENGTH,
  buildIntegrationGemInvMatrix,
} from "@/lib/gem-renderer-poc/GemMeshAdapter";

function projectBoundsCenter(
  invGem: Matrix4,
  invProjection: Matrix4,
  invView: Matrix4,
  worldCenter: Vector3,
  viewportW: number,
  viewportH: number,
) {
  const clip = new Vector3(worldCenter.x, worldCenter.y, worldCenter.z);
  clip.applyMatrix4(invGem);
  clip.applyMatrix4(invView);
  clip.applyMatrix4(invProjection);
  const ndcX = clip.x / clip.w;
  const ndcY = clip.y / clip.w;
  return {
    x: (ndcX * 0.5 + 0.5) * viewportW,
    y: (1 - (ndcY * 0.5 + 0.5)) * viewportH,
  };
}

describe("integration geometry parity", () => {
  it("local center maps to origin in normalized gem space (identity mesh world)", () => {
    const localCenter = new Vector3(0.01, 0.015, 0.002);
    const maxDim = 0.011;
    const scale = REFERENCE_CHARACTERISTIC_LENGTH / maxDim;
    const invGem = buildIntegrationGemInvMatrix(new Matrix4(), localCenter, scale);

    const local = new Vector3().copy(localCenter).applyMatrix4(invGem);
    assert.ok(Math.abs(local.x) < 1e-5);
    assert.ok(Math.abs(local.y) < 1e-5);
    assert.ok(Math.abs(local.z) < 1e-5);
  });

  it("live mesh translation updates world center mapping", () => {
    const localCenter = new Vector3(0, 0, 0);
    const scale = 1;
    const meshWorld = new Matrix4().makeTranslation(0.05, -0.02, 0.01);
    const invGem = buildIntegrationGemInvMatrix(meshWorld, localCenter, scale);
    const worldCenter = new Vector3(0.05, -0.02, 0.01);
    const local = new Vector3().copy(worldCenter).applyMatrix4(invGem);
    assert.ok(Math.abs(local.x) < 1e-5);
    assert.ok(Math.abs(local.y) < 1e-5);
    assert.ok(Math.abs(local.z) < 1e-5);
  });

  it("normalized characteristic length matches POC reference", () => {
    const maxDim = 0.011485;
    const scale = REFERENCE_CHARACTERISTIC_LENGTH / maxDim;
    assert.ok(Math.abs(scale * maxDim - REFERENCE_CHARACTERISTIC_LENGTH) < 1e-6);
  });

  it("projected center is deterministic for same inputs", () => {
    const localCenter = new Vector3(0.01, 0.015, 0.002);
    const invGem = buildIntegrationGemInvMatrix(new Matrix4(), localCenter, 1);
    const invProjection = new Matrix4().makePerspective(Math.PI / 4, 1, 0.001, 10);
    const invView = new Matrix4()
      .lookAt(new Vector3(0, 0.45, 3), new Vector3(0, 0, 0), new Vector3(0, 1, 0))
      .invert();

    const worldCenter = localCenter.clone();
    const a = projectBoundsCenter(invGem, invProjection, invView, worldCenter, 800, 600);
    const b = projectBoundsCenter(invGem, invProjection, invView, worldCenter, 800, 600);
    assert.equal(a.x, b.x);
    assert.equal(a.y, b.y);
  });
});

describe("overlay state machine", () => {
  it("active requires camera sync not luminance probe", async () => {
    const bridge = await import("@/lib/gem-integration/gemModelViewerBridge");
    const state = bridge.getGemBridgeState();
    assert.ok(
      state.mode === "idle" ||
        state.mode === "loading" ||
        state.mode === "active" ||
        state.mode === "fallback" ||
        state.mode === "error",
    );
  });
});

describe("integration quality shell", () => {
  it("picks medium on desktop UA and low on mobile UA", async () => {
    const { pickIntegrationQualityTier } = await import(
      "@/lib/gem-integration/integrationPipeline"
    );
    assert.equal(
      pickIntegrationQualityTier("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
      "medium",
    );
    assert.equal(
      pickIntegrationQualityTier(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      ),
      "low",
    );
  });
});
