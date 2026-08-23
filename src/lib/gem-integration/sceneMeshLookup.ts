import type { Mesh, Object3D } from "three";
import { primitiveKey } from "@/lib/gem-renderer-poc/analyzeGemGeometry";

/** Map analyzeObject3D primitive keys → live scene meshes (traverse order). */
export function buildMeshIndex(root: Object3D): Map<string, Mesh> {
  const map = new Map<string, Mesh>();
  let prim = 0;
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const key = `${mesh.name || `mesh_${prim}`}#${prim}`;
    map.set(key, mesh);
    prim++;
  });
  return map;
}

export function findSceneMeshByKey(
  root: Object3D,
  meshKey: string,
): Mesh | null {
  return buildMeshIndex(root).get(meshKey) ?? null;
}

export function meshKeysFromScene(root: Object3D): string[] {
  return [...buildMeshIndex(root).keys()];
}

export { primitiveKey };
