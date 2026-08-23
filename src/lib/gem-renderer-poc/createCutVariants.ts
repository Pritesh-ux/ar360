/**
 * Additional procedural cuts for multi-GLB category validation (POC V5).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
} from "three";

type Tri = [Vector3, Vector3, Vector3];

function pushTri(tris: Tri[], a: Vector3, b: Vector3, c: Vector3) {
  const ab = new Vector3().subVectors(b, a);
  const ac = new Vector3().subVectors(c, a);
  if (ab.cross(ac).lengthSq() < 1e-14) return;
  tris.push([a.clone(), b.clone(), c.clone()]);
}

function ring(y: number, radius: number, n: number, phase = 0): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    out.push(new Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
  }
  return out;
}

function finalize(tris: Tri[]): BufferGeometry {
  const positions = new Float32Array(tris.length * 9);
  const normals = new Float32Array(tris.length * 9);
  const centroid = new Vector3();
  for (const [a, b, c] of tris) {
    centroid.add(a).add(b).add(c);
  }
  centroid.multiplyScalar(1 / (tris.length * 3 + 1e-8));

  let o = 0;
  for (const [a, b, c] of tris) {
    const n = new Vector3()
      .subVectors(b, a)
      .cross(new Vector3().subVectors(c, a))
      .normalize();
    const mid = new Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
    if (n.dot(new Vector3().subVectors(mid, centroid)) < 0) n.negate();
    for (const v of [a, b, c]) {
      positions[o] = v.x;
      positions[o + 1] = v.y;
      positions[o + 2] = v.z;
      normals[o] = n.x;
      normals[o + 1] = n.y;
      normals[o + 2] = n.z;
      o += 3;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  return g;
}

/** Higher-facet round brilliant (n=16 table / 32 girdle). */
export function createHighFacetBrilliantGeometry(): BufferGeometry {
  const tris: Tri[] = [];
  const n = 16;
  const table = ring(0.35, 0.45, n, Math.PI / n);
  const girdle = ring(0, 1, n * 2, 0);
  const culet = new Vector3(0, -0.7, 0);
  const tableCenter = new Vector3(0, 0.35, 0);
  for (let i = 0; i < n; i++) {
    pushTri(tris, tableCenter, table[i], table[(i + 1) % n]);
  }
  for (let i = 0; i < n; i++) {
    const t0 = table[i];
    const t1 = table[(i + 1) % n];
    const g0 = girdle[i * 2];
    const g1 = girdle[i * 2 + 1];
    const g2 = girdle[(i * 2 + 2) % (n * 2)];
    pushTri(tris, t0, g0, g1);
    pushTri(tris, t0, g1, t1);
    pushTri(tris, t1, g1, g2);
  }
  for (let i = 0; i < n * 2; i++) {
    pushTri(tris, girdle[i], culet, girdle[(i + 1) % (n * 2)]);
  }
  return finalize(tris);
}

/** Simple emerald / step-cut style (fancy category). */
export function createEmeraldCutGeometry(): BufferGeometry {
  const tris: Tri[] = [];
  const tiers = [
    { y: 0.4, rx: 0.35, rz: 0.5 },
    { y: 0.15, rx: 0.55, rz: 0.75 },
    { y: 0.0, rx: 0.7, rz: 0.95 },
    { y: -0.35, rx: 0.45, rz: 0.6 },
    { y: -0.65, rx: 0.15, rz: 0.2 },
  ];
  const rect = (y: number, rx: number, rz: number) => [
    new Vector3(-rx, y, -rz),
    new Vector3(rx, y, -rz),
    new Vector3(rx, y, rz),
    new Vector3(-rx, y, rz),
  ];
  const rings = tiers.map((t) => rect(t.y, t.rx, t.rz));
  // top table
  pushTri(tris, rings[0][0], rings[0][1], rings[0][2]);
  pushTri(tris, rings[0][0], rings[0][2], rings[0][3]);
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r];
    const b = rings[r + 1];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      pushTri(tris, a[i], b[i], b[j]);
      pushTri(tris, a[i], b[j], a[j]);
    }
  }
  const bottom = rings[rings.length - 1];
  pushTri(tris, bottom[0], bottom[2], bottom[1]);
  pushTri(tris, bottom[0], bottom[3], bottom[2]);
  return finalize(tris);
}

/** Intentionally broken mesh for UNSUPPORTED validation. */
export function createMalformedGemGeometry(): BufferGeometry {
  const positions = new Float32Array([
    // degenerate (collinear)
    0, 0, 0, 1, 0, 0, 2, 0, 0,
    // flipped / random
    0, 0, 0, 0, 1, 0, 1, 0, 0,
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    // open flap
    0, 0, 0, 0.5, 0.5, 0.2, -0.5, 0.5, 0.2,
  ]);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}
