import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { STORAGE_ALLOWLIST } from "@/lib/gem-renderer-poc/testAssetCatalog";

/**
 * POC only — serves allowlisted storage GLBs for local + staging validation.
 * Disabled on production (AR360_DEPLOY_TARGET !== staging).
 *
 * GET /api/experiments/gem-renderer/test-glb?id=jewelry
 */
function isPocAssetApiAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  return (
    (process.env.AR360_DEPLOY_TARGET || "").trim().toLowerCase() === "staging"
  );
}

async function readFirstExisting(paths: string[]): Promise<Buffer | null> {
  for (const p of paths) {
    try {
      return await readFile(p);
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function GET(req: Request) {
  if (!isPocAssetApiAllowed()) {
    return new NextResponse("Not available in production", { status: 404 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "jewelry";
  const rel = STORAGE_ALLOWLIST[id];
  if (!rel) {
    return new NextResponse(
      `Unknown test asset id. Allowlist: ${Object.keys(STORAGE_ALLOWLIST).join(", ")}`,
      { status: 400 },
    );
  }

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "storage", "Customers", ...rel.split("/")),
    // Staging deploy packs a fixture here (see scripts/deploy.mjs)
    path.join(cwd, "public", "experiments", "gem-renderer", "fixtures", "jewelry.glb"),
  ];

  const buf = await readFirstExisting(candidates);
  if (!buf) {
    return new NextResponse("Test GLB not found on disk", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Cache-Control": "no-store",
      "X-Gem-Poc": "v5-test-asset",
      "X-Gem-Asset-Id": id,
    },
  });
}
