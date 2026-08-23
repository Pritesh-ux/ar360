/**
 * HDRI / environment integration contract (POC V5).
 * Interface only — does not modify ModelViewer or production IBL.
 *
 * Intended future flow:
 *   AR360 environmentImage (/hdr/*.hdr or named preset)
 *        ↓
 *   resolveEnvUrl()  [existing]
 *        ↓
 *   GemEnvironment.applyFromAr360()
 *        ↓
 *   GemRenderer equirect sample
 */

export type Ar360EnvironmentSource = {
  /** Resolved equirect HDR URL (e.g. "/hdr/studio.hdr"). */
  url: string;
  /** Linear intensity multiplier (maps to environmentIntensity). */
  intensity: number;
  /** Y-axis rotation in radians. */
  rotationRadians: number;
  /** Optional exposure (tone-map exposure for gem path). */
  exposure?: number;
};

/**
 * Adapter contract for bridging AR360 HDRI into the gem POC.
 * GemEnvironment implements this in V5.
 */
export type GemEnvironmentContract = {
  /**
   * Load / replace equirect HDR from an AR360-compatible source.
   * Must use raw RGBE equirect (not PMREM CubeUV) for the gem shader.
   */
  applyFromAr360(source: Ar360EnvironmentSource): Promise<void>;
  /** Current loaded URL, if any. */
  getCurrentUrl(): string | null;
  setIntensity(intensity: number): void;
  setRotation(radians: number): void;
};

export const GEM_HDRI_NOTES = [
  "Gem path samples equirect HDR directly in GLSL (atan2 equirect).",
  "AR360 ModelViewer often uses PMREM/CubeUV for MeshStandard — incompatible with gem shader as-is.",
  "Bridge must provide the same source HDR file URL, not the PMREM target.",
  "Intensity / rotation map 1:1 to GemPocParams.environmentIntensity / environmentRotation.",
  "Named presets (neutral/studio) resolve via existing resolveEnvUrl helpers.",
] as const;
