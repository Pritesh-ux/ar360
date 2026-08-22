import { Box3, Box3Helper, Raycaster, Sphere, Vector2, Vector3 } from "three";

const FRAME_MARGIN = 1.125; // ~12.5% viewport margin
const FRAME_DURATION_MS = 420;
const MIN_SPAN = 0.008;

export type FrameableObject = {
  uuid?: string;
  visible?: boolean;
  isMesh?: boolean;
  isSkinnedMesh?: boolean;
  isLight?: boolean;
  isCamera?: boolean;
  isHelper?: boolean;
  isLine?: boolean;
  isSprite?: boolean;
  name?: string;
  updateWorldMatrix?: (updateParents?: boolean, updateChildren?: boolean) => void;
  traverse?: (cb: (obj: any) => void) => void;
};

export type WorldPick = {
  x: number;
  y: number;
  z: number;
  uuid?: string;
  object?: FrameableObject;
};

type FrameGoal = {
  cameraOrbit: string;
  cameraTarget: string;
  distance: number;
  center: Vector3;
  size: Vector3;
  cameraType: string;
};

let frameAnim: { cancelled: boolean; timer?: number } | null = null;

function camDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.location.search.includes("camdebug=1");
  } catch {
    return false;
  }
}

function logFrameDebug(payload: Record<string, unknown>) {
  if (!camDebugEnabled()) return;
  console.info("FRAME SELECTED\n----------------", payload);
}

export function collectSceneRoots(viewer: any): any[] {
  const roots: any[] = [];
  const seen = new Set<object>();
  const push = (value: any) => {
    if (!value || typeof value !== "object" || typeof value.traverse !== "function") return;
    if (seen.has(value)) return;
    seen.add(value);
    roots.push(value);
  };
  if (!viewer) return roots;
  push(viewer.model?.scene);
  push(viewer.scene);
  try {
    for (const key of Object.getOwnPropertySymbols(viewer)) {
      push(viewer[key]);
    }
  } catch {
    // Optional
  }
  return roots;
}

function findViewerCamera(viewer: any): any | null {
  let camera: any = null;
  for (const root of collectSceneRoots(viewer)) {
    root.traverse?.((obj: any) => {
      if (obj?.isPerspectiveCamera || obj?.isOrthographicCamera) camera = obj;
      else if (obj?.isCamera) camera = obj;
    });
  }
  return camera;
}

export function getFrameTarget(selectedObject: any): any {
  if (!selectedObject) return null;
  if (selectedObject.userData?.ar360FrameTarget) {
    return selectedObject.userData.ar360FrameTarget;
  }
  if (selectedObject.isMesh || selectedObject.isSkinnedMesh || selectedObject.isInstancedMesh) {
    return selectedObject;
  }
  return selectedObject;
}

export function logSelectedObject(obj: any) {
  if (!obj) {
    console.info("SELECTED OBJECT\n(none)");
    return;
  }
  const wp = new Vector3();
  obj.getWorldPosition?.(wp);
  console.info("SELECTED OBJECT", {
    name: obj.name || "(unnamed)",
    uuid: obj.uuid,
    type: obj.type || (obj.isMesh ? "Mesh" : obj.isGroup ? "Group" : typeof obj),
    parent: obj.parent?.name || obj.parent?.type || obj.parent?.uuid || null,
    worldPosition: [wp.x, wp.y, wp.z],
  });
}

export function getProductRoot(viewer: any): FrameableObject | null {
  const scene = viewer?.model?.scene;
  if (scene && typeof scene.traverse === "function") return scene;
  const roots = collectSceneRoots(viewer);
  return roots[0] || null;
}

export function findObjectByUuid(viewer: any, uuid: string | null | undefined): FrameableObject | null {
  if (!uuid) return null;
  for (const root of collectSceneRoots(viewer)) {
    let found: FrameableObject | null = null;
    root.traverse?.((obj: any) => {
      if (!found && obj?.uuid === uuid) found = obj;
    });
    if (found) return found;
  }
  return null;
}

