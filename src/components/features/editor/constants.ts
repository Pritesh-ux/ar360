/** Soft studio gray — pure #fff washes out white products (no edge contrast). */
export const EDITOR_BG = "#F0F2F5";
/**
 * Zoom slider (0–100):
 * 0 = max zoom out, 50 = comfortable center, 100 = max zoom in.
 * Values are model-viewer camera-orbit radius percentages.
 */
export const EDITOR_ZOOM_SLIDER_MIN = 0;
export const EDITOR_ZOOM_SLIDER_MAX = 100;
export const EDITOR_ZOOM_SLIDER_CENTER = 50;
/** Max out — still a readable product, not a distant speck. */
export const EDITOR_CAMERA_RADIUS_AT_0 = 260;
/** Comfortable full-product framing at slider center. */
export const EDITOR_CAMERA_RADIUS_AT_50 = 155;
/** Close-up framing at max zoom in. */
export const EDITOR_CAMERA_RADIUS_AT_100 = 42;
/** @deprecated kept for any legacy callers; prefer AT_50. */
export const EDITOR_CAMERA_BASE_RADIUS = EDITOR_CAMERA_RADIUS_AT_50;
export const EDITOR_CAMERA_TARGET = "auto auto auto";
export const EDITOR_FIELD_OF_VIEW = 45;
/** Default hero angle — canvas, Fit fallback, and variant thumbs share this. */
export const EDITOR_DEFAULT_CAMERA_THETA = "35deg";
export const EDITOR_DEFAULT_CAMERA_PHI = "58deg";
/** Slightly under 1 keeps white PBR materials from blowing out. */
export const EDITOR_DEFAULT_EXPOSURE = 0.9;
export const EDITOR_DEFAULT_SHADOW_INTENSITY = 1.25;
export const EDITOR_DEFAULT_SHADOW_SOFTNESS = 0.7;
/** White = no HDR tint. Any other color grades environment lighting. */
export const EDITOR_DEFAULT_ENV_TINT = "#ffffff";
/** 1 = natural HDR color. 0 = grayscale lighting. 2 = boosted saturation. */
export const EDITOR_DEFAULT_ENV_SATURATION = 1;
