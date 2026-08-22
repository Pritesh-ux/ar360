import { readFile } from "fs/promises";
import path from "path";
import { createMinimalGlbBuffer } from "@/lib/object-capture/minimal-glb";

const CANDIDATE_PATHS = [
  "public/models/object-capture-placeholder.glb",
  "public/models/chair.glb",
  "public/models/3D Podium.glb",
];

/** Returns GLB bytes for placeholder object-capture output when no real processor is configured. */
export async function resolvePlaceholderModelBuffer(): Promise<Buffer> {
  for (const relative of CANDIDATE_PATHS) {
    const absolute = path.join("./", relative);
    try {
      const data = await readFile(absolute);
      if (data.byteLength > 12) return data;
    } catch {
      // Try next candidate.
    }
  }

  return createMinimalGlbBuffer();
}