export function pickWorldHit(viewer: any, clientX: number, clientY: number): WorldPick | null {
  if (!viewer) return null;
  let point: { x: number; y: number; z: number } | null = null;
  try {
    const hit = viewer.positionAndNormalFromPoint?.(clientX, clientY);
    const p = hit?.position;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
      point = { x: p.x, y: p.y, z: p.z };
    }
  } catch {
    // Optional
  }
  if (!point) return null;

  const needle = new Vector3(point.x, point.y, point.z);
  const pickRoot = viewer.model?.scene;
  let object: FrameableObject | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  const tmp = new Box3();
  pickRoot?.traverse?.((obj: any) => {
    if (!obj?.isMesh && !obj?.isSkinnedMesh) return;
    if (obj.visible === false) return;
    try {
      obj.updateWorldMatrix?.(true, false);
      tmp.setFromObject(obj);
      if (tmp.isEmpty()) return;
      const dist = tmp.distanceToPoint(needle);
      if (dist > 0.003) return;
      const size = tmp.getSize(new Vector3());
      const volume = Math.max(size.x, 0.0001) * Math.max(size.y, 0.0001) * Math.max(size.z, 0.0001);
      const score = volume;
      if (score < bestScore) {
        bestScore = score;
        object = obj;
      }
    } catch {
      // skip
    }
  });

  return { ...point, uuid: object?.uuid, object };
}

function worldBoxForObjects(objects: FrameableObject[]): Box3 {
  const box = new Box3();
  let any = false;
  for (const raw of objects) {
    const obj = getFrameTarget(raw);
    if (!obj || obj.visible === false) continue;
    try {
      obj.updateWorldMatrix?.(true, true);
      const next = new Box3().setFromObject(obj);
      if (next.isEmpty()) continue;
      if (!any) {
        box.copy(next);
        any = true;
      } else {
        box.union(next);
      }
    } catch {
      // Skip invalid nodes
    }
  }
  return any ? box : new Box3();
}

function computeFitDistance(box: Box3, viewer: any, camera: any | null): number {
  const sphere = new Sphere();
  box.getBoundingSphere(sphere);
  const radius = Math.max(sphere.radius, MIN_SPAN);
  if (camera?.isOrthographicCamera) {
    return radius * 2 * FRAME_MARGIN;
  }
  let fovDeg = 45;
  try {
    const liveFov = Number(viewer?.getFieldOfView?.());
    if (Number.isFinite(liveFov) && liveFov > 1) fovDeg = liveFov;
    else if (Number(camera?.fov) > 1) fovDeg = Number(camera.fov);
  } catch {
    // keep default
  }
  const half = ((fovDeg * Math.PI) / 180) / 2;
  return (radius / Math.max(Math.sin(half), 0.08)) * FRAME_MARGIN;
}

function parseVec3Meters(raw: string | undefined): Vector3 | null {
  const m = String(raw || "").trim().match(
    /([-+]?[\d.]+)\s*m?\s+([-+]?[\d.]+)\s*m?\s+([-+]?[\d.]+)\s*m?/i,
  );
  if (!m) return null;
  return new Vector3(Number(m[1]), Number(m[2]), Number(m[3]));
}

