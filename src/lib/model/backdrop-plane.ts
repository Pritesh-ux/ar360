/**
 * Many exported GLBs ship a large flat "studio floor" mesh baked into the scene.
 * model-viewer only auto-hides those when their material is transparent, so an
 * opaque backdrop plane stays visible and reads as part of the product while the
 * real soft shadow is drawn on top of it.
 */

type Vec3 = { x: number; y: number; z: number };
type Box = { min: Vec3; max: Vec3 };

/** A plane is at most this fraction of the model's largest dimension thick. */
const MAX_THICKNESS_RATIO = 0.03;
/** A backdrop covers clearly more ground than the product standing on it. */
const MIN_OVERSIZE_RATIO = 1.6;
/** The plane must sit at (or below) the product's base, not cut through it. */
const BASE_TOLERANCE_RATIO = 0.2;

const AXES = ["x", "y", "z"] as const;
type Axis = (typeof AXES)[number];

function emptyBox(): Box {
  return {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
}

function isEmptyBox(box: Box): boolean {
  return AXES.some((axis) => box.min[axis] > box.max[axis]);
}

function expandBox(target: Box, source: Box): void {
  for (const axis of AXES) {
    target.min[axis] = Math.min(target.min[axis], source.min[axis]);
    target.max[axis] = Math.max(target.max[axis], source.max[axis]);
  }
}

function boxSize(box: Box): Vec3 {
  return {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
  };
}

/**
 * World-space AABB without pulling three.js into the bundle: the geometry's
 * local bounds are pushed through the mesh's world matrix by hand.
 */
function meshWorldBox(mesh: any): Box | null {
  const geometry = mesh?.geometry;
  if (!geometry) return null;

  if (!geometry.boundingBox) {
    try {
      geometry.computeBoundingBox?.();
    } catch {
      return null;
    }
  }

  const local = geometry.boundingBox;
  const elements = mesh.matrixWorld?.elements;
  if (!local || !elements) return null;

  const box = emptyBox();
  for (const x of [local.min.x, local.max.x]) {
    for (const y of [local.min.y, local.max.y]) {
      for (const z of [local.min.z, local.max.z]) {
        const point = {
          x: elements[0] * x + elements[4] * y + elements[8] * z + elements[12],
          y: elements[1] * x + elements[5] * y + elements[9] * z + elements[13],
          z: elements[2] * x + elements[6] * y + elements[10] * z + elements[14],
        };
        expandBox(box, { min: point, max: point });
      }
    }
  }

  return Number.isFinite(box.min.x) ? box : null;
}

function getModelScene(viewer: any): any | null {
  if (!viewer) return null;
  const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
    (symbol) => symbol.description === "scene",
  );
  return sceneSymbol ? (viewer as any)[sceneSymbol] ?? null : null;
}

function flatAxis(size: Vec3): Axis {
  return AXES.reduce((flattest, axis) => (size[axis] < size[flattest] ? axis : flattest), "x" as Axis);
}

function isBackdropPlane(candidate: Box, rest: Box, modelMaxDim: number): boolean {
  const candidateSize = boxSize(candidate);
  const restSize = boxSize(rest);

  const axis = flatAxis(candidateSize);
  // Only horizontal ground planes; vertical panels are usually real product parts.
  if (axis !== "y") return false;
  if (candidateSize.y > MAX_THICKNESS_RATIO * modelMaxDim) return false;

  const spread: Axis[] = ["x", "z"];
  const covers = spread.every((a) => {
    const slack = Math.max(restSize[a] * 0.02, 1e-6);
    return candidate.min[a] <= rest.min[a] + slack && candidate.max[a] >= rest.max[a] - slack;
  });
  if (!covers) return false;

  const candidateArea = candidateSize.x * candidateSize.z;
  const restArea = Math.max(restSize.x * restSize.z, 1e-9);
  if (candidateArea < MIN_OVERSIZE_RATIO * restArea) return false;

  return candidate.max.y <= rest.min.y + BASE_TOLERANCE_RATIO * Math.max(restSize.y, 1e-6);
}

/**
 * Hides baked-in floor planes so only model-viewer's own soft shadow remains.
 * Returns how many meshes were hidden. Safe to call repeatedly.
 */
export function hideBackdropPlanes(viewer: any): number {
  const scene = getModelScene(viewer);
  const root = scene?.target;
  if (!root?.traverse) return 0;

  try {
    root.updateWorldMatrix?.(true, true);
  } catch {
    // best effort — stale matrices only shift the heuristic slightly
  }

  const candidates: Array<{ mesh: any; box: Box }> = [];
  root.traverse((object: any) => {
    if (!object?.isMesh || object.visible === false) return;
    const box = meshWorldBox(object);
    if (box) candidates.push({ mesh: object, box });
  });

  // A single-mesh model may legitimately be flat (tiles, rugs, posters).
  if (candidates.length < 2) return 0;

  const total = emptyBox();
  candidates.forEach(({ box }) => expandBox(total, box));
  if (isEmptyBox(total)) return 0;

  const totalSize = boxSize(total);
  const modelMaxDim = Math.max(totalSize.x, totalSize.y, totalSize.z);
  if (!(modelMaxDim > 0)) return 0;

  let hidden = 0;
  candidates.forEach(({ mesh, box }, index) => {
    const rest = emptyBox();
    candidates.forEach((other, otherIndex) => {
      if (otherIndex !== index) expandBox(rest, other.box);
    });
    if (isEmptyBox(rest)) return;
    if (!isBackdropPlane(box, rest, modelMaxDim)) return;

    mesh.visible = false;
    mesh.userData = mesh.userData || {};
    mesh.userData.noHit = true;
    mesh.userData.ar360HiddenBackdrop = true;
    hidden += 1;
  });

  if (hidden === 0) return 0;

  try {
    scene.updateBoundingBox?.();
    void Promise.resolve(scene.updateFraming?.())
      .then(() => {
        scene.updateShadow?.();
        scene.setShadowIntensity?.(Number(scene.shadowIntensity ?? viewer.shadowIntensity ?? 1));
        scene.queueRender?.();
      })
      .catch(() => undefined);
  } catch {
    // rendering keeps working with the plane hidden even if reframing fails
  }

  return hidden;
}
