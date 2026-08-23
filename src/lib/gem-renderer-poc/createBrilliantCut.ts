/**
 * Watertight procedural round-brilliant-inspired gem (closed manifold).
 * Hard facet normals (non-indexed). No hollow girdle shell — that caused
 * exploded/hollow ray paths in the first POC pass.
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

/**
 * Closed brilliant-like polyhedron:
 * table → crown → shared girdle ring → pavilion → culet.
 * Girdle is a single shared edge ring (zero thickness) — watertight.
 */
export function createBrilliantCutGeometry(): BufferGeometry {
  const tris: Tri[] = [];

  const tableY = 0.35;
  const girdleY = 0.0;
  const culetY = -0.7;

  const tableR = 0.45;
  const girdleR = 1.0;

  const n = 8;
  const table = ring(tableY, tableR, n, Math.PI / n);
  // 16-point girdle for denser crown/pavilion facets
  const girdle = ring(girdleY, girdleR, n * 2, 0);
  const culet = new Vector3(0, culetY, 0);
  const tableCenter = new Vector3(0, tableY, 0);

  // Table
  for (let i = 0; i < n; i++) {
    pushTri(tris, tableCenter, table[i], table[(i + 1) % n]);
  }

  // Crown: each table edge → two girdle segments (bezel + star-ish)
  for (let i = 0; i < n; i++) {
    const t0 = table[i];
    const t1 = table[(i + 1) % n];
    const g0 = girdle[i * 2];
    const g1 = girdle[i * 2 + 1];
    const g2 = girdle[(i * 2 + 2) % (n * 2)];
    // kite / bezel
    pushTri(tris, t0, g0, g1);
    pushTri(tris, t0, g1, t1);
    pushTri(tris, t1, g1, g2);
  }

  // Pavilion: girdle → culet (mains + lower girdle)
  for (let i = 0; i < n * 2; i++) {
    const g0 = girdle[i];
    const g1 = girdle[(i + 1) % (n * 2)];
    pushTri(tris, g0, culet, g1);
  }

  const positions = new Float32Array(tris.length * 9);
  const normals = new Float32Array(tris.length * 9);
  let flipped = 0;

  for (let i = 0; i < tris.length; i++) {
    const [a, b, c] = tris[i];
    const nrm = new Vector3()
      .subVectors(b, a)
      .cross(new Vector3().subVectors(c, a))
      .normalize();
    const mid = new Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
    // Outward = away from origin (stone centered on Y axis through origin)
    if (nrm.dot(mid) < 0) {
      nrm.negate();
      // Flip winding in position buffer for consistency
      tris[i] = [a, c, b];
      flipped++;
    }

    const [aa, bb, cc] = tris[i];
    const o = i * 9;
    positions[o] = aa.x;
    positions[o + 1] = aa.y;
    positions[o + 2] = aa.z;
    positions[o + 3] = bb.x;
    positions[o + 4] = bb.y;
    positions[o + 5] = bb.z;
    positions[o + 6] = cc.x;
    positions[o + 7] = cc.y;
    positions[o + 8] = cc.z;

    // Recompute normal after possible flip
    const n2 = new Vector3()
      .subVectors(bb, aa)
      .cross(new Vector3().subVectors(cc, aa))
      .normalize();
    if (n2.dot(mid) < 0) n2.negate();

    for (let k = 0; k < 3; k++) {
      normals[o + k * 3] = n2.x;
      normals[o + k * 3 + 1] = n2.y;
      normals[o + k * 3 + 2] = n2.z;
    }
  }

  void flipped;

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

/** Flat-shaded clone: unique verts per triangle so facet normals stay hard. */
export function hardenFacetNormals(geometry: BufferGeometry): BufferGeometry {
  const src = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = src.getAttribute("position") as BufferAttribute;
  const normals = new Float32Array(pos.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const nrm = new Vector3();
  const mid = new Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    nrm.copy(ab).cross(ac).normalize();
    mid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (nrm.dot(mid) < 0) nrm.negate();
    for (let k = 0; k < 3; k++) {
      normals[(i + k) * 3] = nrm.x;
      normals[(i + k) * 3 + 1] = nrm.y;
      normals[(i + k) * 3 + 2] = nrm.z;
    }
  }
  src.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  src.computeBoundingSphere();
  src.computeBoundingBox();
  return src;
}

/** Verify outward normals for unit tests / diagnostics. */
export function countInwardFacetNormals(geometry: BufferGeometry): number {
  const pos = geometry.getAttribute("position") as BufferAttribute;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const nrm = new Vector3();
  const mid = new Vector3();
  let bad = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    nrm.subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    mid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (nrm.dot(mid) < -1e-5) bad++;
  }
  return bad;
}