function goalFromBox(viewer: any, box: Box3): FrameGoal | null {
  if (!box || box.isEmpty()) return null;
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  if (![center.x, center.y, center.z, size.x, size.y, size.z].every(Number.isFinite)) return null;
  if (size.x + size.y + size.z < 1e-8) {
    size.set(MIN_SPAN, MIN_SPAN, MIN_SPAN);
    box.min.copy(center).addScalar(-MIN_SPAN / 2);
    box.max.copy(center).addScalar(MIN_SPAN / 2);
  }

  const camera = findViewerCamera(viewer);
  const live = viewer.getCameraOrbit?.();
  const theta = live && Number.isFinite(live.theta) ? `${live.theta}rad` : "35deg";
  const phi = live && Number.isFinite(live.phi) ? `${live.phi}rad` : "58deg";
  let distance = computeFitDistance(box, viewer, camera);

  if (camera?.isOrthographicCamera) {
    const span = Math.max(size.x, size.y, size.z, MIN_SPAN);
    const viewH = Math.abs(Number(camera.top) - Number(camera.bottom)) || span;
    camera.zoom = Math.max(0.05, viewH / (span * 2 * FRAME_MARGIN));
    camera.updateProjectionMatrix?.();
    distance = Math.max(distance, span);
  }

  const cameraTarget = `${center.x}m ${center.y}m ${center.z}m`;
  const cameraOrbit = `${theta} ${phi} ${distance.toFixed(4)}m`;
  return {
    cameraOrbit,
    cameraTarget,
    distance,
    center,
    size,
    cameraType: camera?.isOrthographicCamera
      ? "OrthographicCamera"
      : camera?.isPerspectiveCamera
        ? "PerspectiveCamera"
        : "model-viewer-orbit",
  };
}

export function cancelFrameAnimation() {
  if (!frameAnim) return;
  frameAnim.cancelled = true;
  if (frameAnim.timer) window.clearTimeout(frameAnim.timer);
  frameAnim = null;
}

function showDebugBox(viewer: any, box: Box3) {
  if (!camDebugEnabled()) return;
  try {
    const prev = viewer.__ar360FrameHelper;
    if (prev?.parent) prev.parent.remove(prev);
    const helper = new Box3Helper(box, 0xff2244);
    helper.name = "AR360FrameDebug";
    const root = viewer.model?.scene;
    root?.add?.(helper);
    viewer.__ar360FrameHelper = helper;
  } catch {
    // Optional
  }
}

function logFrameTarget(objects: FrameableObject[], box: Box3, center: Vector3, before: any, after: any) {
  const obj = objects[0] as any;
  console.info("FRAME TARGET", {
    name: obj?.name || "(unnamed)",
    uuid: obj?.uuid,
    type: obj?.type,
    boxMin: box.min.toArray(),
    boxMax: box.max.toArray(),
    center: center.toArray(),
    cameraPositionBefore: before.pos,
    controlsTargetBefore: before.target,
    cameraPositionAfter: after.pos,
    controlsTargetAfter: after.target,
  });
}

function applyGoal(viewer: any, goal: FrameGoal, jump: boolean) {
  viewer.__ar360FramingLock = true;
  viewer.cameraTarget = goal.cameraTarget;
  viewer.setAttribute?.("camera-target", goal.cameraTarget);
  viewer.cameraOrbit = goal.cameraOrbit;
  viewer.setAttribute?.("camera-orbit", goal.cameraOrbit);
  if (jump) viewer.jumpCameraToGoal?.();
}

function animateToGoal(viewer: any, goal: FrameGoal, durationMs: number): Promise<boolean> {
  cancelFrameAnimation();
  const live = viewer.getCameraOrbit?.();
  const theta = live && Number.isFinite(live.theta) ? `${live.theta}rad` : "35deg";
  const phi = live && Number.isFinite(live.phi) ? `${live.phi}rad` : "58deg";
  goal.cameraOrbit = `${theta} ${phi} ${goal.distance.toFixed(4)}m`;

  const state: { cancelled: boolean; timer?: number } = { cancelled: false };
  frameAnim = state;

  // Spherical orbit interpolation only. jumpCameraToGoal() every frame kept the
  // camera still and retargeted look-at, which reads as an up/down pitch.
  viewer.setAttribute?.("interpolation-decay", "12");
  applyGoal(viewer, goal, false);

  return new Promise((resolve) => {
    state.timer = window.setTimeout(() => {
      if (state.cancelled) {
        resolve(false);
        return;
      }
      applyGoal(viewer, goal, false);
      viewer.setAttribute?.("interpolation-decay", "50");
      window.setTimeout(() => {
        viewer.__ar360FramingLock = false;
      }, 80);
      if (frameAnim === state) frameAnim = null;
      resolve(true);
    }, durationMs);
  });
}

