/**
 * Collect mesh/node names related to each model-viewer material index.
 */

function getModelScene(viewer: any): any | null {
  if (!viewer) return null;
  const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
    (symbol) => symbol.description === "scene",
  );
  return sceneSymbol ? (viewer as any)[sceneSymbol] ?? null : null;
}

function pushUnique(bucket: string[], value: string | null | undefined) {
  const name = String(value || "").trim();
  if (!name) return;
  if (bucket.some((item) => item.toLowerCase() === name.toLowerCase())) return;
  bucket.push(name);
}

function threeMaterialMatchesMv(threeMat: any, mvMat: any): boolean {
  if (!threeMat || !mvMat) return false;
  try {
    for (const value of Object.values(mvMat)) {
      if (value === threeMat) return true;
      if (Array.isArray(value) && value.includes(threeMat)) return true;
    }
  } catch {
    // ignore non-enumerable internals
  }
  const threeName = String(threeMat.name || "").trim().toLowerCase();
  const mvName = String(mvMat.name || "").trim().toLowerCase();
  return Boolean(threeName && mvName && threeName === mvName);
}

function materialIndicesForMesh(mesh: any, mvMaterials: any[]): number[] {
  const raw = mesh?.material;
  const threeMats = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const slots: number[] = [];

  for (const threeMat of threeMats) {
    for (let i = 0; i < mvMaterials.length; i += 1) {
      if (threeMaterialMatchesMv(threeMat, mvMaterials[i])) {
        slots.push(i);
        break;
      }
    }
  }

  return Array.from(new Set(slots));
}

export type MaterialSceneNameMap = {
  /** Mesh/node names associated with each material index. */
  relatedNamesByIndex: string[][];
  /** Every mesh/node name found under the product scene. */
  allMeshNames: string[];
};

export function collectMaterialSceneNames(viewer: any): MaterialSceneNameMap {
  const mvMaterials = viewer?.model?.materials || [];
  const materialCount = mvMaterials.length;
  const relatedNamesByIndex: string[][] = Array.from({ length: materialCount }, () => []);
  const allMeshNames: string[] = [];

  const scene = getModelScene(viewer);
  const root = scene?.target;
  if (!root?.traverse || materialCount === 0) {
    return { relatedNamesByIndex, allMeshNames };
  }

  root.traverse((object: any) => {
    if (!object?.isMesh) return;
    pushUnique(allMeshNames, object.name);
    pushUnique(allMeshNames, object.parent?.name);

    const indices = materialIndicesForMesh(object, mvMaterials);
    for (const index of indices) {
      pushUnique(relatedNamesByIndex[index], object.name);
      pushUnique(relatedNamesByIndex[index], object.parent?.name);
    }
  });

  return { relatedNamesByIndex, allMeshNames };
}
