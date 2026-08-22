import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPricingChecklist, featureLabelsFromLimits } from "./pricing-features";

describe("buildPricingChecklist", () => {
  it("adds companion lines (Download QR, Viewer Link, Email support)", () => {
    const lines = buildPricingChecklist({
      features: ["should be ignored"],
      limits: {
        customBranding: false,
        allowViewer: true,
        allowAr: true,
        allowQr: true,
        allowShare: true,
        allowUpload: true,
        allowObjectCapture: false,
        embedViewer: false,
        advancedAnalytics: false,
        priorityProcessing: false,
        prioritySupport: false,
        allowCustomDomain: false,
      },
    });
    const labels = lines.map((line) => line.label);
    assert.ok(labels.includes("Download QR"));
    assert.ok(labels.includes("Viewer Link"));
    assert.ok(labels.includes("Email support"));
    assert.ok(labels.includes("3D Viewer"));
    assert.ok(labels.includes("QR Codes"));
    assert.ok(!labels.includes("should be ignored"));
    assert.ok(!labels.includes("Custom Branding"));
  });

  it("hides QR companions when QR gate is off", () => {
    const labels = buildPricingChecklist({
      limits: {
        allowQr: false,
        allowViewer: false,
        allowAr: false,
        allowShare: false,
        allowUpload: false,
        allowObjectCapture: false,
        embedViewer: true,
        advancedAnalytics: true,
        customBranding: true,
      },
    }).map((line) => line.label);

    assert.ok(labels.includes("Embed Viewer"));
    assert.ok(labels.includes("Email support"));
    assert.ok(labels.includes("Advanced Analytics"));
    assert.ok(!labels.includes("Download QR"));
    assert.ok(!labels.includes("Viewer Link"));
    assert.ok(!labels.includes("QR Codes"));
  });

  it("featureLabelsFromLimits returns the same ON labels", () => {
    const limits = { embedViewer: true, allowViewer: true, allowAr: false };
    assert.deepEqual(
      featureLabelsFromLimits(limits),
      buildPricingChecklist({ limits }).map((line) => line.label),
    );
  });
});
