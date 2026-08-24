/**
 * GemMeshAdapter — triangles + optional GPU BVH for the gem raytracer POC.
 */
import {
  Box3,
  BufferAttribute,
  DataTexture,
  FloatType,
  Matrix4,
  Mesh,
  NearestFilter,
  RGBAFormat,
  Vector3,
  type BufferGeometry,
  type Texture,
} from "three";
import { hardenFacetNormals } from "./createBrilliantCut";
import {
  buildGemBvh,
  disposeGemBvh,
  type GemBvhHandle,
} from "./GemBvh";

/** Soft cap — BVH makes denser GLBs viable; still bounded for mobile. */
export const GEM_POC_MAX_TRIANGLES = 4096;

/** POC reference view-fit target — used for integration normalization only. */
export const REFERENCE_CHARACTERISTIC_LENGTH = 1.6;

export type PackedGemMesh = {
  triangleTexture: DataTexture;
  triangleCount: number;
  boundsMin: Vector3;
  boundsMax: Vector3;
  center: Vector3;
  radius: number;
  characteristicLength: number;
  /** World-space center preserved for integration camera transform. */
  worldCenter: Vector3;
  /** Mesh-local bounds center — integration uses live matrixWorld each frame. */
  localCenter: Vector3;
  /** Scale applied after centering (1 = none). Integration maps world → local. */
  normalizationScale: number;
  truncated: boolean;
  sourceLabel: string;
  bvh: GemBvhHandle | null;
  centeredPositions: Float32Array;
};

function geometryWorldTriangles(
  geometry: BufferGeometry,
  matrixWorld: Matrix4,
): { positions: Float32Array; count: number } {
  const flat = hardenFacetNormals(geometry);
  const pos = flat.getAttribute("position") as BufferAttribute;
  const triCount = Math.floor(pos.count / 3);
  const out = new Float32Array(triCount * 9);
  const v = new Vector3();

  for (let i = 0; i < triCount * 3; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrixWorld);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  flat.dispose();
  return { positions: out, count: triCount };
}

export function packTriangleTexture(
  positions: Float32Array,
  triangleCount: number,
): DataTexture {
  const data = new Float32Array(triangleCount * 3 * 4);
  for (let t = 0; t < triangleCount; t++) {
    for (let v = 0; v < 3; v++) {
      const src = (t * 3 + v) * 3;
      const dst = (t * 3 + v) * 4;
      data[dst] = positions[src];
      data[dst + 1] = positions[src + 1];
      data[dst + 2] = positions[src + 2];
      data[dst + 3] = 1;
    }
  }
  const tex = new DataTexture(data, 3, triangleCount, RGBAFormat, FloatType);
  tex.needsUpdate = true;
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  return tex;
}

export function adaptMeshToGem(
  mesh: Mesh,
  sourceLabel = "mesh",
): PackedGemMesh {
  mesh.updateWorldMatrix(true, false);
  const { positions, count: rawCount } = geometryWorldTriangles(
    mesh.geometry,
    mesh.matrixWorld,
  );
  const truncated = rawCount > GEM_POC_MAX_TRIANGLES;
  const triangleCount = Math.min(rawCount, GEM_POC_MAX_TRIANGLES);
  const used = truncated
    ? positions.subarray(0, triangleCount * 9)
    : positions;

  const bounds = new Box3();
  const v = new Vector3();
  for (let i = 0; i < triangleCount * 3; i++) {
    v.set(used[i * 3], used[i * 3 + 1], used[i * 3 + 2]);
    bounds.expandByPoint(v);
  }
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5;

  const centered = new Float32Array(triangleCount * 9);
  for (let i = 0; i < triangleCount * 3; i++) {
    centered[i * 3] = used[i * 3] - center.x;
    centered[i * 3 + 1] = used[i * 3 + 1] - center.y;
    centered[i * 3 + 2] = used[i * 3 + 2] - center.z;
  }

  const triangleTexture = packTriangleTexture(centered, triangleCount);
  const boundsMin = new Vector3(
    bounds.min.x - center.x,
    bounds.min.y - center.y,
    bounds.min.z - center.z,
  );
  const boundsMax = new Vector3(
    bounds.max.x - center.x,
    bounds.max.y - center.y,
    bounds.max.z - center.z,
  );

  let bvh: GemBvhHandle | null = null;
  try {
    bvh = buildGemBvh(centered, triangleCount);
  } catch (err) {
    console.warn("[GemMeshAdapter] BVH build failed; linear fallback only", err);
  }

  return {
    triangleTexture,
    triangleCount,
    boundsMin,
    boundsMax,
    center,
    radius: Math.max(radius, 1e-4),
    characteristicLength: Math.max(size.x, size.y, size.z, 1e-4),
    worldCenter: center.clone(),
    localCenter: center.clone(),
    normalizationScale: 1,
    truncated,
    sourceLabel,
    bvh,
    centeredPositions: centered,
  };
}

