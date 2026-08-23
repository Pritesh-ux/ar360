/**
 * Calibration presets + visual views for Gem Renderer POC V2.
 */
import type { GemPocParams } from "./types";
import { REFERENCE_DIAMOND_PARAMS } from "./types";

export type CalibrationSceneId = "reference" | "test-a" | "test-b" | "test-c";

export type CalibrationCamera = {
  position: [number, number, number];
  target: [number, number, number];
  gemAngle: number;
};

export type CalibrationPreset = {
  id: CalibrationSceneId;
  label: string;
  description: string;
  environmentUrl: string;
  params: GemPocParams;
  camera: CalibrationCamera;
};

/** Phase 4 locked REFERENCE optics — physical params; V4 accel defaults AUTO. */
const LOCKED_REFERENCE: GemPocParams = {
  ...REFERENCE_DIAMOND_PARAMS,
  ior: 2.417,
  dispersion: 0.25,
  absorption: [0.002, 0.002, 0.002],
  thickness: 1,
  internalBounces: 12,
  roughness: 0.01,
  environmentIntensity: 1,
  exposure: 1,
  enableBvh: false,
  accelMode: "auto",
  wavelengthMode: "rgb3",
  samplesPerPixel: 2,
  internalResolutionScale: 1,
  earlyTermination: true,
  qualityTier: "reference",
  autoRotate: false,
  debugMode: "beauty",
  quality: "medium",
};

const CALIBRATION_OPTICS: GemPocParams = {
  ...LOCKED_REFERENCE,
};

const FIXED_CAMERA: CalibrationCamera = {
  position: [0, 0.45, 3.0],
  target: [0, 0, 0],
  gemAngle: 0.35,
};

export const CALIBRATION_PRESETS: Record<CalibrationSceneId, CalibrationPreset> = {
  reference: {
    id: "reference",
    label: "REFERENCE DIAMOND (locked V2)",
    description:
      "IOR 2.417 · disp 0.25 · abs 0.002 · thick 1 · bounces 12 · rough 0.01 · env/exp 1 · AgX · BVH on",
    environmentUrl: "/hdr/studio.hdr",
    params: { ...LOCKED_REFERENCE },
    camera: { ...FIXED_CAMERA, gemAngle: 0.2 },
  },
  "test-a": {
    id: "test-a",
    label: "TEST A — Bright studio",
    description: "Studio HDRI, fixed camera, locked reference optics.",
    environmentUrl: "/hdr/studio.hdr",
    params: { ...CALIBRATION_OPTICS },
    camera: FIXED_CAMERA,
  },
  "test-b": {
    id: "test-b",
    label: "TEST B — High-contrast jewelry",
    description: "Studio HDRI rotated, fixed camera, locked reference optics.",
    environmentUrl: "/hdr/studio.hdr",
    params: { ...CALIBRATION_OPTICS, environmentRotation: 0.9 },
    camera: { ...FIXED_CAMERA, gemAngle: 0.55 },
  },
  "test-c": {
    id: "test-c",
    label: "TEST C — Neutral environment",
    description: "Neutral HDRI, fixed camera, locked reference optics.",
    environmentUrl: "/hdr/neutral.hdr",
    params: { ...CALIBRATION_OPTICS },
    camera: { ...FIXED_CAMERA, gemAngle: 0.35 },
  },
};

export type VisualViewId =
  | "face-on"
  | "rot-30"
  | "rot-60"
  | "pavilion"
  | "crown"
  | "side";

export const VISUAL_VIEWS: Record<
  VisualViewId,
  CalibrationCamera & { label: string }
> = {
  "face-on": {
    label: "1 · Face-on",
    position: [0, 0.35, 3.0],
    target: [0, 0, 0],
    gemAngle: 0,
  },
  "rot-30": {
    label: "2 · 30° rotation",
    position: [0, 0.35, 3.0],
    target: [0, 0, 0],
    gemAngle: Math.PI / 6,
  },
  "rot-60": {
    label: "3 · 60° rotation",
    position: [0, 0.35, 3.0],
    target: [0, 0, 0],
    gemAngle: Math.PI / 3,
  },
  pavilion: {
    label: "4 · Pavilion view",
    position: [0, -1.8, 2.2],
    target: [0, -0.2, 0],
    gemAngle: 0.4,
  },
  crown: {
    label: "5 · Crown view",
    position: [0, 2.0, 1.6],
    target: [0, 0.1, 0],
    gemAngle: 0.15,
  },
  side: {
    label: "6 · Side view",
    position: [3.0, 0.15, 0.2],
    target: [0, 0, 0],
    gemAngle: 0,
  },
};

export const DISPERSION_PRESETS = {
  off: 0,
  low: 0.25,
  medium: 0.6,
  high: 1.0,
  exaggerated: 1.5,
} as const;
