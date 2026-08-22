/**
 * Shared camera framing for canvas, viewer, and embed.
 * Prefer published orbit/target when trusted; otherwise frame via model dimensions.
 */

export type FitCameraInput = {
  cameraOrbit?: string | null;
  cameraTarget?: string | null;
  fieldOfView?: string | number | null;
  /** When true, ignore saved orbit and frame from bounding box (Fit / first open). */
  forceAutoFit?: boolean;
  /**
   * Extra zoom-out multiplier for UI chrome (hints, toolbars).
   * 1 = base fit; ~1.15–1.2 for public viewer with a bottom toolbar.
   */
  fitPadding?: number;
  /** model-viewer element */
  viewer: {
    getCameraOrbit?: () => { theta: number; phi: number; radius: number; toString?: () => string };
    getCameraTarget?: () => { x: number; y: number; z: number; toString?: () => string };
    getDimensions?: () => { x: number; y: number; z: number } | null;
    getBoundingBoxCenter?: () => { x: number; y: number; z: number } | null;
    cameraOrbit?: string;
    cameraTarget?: string;
    fieldOfView?: string;
    jumpCameraToGoal?: () => void;
    updateFraming?: () => void;
  } | null | undefined;
  reason?: "ready" | "resize" | "reset" | "retry";
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function maxDimOf(dims: { x: number; y: number; z: number } | null): number {
  if (!dims) return 0;
  return Math.max(Number(dims.x) || 0, Number(dims.y) || 0, Number(dims.z) || 0, 0);
}

/**
 * Radius as % of model-viewer's ideal distance.
 * Goal: full AABB visible with margin — not a speck, not cropped.
 */
export function computeFitRadiusPercent(dims: { x: number; y: number; z: number } | null): number {
  if (!dims) return 155;
  const x = Math.max(0, Number(dims.x) || 0);
  const y = Math.max(0, Number(dims.y) || 0);
  const z = Math.max(0, Number(dims.z) || 0);
  const minBase = Math.max(x, z, 0.001);
  const tallAspect = y / minBase;
  const wideAspect = Math.max(x, z) / Math.max(y, 0.001);

  let radius = 148;
  if (tallAspect > 1.15) radius += (tallAspect - 1.15) * 42;
  if (tallAspect > 2.4) radius += (tallAspect - 2.4) * 28;
  if (wideAspect > 1.5) radius += (wideAspect - 1.5) * 22;
  return clamp(Math.round(radius), 140, 280);
}

/** True when saved distance would crop the product or leave it as a speck. */
export function isOrbitRadiusOffFit(
  radiusToken: string | undefined,
  dims: { x: number; y: number; z: number } | null,
): boolean {
  const token = String(radiusToken || "").trim();
  if (!token) return true;
  const size = Math.max(maxDimOf(dims), 0.01);
  if (/%$/i.test(token)) {
    const pct = Number.parseFloat(token);
    return !Number.isFinite(pct) || pct < 135 || pct > 260;
  }
  if (/m$/i.test(token)) {
    const meters = Number.parseFloat(token);
    return !Number.isFinite(meters) || meters < size * 1.5 || meters > size * 3.1;
  }
  return false;
}

/** @deprecated use isOrbitRadiusOffFit */
export function isOrbitRadiusTooFar(
  radiusToken: string | undefined,
  dims: { x: number; y: number; z: number } | null,
): boolean {
  return isOrbitRadiusOffFit(radiusToken, dims);
}

export async function fitProductCamera(input: FitCameraInput): Promise<void> {
  const viewer = input.viewer;
  if (!viewer) return;

  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (typeof viewer.updateFraming === "function") {
      viewer.updateFraming();
    }

    const dims = viewer.getDimensions?.() || null;
    const padding = Number.isFinite(input.fitPadding) ? Math.max(1, Number(input.fitPadding)) : 1;
    const neededRadius = Math.round(
      computeFitRadiusPercent(
        dims ? { x: Number(dims.x) || 0, y: Number(dims.y) || 0, z: Number(dims.z) || 0 } : null,
      ) * padding,
    );

    const savedOrbit = String(input.cameraOrbit || "").trim();
    const savedTarget = String(input.cameraTarget || "").trim();

    // Restore published framing. Do not rewrite radius just because meters
    // look "off" vs a generic fit — that is the QR / first-open view.
    if (savedOrbit && !input.forceAutoFit) {
      viewer.cameraOrbit = savedOrbit;
      if (savedTarget) viewer.cameraTarget = savedTarget;
      if (input.fieldOfView != null && String(input.fieldOfView).trim()) {
        viewer.fieldOfView = String(input.fieldOfView).includes("deg")
          ? String(input.fieldOfView)
          : `${input.fieldOfView}deg`;
      }
      viewer.jumpCameraToGoal?.();
      return;
    }

    // Keep saved angles when possible, but force a radius that actually fits.
    let theta = "35deg";
    let phi = "58deg";
    if (savedOrbit) {
      const parts = savedOrbit.trim().split(/\s+/);
      if (parts.length >= 2) {
        theta = parts[0];
        phi = parts[1];
      }
    }

    const center = viewer.getBoundingBoxCenter?.() || null;
    if (center && Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(center.z)) {
      viewer.cameraTarget = `${center.x}m ${center.y}m ${center.z}m`;
    } else if (dims) {
      viewer.cameraTarget = `0m ${((Number(dims.y) || 0) * 0.5).toFixed(3)}m 0m`;
    } else if (savedTarget) {
      viewer.cameraTarget = savedTarget;
    } else {
      viewer.cameraTarget = "auto auto auto";
    }

    viewer.cameraOrbit = `${theta} ${phi} ${neededRadius}%`;

    // Wider FOV = more of the model visible (narrow FOV was causing head/feet cuts).
    const isTall =
      dims &&
      (Number(dims.y) || 0) /
        Math.max(Number(dims.x) || 0.001, Number(dims.z) || 0.001) >
        1.8;
    const fovDefault = isTall ? 50 : 45;
    viewer.fieldOfView = `${fovDefault}deg`;

    viewer.jumpCameraToGoal?.();
  } catch {
    // Framing must never break the viewer.
  }
}
