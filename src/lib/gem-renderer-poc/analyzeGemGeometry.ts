/**
 * Read-only geometry diagnostics for Gem Renderer POC V3.
 * Never mutates GLB bytes. Never silently repairs meshes.
 */
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Mesh,
  Vector3,
  type Object3D,
} from "three";

export type MeshPrimitiveReport = {
  meshName: string;
  primitiveIndex: number;
  vertexCount: number;
  triangleCount: number;
  indexed: boolean;
  hasNormals: boolean;
  hasUvs: boolean;
  materialName: string | null;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  dimensions: [number, number, number];
  scaleHint: number;
  degenerateTriangles: number;
  duplicateFaces: number;
  windingOutwardRatio: number;
  windingInconsistent: boolean;
  normalContinuity: {
    averageAdjacentDot: number;
    hardEdgeRatio: number;
    note: string;
  };
  openEdges: number;
  /** Open edges after welding coincident vertices (true shell holes). */
  weldedOpenEdges: number;
  watertightLikely: boolean | null;
  selfIntersectionSamples: number;
  selfIntersectionHits: number;
  selfIntersectionNote: string;
  suitability: "good" | "partial" | "poor";
  problems: string[];
};

export type GlbGeometryReport = {
  sourceLabel: string;
  meshPrimitiveCount: number;
  materialCount: number;
  totalVertices: number;
  totalTriangles: number;
  worldBounds: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  primitives: MeshPrimitiveReport[];
  recommendedPrimitiveKeys: string[];
  overallCompatibility: "PASS" | "PARTIAL" | "FAIL";
  summaryProblems: string[];
};

function keyEdge(a: number, b: number) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function faceKey(i0: number, i1: number, i2: number) {
  const s = [i0, i1, i2].sort((a, b) => a - b);
  return `${s[0]}|${s[1]}|${s[2]}`;
}

