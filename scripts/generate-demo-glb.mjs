import fs from "node:fs/promises";
import path from "node:path";

/** Pack a glTF JSON + binary buffer into a GLB file. */
function buildGlb(gltf, binaryChunk = null) {
  const jsonBytes = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);

  const chunks = [jsonChunk];
  if (binaryChunk) {
    const binPadding = (4 - (binaryChunk.length % 4)) % 4;
    chunks.push(Buffer.concat([binaryChunk, Buffer.alloc(binPadding, 0x20)]));
  }

  let totalLength = 12;
  for (const chunk of chunks) totalLength += 8 + chunk.length;

  const header = Buffer.alloc(12);
  header.write("glTF", 0, 4, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const parts = [header];
  parts.push(writeChunk(jsonChunk, 0x4e4f534a));
  if (binaryChunk) {
    parts.push(writeChunk(chunks[1], 0x004e4942));
  }

  return Buffer.concat(parts);
}

function writeChunk(data, type) {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(data.length, 0);
  header.writeUInt32LE(type, 4);
  return Buffer.concat([header, data]);
}

function boxMesh(hx, hy, hz) {
  const positions = new Float32Array([
    -hx, -hy, -hz, hx, -hy, -hz, hx, hy, -hz, -hx, hy, -hz,
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    2, 6, 7, 2, 7, 3,
    0, 3, 7, 0, 7, 4,
    1, 5, 6, 1, 6, 2,
  ]);
  return { positions, indices };
}

function translatePositions(positions, tx, ty, tz) {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = positions[i] + tx;
    out[i + 1] = positions[i + 1] + ty;
    out[i + 2] = positions[i + 2] + tz;
  }
  return out;
}

function buildMultiMaterialGlb(partDefs, materials) {
  const binaryParts = [];
  const accessors = [];
  const bufferViews = [];
  const primitives = [];
  let byteOffset = 0;
  let accessorIndex = 0;
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];

  for (const part of partDefs) {
    const mesh = boxMesh(part.hx, part.hy, part.hz);
    const positions = translatePositions(mesh.positions, part.tx, part.ty, part.tz);
    const indices = mesh.indices;

    for (let i = 0; i < positions.length; i += 3) {
      min[0] = Math.min(min[0], positions[i]);
      min[1] = Math.min(min[1], positions[i + 1]);
      min[2] = Math.min(min[2], positions[i + 2]);
      max[0] = Math.max(max[0], positions[i]);
      max[1] = Math.max(max[1], positions[i + 1]);
      max[2] = Math.max(max[2], positions[i + 2]);
    }

    const posBytes = Buffer.from(positions.buffer);
    const idxBytes = Buffer.from(indices.buffer);
    binaryParts.push(posBytes, idxBytes);

    const posViewIndex = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: posBytes.length });
    byteOffset += posBytes.length;

    const idxViewIndex = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: idxBytes.length });
    byteOffset += idxBytes.length;

    const posAccessor = accessorIndex++;
    accessors.push({
      bufferView: posViewIndex,
      componentType: 5126,
      count: positions.length / 3,
      type: "VEC3",
      min: [part.tx - part.hx, part.ty - part.hy, part.tz - part.hz],
      max: [part.tx + part.hx, part.ty + part.hy, part.tz + part.hz],
    });

    const idxAccessor = accessorIndex++;
    accessors.push({
      bufferView: idxViewIndex,
      componentType: 5123,
      count: indices.length,
      type: "SCALAR",
    });

    primitives.push({
      attributes: { POSITION: posAccessor },
      indices: idxAccessor,
      material: part.material,
    });
  }

  const binary = Buffer.concat(binaryParts);

  const gltf = {
    asset: { version: "2.0", generator: "AR360 marketing chair" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "ModernArmchair" }],
    meshes: [{ name: "ArmchairMesh", primitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binary.length }],
  };

  return buildGlb(gltf, binary);
}

/** Marketing armchair — fabric, wood, accent trim; no external textures. */
function createDemoChairGlb() {
  const materials = [
    {
      name: "FabricUpholstery",
      pbrMetallicRoughness: {
        baseColorFactor: [0.62, 0.68, 0.54, 1],
        metallicFactor: 0.02,
        roughnessFactor: 0.82,
      },
    },
    {
      name: "WoodFrame",
      pbrMetallicRoughness: {
        baseColorFactor: [0.42, 0.28, 0.18, 1],
        metallicFactor: 0.05,
        roughnessFactor: 0.62,
      },
    },
    {
      name: "LimeAccent",
      pbrMetallicRoughness: {
        baseColorFactor: [0.79, 1, 0.34, 1],
        metallicFactor: 0.15,
        roughnessFactor: 0.45,
      },
    },
    {
      name: "DarkLegs",
      pbrMetallicRoughness: {
        baseColorFactor: [0.18, 0.12, 0.09, 1],
        metallicFactor: 0.08,
        roughnessFactor: 0.55,
      },
    },
  ];

  const parts = [
    { hx: 0.3, hy: 0.055, hz: 0.3, tx: 0, ty: 0.44, tz: 0.02, material: 0 },
    { hx: 0.3, hy: 0.34, hz: 0.05, tx: 0, ty: 0.66, tz: -0.24, material: 0 },
    { hx: 0.06, hy: 0.11, hz: 0.28, tx: -0.3, ty: 0.58, tz: -0.02, material: 1 },
    { hx: 0.06, hy: 0.11, hz: 0.28, tx: 0.3, ty: 0.58, tz: -0.02, material: 1 },
    { hx: 0.28, hy: 0.025, hz: 0.025, tx: 0, ty: 0.52, tz: -0.08, material: 2 },
    { hx: 0.035, hy: 0.22, hz: 0.035, tx: -0.22, ty: 0.22, tz: 0.2, material: 3 },
    { hx: 0.035, hy: 0.22, hz: 0.035, tx: 0.22, ty: 0.22, tz: 0.2, material: 3 },
    { hx: 0.035, hy: 0.22, hz: 0.035, tx: -0.22, ty: 0.22, tz: -0.18, material: 3 },
    { hx: 0.035, hy: 0.22, hz: 0.035, tx: 0.22, ty: 0.22, tz: -0.18, material: 3 },
    { hx: 0.26, hy: 0.02, hz: 0.02, tx: 0, ty: 0.28, tz: 0.18, material: 1 },
    { hx: 0.26, hy: 0.02, hz: 0.02, tx: 0, ty: 0.28, tz: -0.22, material: 1 },
  ];

  return buildMultiMaterialGlb(parts, materials);
}

function createMinimalGlb() {
  const gltf = {
    asset: { version: "2.0", generator: "AR360 placeholder" },
    scene: 0,
    scenes: [{ name: "Empty", nodes: [] }],
    nodes: [],
  };
  return buildGlb(gltf);
}

const outDir = path.join(process.cwd(), "public", "models");
await fs.mkdir(outDir, { recursive: true });

const files = [
  ["chair.glb", createDemoChairGlb()],
  ["object-capture-placeholder.glb", createMinimalGlb()],
];

for (const [name, data] of files) {
  const target = path.join(outDir, name);
  await fs.writeFile(target, data);
  console.log(`Wrote ${target} (${data.byteLength} bytes)`);
}

console.log("\nDemo GLB assets ready.\n");
