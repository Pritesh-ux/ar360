import type { Object3D, PerspectiveCamera } from "three";

type ModelViewerCameraHost = {
  getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
  getCameraTarget?: () => { x: number; y: number; z: number } | null;
  fieldOfView?: string;
  getFieldOfView?: () => number;
};

type ModelSceneLike = Object3D & {
  getCamera?: () => PerspectiveCamera;
  camera?: PerspectiveCamera;
};

/** Read model-viewer's internal Three.js scene (Symbol('scene')). */
export function getViewerThreeScene(viewer: unknown): Object3D | null {
  if (!viewer || typeof viewer !== "object") return null;
  try {
    const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
      (symbol) => symbol.description === "scene",
    );
    if (!sceneSymbol) return null;
    const scene = (viewer as Record<symbol, unknown>)[sceneSymbol];
    return scene && typeof scene === "object" ? (scene as Object3D) : null;
  } catch {
    return null;
  }
}

/** Model-viewer camera lives on ModelScene.getCamera(), not on the element. */
export function getViewerThreeCamera(viewer: unknown): PerspectiveCamera | null {
  const scene = getViewerThreeScene(viewer) as ModelSceneLike | null;
  if (!scene) return null;
  try {
    const cam = scene.getCamera?.() ?? scene.camera ?? null;
    if (cam && "isPerspectiveCamera" in cam && cam.isPerspectiveCamera) {
      return cam;
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
