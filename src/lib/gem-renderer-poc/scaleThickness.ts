/**
 * Scale / thickness contract for SaaS GLBs (POC V5).
 *
 * Optical absorption uses Beer–Lambert with:
 *   opticalPath = travelDistance / characteristicLength * thickness
 *
 * characteristicLength = max AABB axis of the *centered* gem mesh after
 * view-fit normalization (see adaptMeshToGem).
 *
 * Therefore absolute world scale of the source GLB is cancelled by fitting
 * the mesh to a ~1.6 unit viewing size before packing triangles.
 * The `thickness` physical param is a relative multiplier (1.0 = default).
 *
 * If a future pipeline skips view-fit, characteristicLength MUST still be
 * derived from the rendered gem AABB — never from arbitrary scene units.
 */

import { Box3, Mesh, Vector3, type BufferGeometry } from "three";

export const GEM_VIEW_FIT_TARGET = 1.6;

export type ScaleThicknessReport = {
  sourceScale: number;
  viewFitScale: number;
  characteristicLength: number;
  thicknessParam: number;
  note: string;
};

/**
 * Compute view-fit scale so max AABB axis ≈ GEM_VIEW_FIT_TARGET.
 * Does not mutate the source mesh.
 */
export function computeViewFitScale(geometry: BufferGeometry, matrixWorldScale = 1): number {
  const g = geometry.clone();
  g.computeBoundingBox();
  const box = g.boundingBox ?? new Box3();
  const size = box.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-8) * matrixWorldScale;
  g.dispose();
  return GEM_VIEW_FIT_TARGET / maxDim;
}

export function describeScaleThicknessBehavior(): string {
  return [
    "1. Source GLB world units are arbitrary (mm, cm, or exporter units).",
    "2. GemRenderer applies view-fit so max AABB ≈ 1.6 before packing.",
    "3. characteristicLength = max AABB of centered packed mesh.",
    "4. Beer–Lambert uses travel / characteristicLength * thickness.",
    "5. Identical mesh at 0.1× / 1× / 10× source scale should look optically consistent after view-fit.",
    "6. Do not treat thickness as metres — it is dimensionless relative path.",
  ].join(" ");
}

/** Apply uniform source scale for optical consistency tests (clone geometry). */
export function meshWithUniformScale(mesh: Mesh, scale: number): Mesh {
  const m = new Mesh(mesh.geometry.clone());
  m.scale.copy(mesh.scale).multiplyScalar(scale);
  m.position.copy(mesh.position);
  m.quaternion.copy(mesh.quaternion);
  m.updateMatrixWorld(true);
  return m;
}
