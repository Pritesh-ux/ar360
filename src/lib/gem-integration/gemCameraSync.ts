import type { PerspectiveCamera } from "three";

type ModelViewerCameraHost = {
  getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
  getCameraTarget?: () => { x: number; y: number; z: number } | null;
  fieldOfView?: string;
  getFieldOfView?: () => number;
};

/** Read model-viewer's internal Three.js camera via private symbol (same pattern as scene). */
export function getViewerThreeCamera(viewer: unknown): PerspectiveCamera | null {
  if (!viewer || typeof viewer !== "object") return null;
  try {
    const sym = Object.getOwnPropertySymbols(viewer).find(
      (s) => s.description === "camera",
    );
    const cam = sym ? (viewer as Record<symbol, unknown>)[sym] : null;
    if (cam && typeof cam === "object" && "isPerspectiveCamera" in cam) {
      return cam as PerspectiveCamera;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readViewerFieldOfViewDeg(viewer: ModelViewerCameraHost): number {
  try {
    const live = viewer.getFieldOfView?.();
    if (typeof live === "number" && Number.isFinite(live)) return live;
  } catch {
    /* ignore */
  }
  const attr = String(viewer.fieldOfView || "45deg");
  const m = attr.match(/([\d.]+)/);
  return m ? Number(m[1]) : 45;
}
