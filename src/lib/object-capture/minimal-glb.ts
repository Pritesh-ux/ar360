/** Builds a tiny valid GLB (empty scene) for dev/placeholder object-capture output. */
export function createMinimalGlbBuffer(): Buffer {
  const json = JSON.stringify({
    asset: { version: "2.0", generator: "AR360 Object Capture Placeholder" },
    scene: 0,
    scenes: [{ name: "Placeholder", nodes: [] }],
    nodes: [],
  });

  const jsonBytes = Buffer.from(json, "utf8");
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);

  const totalLength = 12 + 8 + jsonChunk.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0, 4, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // JSON

  return Buffer.concat([header, jsonHeader, jsonChunk]);
}