export async function frameObjects(
  viewer: any,
  objects: FrameableObject[],
  options?: {
    animate?: boolean;
    durationMs?: number;
    label?: string;
    hintPoint?: { x: number; y: number; z: number } | null;
  },
): Promise<{ cameraOrbit: string; cameraTarget: string; distance: number; size: Vector3 } | null> {
  if (!viewer) return null;
  const targets = objects.map((o) => getFrameTarget(o)).filter(Boolean);
  const hint = options?.hintPoint;
  if (!targets.length && !(hint && Number.isFinite(hint.x))) return null;

  const camera = findViewerCamera(viewer);
  const beforePos = camera?.position ? [camera.position.x, camera.position.y, camera.position.z] : null;
  const beforeTarget = viewer.getCameraTarget?.();
  const beforeTargetArr = beforeTarget
    ? [beforeTarget.x, beforeTarget.y, beforeTarget.z]
    : null;

  const box = targets.length ? worldBoxForObjects(targets) : new Box3();
  if (box.isEmpty() && hint && Number.isFinite(hint.x)) {
    const pad = 0.22;
    box.min.set(hint.x - pad, hint.y - pad, hint.z - pad);
    box.max.set(hint.x + pad, hint.y + pad, hint.z + pad);
  }
  if (box.isEmpty()) {
    console.warn("FRAME TARGET: empty bounding box for", targets[0]);
    return null;
  }

  if (hint && Number.isFinite(hint.x) && targets.length) {
    const span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    const p = new Vector3(hint.x, hint.y, hint.z);
    if (span > 0.75 && box.distanceToPoint(p) < 0.05) {
      const pad = 0.22;
      box.min.set(p.x - pad, p.y - pad, p.z - pad);
      box.max.set(p.x + pad, p.y + pad, p.z + pad);
    }
  }

  showDebugBox(viewer, box);
  const goal = goalFromBox(viewer, box);
  if (!goal) return null;

  const animate = options?.animate !== false;
  const duration = options?.durationMs ?? FRAME_DURATION_MS;
  if (animate) await animateToGoal(viewer, goal, duration);
  else applyGoal(viewer, goal, true);

  const afterCam = findViewerCamera(viewer);
  const afterPos = afterCam?.position
    ? [afterCam.position.x, afterCam.position.y, afterCam.position.z]
    : null;
  logFrameTarget(
    targets,
    box,
    goal.center,
    { pos: beforePos, target: beforeTargetArr },
    { pos: afterPos, target: [goal.center.x, goal.center.y, goal.center.z] },
  );
  logFrameDebug({
    selected: options?.label || targets.map((o: any) => o?.name || o?.uuid).join(", "),
    boundingBox: { min: box.min.toArray(), max: box.max.toArray() },
    center: goal.center.toArray(),
    size: goal.size.toArray(),
    cameraType: goal.cameraType,
    cameraPositionBefore: beforePos,
    cameraTargetBefore: beforeTargetArr,
    cameraPositionAfter: afterPos,
    cameraTargetAfter: goal.cameraTarget,
    calculatedDistance: goal.distance,
    animationDuration: animate ? duration : 0,
  });

  return {
    cameraOrbit: goal.cameraOrbit,
    cameraTarget: goal.cameraTarget,
    distance: goal.distance,
    size: goal.size,
  };
}

export function frameObject(
  viewer: any,
  target: FrameableObject | null | undefined,
  options?: { animate?: boolean; durationMs?: number; label?: string },
) {
  if (!target) return Promise.resolve(null);
  return frameObjects(viewer, [target], options);
}

export function fitEntireProduct(
  viewer: any,
  options?: { animate?: boolean; durationMs?: number },
) {
  const root = getProductRoot(viewer);
  if (!root) return Promise.resolve(null);
  return frameObjects(viewer, [root], { ...options, label: "product-root" });
}