/**
 * Pack a ModelViewer scene mesh for integration overlay.
 * Mesh-local vertices → center → POC reference normalization.
 * Live mesh.matrixWorld is applied each frame (model-viewer target pan/orbit).
 */
export function adaptMeshToGemFromScene(
  mesh: Mesh,
  sourceLabel = "mesh",
  targetCharacteristicLength = REFERENCE_CHARACTERISTIC_LENGTH,
): PackedGemMesh {
  mesh.updateWorldMatrix(true, false);
  const localMatrix = new Matrix4();
  const { positions, count: rawCount } = geometryWorldTriangles(
    mesh.geometry,
    localMatrix,
  );
  const truncated = rawCount > GEM_POC_MAX_TRIANGLES;
  const triangleCount = Math.min(rawCount, GEM_POC_MAX_TRIANGLES);
  const used = truncated ? positions.subarray(0, triangleCount * 9) : positions;

  const bounds = new Box3();
  const v = new Vector3();
  for (let i = 0; i < triangleCount * 3; i++) {
    v.set(used[i * 3], used[i * 3 + 1], used[i * 3 + 2]);
    bounds.expandByPoint(v);
  }
  const localCenter = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const normalizationScale = targetCharacteristicLength / maxDim;

  const centered = new Float32Array(triangleCount * 9);
  for (let i = 0; i < triangleCount * 3; i++) {
    centered[i * 3] = (used[i * 3] - localCenter.x) * normalizationScale;
    centered[i * 3 + 1] = (used[i * 3 + 1] - localCenter.y) * normalizationScale;
    centered[i * 3 + 2] = (used[i * 3 + 2] - localCenter.z) * normalizationScale;
  }

  const triangleTexture = packTriangleTexture(centered, triangleCount);
  const boundsMin = new Vector3(
    (bounds.min.x - localCenter.x) * normalizationScale,
    (bounds.min.y - localCenter.y) * normalizationScale,
    (bounds.min.z - localCenter.z) * normalizationScale,
  );
  const boundsMax = new Vector3(
    (bounds.max.x - localCenter.x) * normalizationScale,
    (bounds.max.y - localCenter.y) * normalizationScale,
    (bounds.max.z - localCenter.z) * normalizationScale,
  );
  const normSize = boundsMax.clone().sub(boundsMin);
  const radius = Math.max(normSize.x, normSize.y, normSize.z) * 0.5;

  const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);

  let bvh: GemBvhHandle | null = null;
  try {
    bvh = buildGemBvh(centered, triangleCount);
  } catch (err) {
    console.warn("[GemMeshAdapter] BVH build failed; linear fallback only", err);
  }

  return {
    triangleTexture,
    triangleCount,
    boundsMin,
    boundsMax,
    center: new Vector3(0, 0, 0),
    radius: Math.max(radius, 1e-4),
    characteristicLength: targetCharacteristicLength,
    worldCenter,
    localCenter: localCenter.clone(),
    normalizationScale,
    truncated,
    sourceLabel,
    bvh,
    centeredPositions: centered,
  };
}

/** World → normalized gem space: S * T(-localCenter) * inv(meshWorld). */
export function buildIntegrationGemInvMatrix(
  meshWorldMatrix: Matrix4,
  localCenter: Vector3,
  normalizationScale: number,
): Matrix4 {
  const invMesh = meshWorldMatrix.clone().invert();
  const m = new Matrix4().copy(invMesh);
  m.premultiply(new Matrix4().makeTranslation(-localCenter.x, -localCenter.y, -localCenter.z));
  m.premultiply(
    new Matrix4().makeScale(normalizationScale, normalizationScale, normalizationScale),
  );
  return m;
}

export function disposePackedGem(packed: PackedGemMesh | null) {
  if (!packed) return;
  packed.triangleTexture.dispose();
  disposeGemBvh(packed.bvh);
}

export function isDataTextureReady(tex: Texture | null | undefined): boolean {
  return Boolean(tex && (tex as DataTexture).image);
}
