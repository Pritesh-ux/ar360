/**
 * Production performance budgets (POC V5 aspirational targets).
 * Not guarantees — actual FPS varies by GPU / resolution / thermal state.
 */
import type { RenderQualityParams } from "./gemMaterialContract";
import {
  QUALITY_DESKTOP_MEDIUM,
  QUALITY_MOBILE_LOW,
  QUALITY_REFERENCE,
} from "./gemMaterialContract";

export type PerformanceBudget = {
  id: "desktop-medium" | "mobile-low" | "reference";
  label: string;
  quality: RenderQualityParams;
  /** Aspirational target FPS on a healthy device for this preset. */
  targetFps: number;
  /** Soft fail if sustained below this. */
  minAcceptableFps: number;
  notes: string;
};

export const PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  {
    id: "desktop-medium",
    label: "DESKTOP MEDIUM",
    quality: QUALITY_DESKTOP_MEDIUM,
    targetFps: 45,
    minAcceptableFps: 30,
    notes:
      "1 spp · 3λ · 6 bounces · 75% ires. Measured ~49 FPS on POC test desktop @ ~830×756.",
  },
  {
    id: "mobile-low",
    label: "MOBILE LOW",
    quality: QUALITY_MOBILE_LOW,
    targetFps: 30,
    minAcceptableFps: 20,
    notes:
      "1 spp · 3λ · 4 bounces · 50% ires. Desktop proxy ~57 FPS — physical device validation required.",
  },
  {
    id: "reference",
    label: "REFERENCE",
    quality: QUALITY_REFERENCE,
    targetFps: 15,
    minAcceptableFps: 8,
    notes: "Debug / sign-off only. Not a production interactive target.",
  },
];
