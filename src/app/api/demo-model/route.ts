import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { createMinimalGlbBuffer } from "@/lib/object-capture/minimal-glb";

export const runtime = "nodejs";

const CANDIDATES = ["chair_01.glb", "chair.glb", "LOCK GLB.glb"];

async function readDemoModel(): Promise<Buffer> {
  const modelsDir = path.join("./", "public", "models");
  for (const name of CANDIDATES) {
    try {
      const data = await readFile(path.join(modelsDir, name));
      // Skip tiny placeholder meshes (< 50KB)
      if (data.byteLength > 50_000) return data;
    } catch {
      // try next
    }
  }
  return createMinimalGlbBuffer();
}

export async function GET() {
  const data = await readDemoModel();
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
