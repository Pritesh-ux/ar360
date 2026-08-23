/**
 * Adaptive AUTO quality — runtime signals + hysteresis (POC V5).
 * Does not change quality every frame.
 */
import type { QualityTier } from "./types";
import type { DeviceCapabilityReport } from "./deviceCapabilities";
import { paramsForQualityTier } from "./qualityPresets";
import type { GemPocParams } from "./types";

export type AutoQualityDecision = {
  tier: Exclude<QualityTier, "auto">;
  reason: string;
};

const TIER_ORDER: Exclude<QualityTier, "auto">[] = [
  "low",
  "medium",
  "high",
  "reference",
];

function clampTier(
  t: Exclude<QualityTier, "auto">,
): Exclude<QualityTier, "auto"> {
  return t;
}

function stepDown(t: Exclude<QualityTier, "auto">): Exclude<QualityTier, "auto"> {
  const i = TIER_ORDER.indexOf(t);
  return TIER_ORDER[Math.max(0, i - 1)];
}

function stepUp(t: Exclude<QualityTier, "auto">): Exclude<QualityTier, "auto"> {
  const i = TIER_ORDER.indexOf(t);
  // Never auto-promote to reference
  return TIER_ORDER[Math.min(TIER_ORDER.length - 2, i + 1)];
}

/** Frame-time budgets (ms) for adapting — aspirational, not guarantees. */
const BUDGET_MS: Record<Exclude<QualityTier, "auto">, number> = {
  low: 33, // ~30 FPS
  medium: 22, // ~45 FPS
  high: 28,
  reference: 66,
};

export class AutoQualityController {
  private current: Exclude<QualityTier, "auto"> = "medium";
  private lastChangeAt = 0;
  private adjustments = 0;
  private warmupUntil = 0;
  private enabled = true;

  /** Initial pick from capabilities (no UA blacklist). */
  pickInitial(input: {
    caps: DeviceCapabilityReport;
    triangleCount: number;
  }): AutoQualityDecision {
    const { caps, triangleCount } = input;
    let tier: Exclude<QualityTier, "auto"> = "medium";
    let reason = "default medium";

    if (caps.webglVersion === "none") {
      return { tier: "low", reason: "no WebGL" };
    }
    if (caps.webglVersion === "WebGL1" || caps.maxTextureSize < 4096) {
      tier = "low";
      reason = "WebGL1 or small max texture";
    } else if (
      caps.canvasPixels > 1_400_000 ||
      (caps.deviceMemoryGb != null && caps.deviceMemoryGb <= 4) ||
      caps.hardwareConcurrency <= 4
    ) {
      tier = triangleCount > 256 ? "low" : "medium";
      reason = "high pixel budget / limited cores or memory";
    } else if (
      caps.canvasPixels < 600_000 &&
      caps.hardwareConcurrency >= 8 &&
      (caps.deviceMemoryGb == null || caps.deviceMemoryGb >= 8) &&
      caps.floatTextures
    ) {
      tier = "high";
      reason = "strong desktop signals";
    }

    // Dense meshes start conservative
    if (triangleCount > 1024 && tier !== "low") {
      tier = "low";
      reason = "triangle count > 1024 → start low";
    }

    this.current = clampTier(tier);
    this.warmupUntil = performance.now() + 1200;
    this.lastChangeAt = 0;
    this.adjustments = 0;
    return { tier: this.current, reason };
  }

  getCurrent() {
    return this.current;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  /**
   * Optionally adapt after warmup using measured frame time.
   * Returns new tier params partial or null if no change.
   */
  maybeAdapt(frameTimeMs: number, now = performance.now()): {
    tier: Exclude<QualityTier, "auto">;
    reason: string;
  } | null {
    if (!this.enabled) return null;
    if (now < this.warmupUntil) return null;
    if (this.adjustments >= 2) return null;
    if (now - this.lastChangeAt < 2000) return null;

    const budget = BUDGET_MS[this.current];
    if (frameTimeMs > budget * 1.35) {
      const next = stepDown(this.current);
      if (next === this.current) return null;
      this.current = next;
      this.lastChangeAt = now;
      this.adjustments++;
      return {
        tier: next,
        reason: `frame ${frameTimeMs.toFixed(1)}ms > budget ${budget}ms → step down`,
      };
    }
    if (frameTimeMs < budget * 0.55 && this.current !== "high") {
      const next = stepUp(this.current);
      if (next === this.current) return null;
      this.current = next;
      this.lastChangeAt = now;
      this.adjustments++;
      return {
        tier: next,
        reason: `frame ${frameTimeMs.toFixed(1)}ms comfortably under budget → step up`,
      };
    }
    return null;
  }

  paramsForCurrent(): Partial<GemPocParams> {
    return {
      ...paramsForQualityTier(this.current),
      qualityTier: "auto",
    };
  }
}
