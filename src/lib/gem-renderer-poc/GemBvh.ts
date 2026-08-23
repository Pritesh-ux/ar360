/**
 * Gem BVH builder — three-mesh-bvh WebGL uniforms for the POC raytracer.
 * Isolated from production ModelViewer.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import {
  MeshBVH,
  MeshBVHUniformStruct,
} from "three-mesh-bvh";

export type GemBvhHandle = {
  geometry: BufferGeometry;
  bvh: MeshBVH;
  uniforms: MeshBVHUniformStruct;
  triangleCount: number;
  nodeCountEstimate: number;
};

/**
 * Build a GPU-packable BVH from centered, non-indexed triangle positions
 * (9 floats per triangle: v0,v1,v2). Winding must be outward.
 */
export function buildGemBvh(
  centeredPositions: Float32Array,
  triangleCount: number,
): GemBvhHandle {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(centeredPositions.slice(0, triangleCount * 9), 3),
  );

  const indices = new Uint32Array(triangleCount * 3);
  for (let i = 0; i < triangleCount * 3; i++) indices[i] = i;
  geometry.setIndex(new BufferAttribute(indices, 1));

  const bvh = new MeshBVH(geometry, {
    indirect: false,
  });

  const uniforms = new MeshBVHUniformStruct();
  uniforms.updateFrom(bvh);

  // Roots byte length / node size ≈ node count (for diagnostics)
  const root = (bvh as unknown as { _roots: ArrayBuffer[] })._roots?.[0];
  const nodeCountEstimate = root ? Math.max(1, root.byteLength / 32) : 1;

  return {
    geometry,
    bvh,
    uniforms,
    triangleCount,
    nodeCountEstimate,
  };
}

export function disposeGemBvh(handle: GemBvhHandle | null) {
  if (!handle) return;
  handle.uniforms.dispose();
  handle.geometry.dispose();
}