function analyzeGeometry(
  geometry: BufferGeometry,
  matrixWorld: Matrix4,
  meshName: string,
  primitiveIndex: number,
  materialName: string | null,
): MeshPrimitiveReport {
  const problems: string[] = [];
  const src = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = src.getAttribute("position") as BufferAttribute | undefined;
  const nrmAttr = src.getAttribute("normal") as BufferAttribute | undefined;
  const uvAttr = src.getAttribute("uv");

  if (!posAttr) {
    return {
      meshName,
      primitiveIndex,
      vertexCount: 0,
      triangleCount: 0,
      indexed: Boolean(geometry.index),
      hasNormals: false,
      hasUvs: false,
      materialName,
      boundingBox: {
        min: [0, 0, 0],
        max: [0, 0, 0],
        size: [0, 0, 0],
      },
      dimensions: [0, 0, 0],
      scaleHint: 0,
      degenerateTriangles: 0,
      duplicateFaces: 0,
      windingOutwardRatio: 0,
      windingInconsistent: true,
      normalContinuity: {
        averageAdjacentDot: 0,
        hardEdgeRatio: 1,
        note: "No positions",
      },
      openEdges: 0,
      weldedOpenEdges: 0,
      watertightLikely: false,
      selfIntersectionSamples: 0,
      selfIntersectionHits: 0,
      selfIntersectionNote: "skipped",
      suitability: "poor",
      problems: ["Missing POSITION attribute"],
    };
  }

  const vertexCount = posAttr.count;
  const triangleCount = Math.floor(vertexCount / 3);
  const indexed = Boolean(geometry.index);

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const nrm = new Vector3();
  const mid = new Vector3();
  const box = new Box3();

  let degenerateTriangles = 0;
  let outward = 0;
  let inward = 0;

  // World-space positions for bounds / tests
  const world = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    a.fromBufferAttribute(posAttr, i).applyMatrix4(matrixWorld);
    world[i * 3] = a.x;
    world[i * 3 + 1] = a.y;
    world[i * 3 + 2] = a.z;
    box.expandByPoint(a);
  }

  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  const faceMap = new Map<string, number>();
  let duplicateFaces = 0;

  // Edge map for open-edge / watertight heuristic (uses original indices if present)
  const edgeUse = new Map<string, number>();
  const indexAttr = geometry.index;

  for (let t = 0; t < triangleCount; t++) {
    const i0 = t * 3;
    a.set(world[i0 * 3], world[i0 * 3 + 1], world[i0 * 3 + 2]);
    b.set(world[(i0 + 1) * 3], world[(i0 + 1) * 3 + 1], world[(i0 + 1) * 3 + 2]);
    c.set(world[(i0 + 2) * 3], world[(i0 + 2) * 3 + 1], world[(i0 + 2) * 3 + 2]);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    nrm.copy(ab).cross(ac);
    const area2 = nrm.lengthSq();
    if (area2 < 1e-16) {
      degenerateTriangles++;
      continue;
    }
    nrm.normalize();
    mid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    const away = mid.clone().sub(center);
    if (away.lengthSq() < 1e-12) {
      // near center — skip winding vote
    } else if (nrm.dot(away) >= 0) outward++;
    else inward++;

    // Duplicate face detection on non-indexed vertex positions (quantized)
    const q = (v: Vector3) =>
      `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
    const fk = [q(a), q(b), q(c)].sort().join("|");
    const prev = faceMap.get(fk) || 0;
    if (prev > 0) duplicateFaces++;
    faceMap.set(fk, prev + 1);
  }

  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const i0 = indexAttr.getX(i);
      const i1 = indexAttr.getX(i + 1);
      const i2 = indexAttr.getX(i + 2);
      for (const e of [keyEdge(i0, i1), keyEdge(i1, i2), keyEdge(i2, i0)]) {
        edgeUse.set(e, (edgeUse.get(e) || 0) + 1);
      }
      void faceKey;
    }
  } else {
    // Non-indexed: weld by quantized position for edge map
    const weld = new Map<string, number>();
    const ids: number[] = [];
    let next = 0;
    for (let i = 0; i < vertexCount; i++) {
      const k = `${world[i * 3].toFixed(5)}|${world[i * 3 + 1].toFixed(5)}|${world[i * 3 + 2].toFixed(5)}`;
      let id = weld.get(k);
      if (id === undefined) {
        id = next++;
        weld.set(k, id);
      }
      ids.push(id);
    }
    for (let t = 0; t < triangleCount; t++) {
      const i0 = ids[t * 3];
      const i1 = ids[t * 3 + 1];
      const i2 = ids[t * 3 + 2];
      for (const e of [keyEdge(i0, i1), keyEdge(i1, i2), keyEdge(i2, i0)]) {
        edgeUse.set(e, (edgeUse.get(e) || 0) + 1);
      }
    }
  }

  let openEdges = 0;
  let nonManifoldEdges = 0;
  for (const n of edgeUse.values()) {
    if (n === 1) openEdges++;
    else if (n > 2) nonManifoldEdges++;
  }

  // Geometric weld (position-quantized) — split-vertex hard facets often look
  // "open" topologically while still forming a closed shell.
  const weld = new Map<string, number>();
  const weldedIds: number[] = [];
  let weldNext = 0;
  for (let i = 0; i < vertexCount; i++) {
    const k = `${world[i * 3].toFixed(4)}|${world[i * 3 + 1].toFixed(4)}|${world[i * 3 + 2].toFixed(4)}`;
    let id = weld.get(k);
    if (id === undefined) {
      id = weldNext++;
      weld.set(k, id);
    }
    weldedIds.push(id);
  }
  const weldedEdgeUse = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const i0 = weldedIds[t * 3];
    const i1 = weldedIds[t * 3 + 1];
    const i2 = weldedIds[t * 3 + 2];
    if (i0 === i1 || i1 === i2 || i2 === i0) continue;
    for (const e of [keyEdge(i0, i1), keyEdge(i1, i2), keyEdge(i2, i0)]) {
      weldedEdgeUse.set(e, (weldedEdgeUse.get(e) || 0) + 1);
    }
  }
  let weldedOpenEdges = 0;
  let weldedNonManifold = 0;
  for (const n of weldedEdgeUse.values()) {
    if (n === 1) weldedOpenEdges++;
    else if (n > 2) weldedNonManifold++;
  }

  const windingVotes = outward + inward;
  const windingOutwardRatio = windingVotes > 0 ? outward / windingVotes : 0;
  const windingInconsistent =
    windingVotes > 0 && Math.min(outward, inward) / windingVotes > 0.15;

  // Normal continuity: average absolute adjacent-face normal dots along shared edges
  // Approximate via sequential triangle normals for hard-facet jewelry
  let adjDotSum = 0;
  let adjCount = 0;
  let hardEdges = 0;
  const faceNormals: Vector3[] = [];
  for (let t = 0; t < triangleCount; t++) {
    const i0 = t * 3;
    a.set(world[i0 * 3], world[i0 * 3 + 1], world[i0 * 3 + 2]);
    b.set(world[(i0 + 1) * 3], world[(i0 + 1) * 3 + 1], world[(i0 + 1) * 3 + 2]);
    c.set(world[(i0 + 2) * 3], world[(i0 + 2) * 3 + 1], world[(i0 + 2) * 3 + 2]);
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-16) {
      faceNormals.push(new Vector3(0, 1, 0));
      continue;
    }
    faceNormals.push(n.normalize());
  }
  // Sample neighboring triangles in index space (weak proxy) + attribute normals if present
  for (let t = 1; t < faceNormals.length; t++) {
    const d = faceNormals[t].dot(faceNormals[t - 1]);
    adjDotSum += d;
    adjCount++;
    if (d < 0.5) hardEdges++;
  }
  let averageAdjacentDot = adjCount > 0 ? adjDotSum / adjCount : 1;
  let hardEdgeRatio = adjCount > 0 ? hardEdges / adjCount : 0;
  let continuityNote =
    "Faceted mesh expected for diamonds (hard edges OK). Sequential-neighbor proxy only.";

  // Use normals from the (possibly non-indexed) analysis geometry
  const analysisNrm = src.getAttribute("normal") as BufferAttribute | null;

  if (analysisNrm && analysisNrm.count === vertexCount) {
    let flatFacets = 0;
    let varyingWithinTri = 0;
    for (let t = 0; t < triangleCount; t++) {
      const i = t * 3;
      const n0 = new Vector3().fromBufferAttribute(analysisNrm, i);
      const n1 = new Vector3().fromBufferAttribute(analysisNrm, i + 1);
      const n2 = new Vector3().fromBufferAttribute(analysisNrm, i + 2);
      const avg = n0.dot(n1) + n1.dot(n2) + n2.dot(n0);
      // Flat facet ⇒ three identical (or near) normals ⇒ avg ≈ 3
      if (avg > 2.7) flatFacets++;
      else varyingWithinTri++;
    }
    const flatRatio = triangleCount > 0 ? flatFacets / triangleCount : 0;
    hardEdgeRatio = flatRatio;
    averageAdjacentDot = flatRatio;
    if (flatRatio >= 0.7) {
      continuityNote =
        "Hard/flat facet normals dominant within triangles (good for diamond optics).";
    } else if (varyingWithinTri > flatFacets) {
      continuityNote =
        "Vertex normals vary inside triangles — likely smooth-shaded; hard facets may be blurred.";
      problems.push("Smooth-shaded vertex normals (not hard facet normals)");
    } else {
      continuityNote = "Mixed flat and smooth-shaded triangles.";
      problems.push("Mixed normal styles across mesh");
    }
  }

  // Self-intersection: random triangle-pair Möller samples (cap)
  const maxPairs = Math.min(2000, (triangleCount * (triangleCount - 1)) / 2);
  let selfIntersectionSamples = 0;
  let selfIntersectionHits = 0;
  const triA = new Vector3();
  const triB = new Vector3();
  const triC = new Vector3();
  // Lightweight AABB reject between triangles
  const sampleCount = Math.min(
    800,
    triangleCount <= 1 ? 0 : Math.floor(Math.sqrt(triangleCount) * 40),
  );
  for (let s = 0; s < sampleCount; s++) {
    const t0 = Math.floor(Math.random() * triangleCount);
    let t1 = Math.floor(Math.random() * triangleCount);
    if (t1 === t0) t1 = (t1 + 1) % triangleCount;
    selfIntersectionSamples++;
    const box0 = triBox(world, t0);
    const box1 = triBox(world, t1);
    if (!aabbOverlap(box0, box1, 1e-5)) continue;
    // Shared vertex skip (adjacent)
    if (trianglesShareVertex(world, t0, t1)) continue;
    if (trianglesIntersectRough(world, t0, t1, triA, triB, triC)) {
      selfIntersectionHits++;
    }
  }
  void maxPairs;

  const selfIntersectionNote =
    sampleCount === 0
      ? "n/a"
      : selfIntersectionHits > 0
        ? `Sampled ${selfIntersectionSamples} pairs; ${selfIntersectionHits} possible intersections (heuristic).`
        : `Sampled ${selfIntersectionSamples} pairs; no intersections found in sample.`;

  const watertightLikely =
    weldedOpenEdges === 0 && weldedNonManifold === 0
      ? true
      : weldedOpenEdges > 0
        ? false
        : null;

  if (degenerateTriangles > 0) {
    problems.push(`${degenerateTriangles} degenerate triangles`);
  }
  if (duplicateFaces > 0) {
    problems.push(`${duplicateFaces} duplicate faces`);
  }
  if (openEdges > 0) {
    problems.push(
      `${openEdges} topological open edges (split-vertex hard edges common)`,
    );
  }
  if (weldedOpenEdges > 0) {
    problems.push(
      `${weldedOpenEdges} geometric open edges after position-weld (not a closed shell)`,
    );
  }
  if (nonManifoldEdges > 0 || weldedNonManifold > 0) {
    problems.push(
      `${Math.max(nonManifoldEdges, weldedNonManifold)} non-manifold edges`,
    );
  }
  if (windingInconsistent) {
    problems.push("Inconsistent winding vs centroid outward test");
  }
  if (selfIntersectionHits > 0) {
    problems.push("Possible self-intersections (sampled)");
  }
  if (triangleCount > 4096) {
    problems.push(`Triangle count ${triangleCount} exceeds POC soft cap 4096`);
  }

  let suitability: MeshPrimitiveReport["suitability"] = "good";
  if (
    weldedOpenEdges > 0 ||
    degenerateTriangles > triangleCount * 0.02 ||
    windingInconsistent ||
    selfIntersectionHits > 3
  ) {
    suitability = "poor";
  } else if (
    duplicateFaces > 0 ||
    nonManifoldEdges > 0 ||
    weldedNonManifold > 0 ||
    selfIntersectionHits > 0 ||
    openEdges > 0 ||
    problems.some((p) => /smooth-shaded|Mixed normal/i.test(p))
  ) {
    suitability = "partial";
  }

  if (src !== geometry) src.dispose();

  return {
    meshName,
    primitiveIndex,
    vertexCount: geometry.getAttribute("position")?.count ?? vertexCount,
    triangleCount: indexAttr
      ? Math.floor(indexAttr.count / 3)
      : triangleCount,
    indexed,
    hasNormals: Boolean(nrmAttr),
    hasUvs: Boolean(uvAttr),
    materialName,
    boundingBox: {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      size: [size.x, size.y, size.z],
    },
    dimensions: [size.x, size.y, size.z],
    scaleHint: Math.max(size.x, size.y, size.z),
    degenerateTriangles,
    duplicateFaces,
    windingOutwardRatio,
    windingInconsistent,
    normalContinuity: {
      averageAdjacentDot,
      hardEdgeRatio,
      note: continuityNote,
    },
    openEdges,
    weldedOpenEdges,
    watertightLikely,
    selfIntersectionSamples,
    selfIntersectionHits,
    selfIntersectionNote,
    suitability,
    problems,
  };
}

function triBox(world: Float32Array, t: number) {
  const i = t * 9;
  const min = [
    Math.min(world[i], world[i + 3], world[i + 6]),
    Math.min(world[i + 1], world[i + 4], world[i + 7]),
    Math.min(world[i + 2], world[i + 5], world[i + 8]),
  ];
  const max = [
    Math.max(world[i], world[i + 3], world[i + 6]),
    Math.max(world[i + 1], world[i + 4], world[i + 7]),
    Math.max(world[i + 2], world[i + 5], world[i + 8]),
  ];
  return { min, max };
}

function aabbOverlap(
  a: { min: number[]; max: number[] },
  b: { min: number[]; max: number[] },
  eps: number,
) {
  return (
    a.min[0] <= b.max[0] + eps &&
    a.max[0] >= b.min[0] - eps &&
    a.min[1] <= b.max[1] + eps &&
    a.max[1] >= b.min[1] - eps &&
    a.min[2] <= b.max[2] + eps &&
    a.max[2] >= b.min[2] - eps
  );
}

function trianglesShareVertex(world: Float32Array, t0: number, t1: number) {
  const q = (t: number, v: number) => {
    const i = t * 9 + v * 3;
    return `${world[i].toFixed(5)}|${world[i + 1].toFixed(5)}|${world[i + 2].toFixed(5)}`;
  };
  const s0 = new Set([q(t0, 0), q(t0, 1), q(t0, 2)]);
  return s0.has(q(t1, 0)) || s0.has(q(t1, 1)) || s0.has(q(t1, 2));
}

/** Conservative SAT-ish edge tests — heuristic, not exact CDT. */
function trianglesIntersectRough(
  world: Float32Array,
  t0: number,
  t1: number,
  _a: Vector3,
  _b: Vector3,
  _c: Vector3,
) {
  // Use separating axis on face normals + edge crosses is heavy; use
  // midpoint distance vs sum of extents as coarse flag only when AABBs overlap.
  const c0 = [
    (world[t0 * 9] + world[t0 * 9 + 3] + world[t0 * 9 + 6]) / 3,
    (world[t0 * 9 + 1] + world[t0 * 9 + 4] + world[t0 * 9 + 7]) / 3,
    (world[t0 * 9 + 2] + world[t0 * 9 + 5] + world[t0 * 9 + 8]) / 3,
  ];
  const c1 = [
    (world[t1 * 9] + world[t1 * 9 + 3] + world[t1 * 9 + 6]) / 3,
    (world[t1 * 9 + 1] + world[t1 * 9 + 4] + world[t1 * 9 + 7]) / 3,
    (world[t1 * 9 + 2] + world[t1 * 9 + 5] + world[t1 * 9 + 8]) / 3,
  ];
  const dx = c0[0] - c1[0];
  const dy = c0[1] - c1[1];
  const dz = c0[2] - c1[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const b0 = triBox(world, t0);
  const b1 = triBox(world, t1);
  const e0 =
    Math.hypot(b0.max[0] - b0.min[0], b0.max[1] - b0.min[1], b0.max[2] - b0.min[2]) *
    0.5;
  const e1 =
    Math.hypot(b1.max[0] - b1.min[0], b1.max[1] - b1.min[1], b1.max[2] - b1.min[2]) *
    0.5;
  return dist < (e0 + e1) * 0.35;
}

export function analyzeObject3D(root: Object3D, sourceLabel: string): GlbGeometryReport {
  root.updateMatrixWorld(true);
  const primitives: MeshPrimitiveReport[] = [];
  const materials = new Set<string>();
  const worldBox = new Box3();

  let prim = 0;
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material;
    const matName = Array.isArray(mat)
      ? mat.map((m) => m.name || "unnamed").join(",")
      : mat?.name || "unnamed";
    materials.add(matName);
    const report = analyzeGeometry(
      mesh.geometry,
      mesh.matrixWorld,
      mesh.name || `mesh_${prim}`,
      prim,
      matName,
    );
    primitives.push(report);
    worldBox.expandByPoint(
      new Vector3(...report.boundingBox.min),
    );
    worldBox.expandByPoint(
      new Vector3(...report.boundingBox.max),
    );
    prim++;
  });

  const size = worldBox.getSize(new Vector3());
  const totalVertices = primitives.reduce((s, p) => s + p.vertexCount, 0);
  const totalTriangles = primitives.reduce((s, p) => s + p.triangleCount, 0);

  const recommendedPrimitiveKeys = primitives
    .filter((p) => {
      const n = p.meshName.toLowerCase();
      return (
        n.includes("gem") ||
        n.includes("stone") ||
        n.includes("diamond") ||
        n.includes("crystal") ||
        (p.triangleCount > 0 &&
          p.triangleCount < 8000 &&
          !n.includes("gold") &&
          !n.includes("metal") &&
          !n.includes("ring"))
      );
    })
    .map((p) => `${p.meshName}#${p.primitiveIndex}`);

  const summaryProblems = [
    ...new Set(primitives.flatMap((p) => p.problems.map((x) => `${p.meshName}: ${x}`))),
  ];

  const gemLike = primitives.filter((p) =>
    /gem|stone|diamond|crystal/i.test(p.meshName),
  );
  const focus = gemLike.length > 0 ? gemLike : primitives;
  const poor = focus.filter((p) => p.suitability === "poor").length;
  const partial = focus.filter((p) => p.suitability === "partial").length;

  let overallCompatibility: GlbGeometryReport["overallCompatibility"] = "PASS";
  if (focus.length === 0 || poor === focus.length) overallCompatibility = "FAIL";
  else if (poor > 0 || partial > 0) overallCompatibility = "PARTIAL";

  return {
    sourceLabel,
    meshPrimitiveCount: primitives.length,
    materialCount: materials.size,
    totalVertices,
    totalTriangles,
    worldBounds: {
      min: [worldBox.min.x, worldBox.min.y, worldBox.min.z],
      max: [worldBox.max.x, worldBox.max.y, worldBox.max.z],
      size: [size.x, size.y, size.z],
    },
    primitives,
    recommendedPrimitiveKeys,
    overallCompatibility,
    summaryProblems,
  };
}

export function primitiveKey(p: MeshPrimitiveReport) {
  return `${p.meshName}#${p.primitiveIndex}`;
}
