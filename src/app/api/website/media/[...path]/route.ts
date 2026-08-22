import { NextResponse, type NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  // .svg intentionally omitted — inline SVG can execute script (XSS).
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".usdz": "model/vnd.usdz+zip",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

function resolveDiskPath(segments: string[]): string | null {
  if (!segments.length || segments.length > 8) return null;

  const decoded: string[] = [];
  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (!value || value === "." || value === ".." || /[\u0000-\u001f\\]/.test(value)) {
      return null;
    }
    decoded.push(value);
  }

  const candidate = path.resolve(UPLOADS_ROOT, ...decoded);
  const rootWithSep = UPLOADS_ROOT.endsWith(path.sep) ? UPLOADS_ROOT : UPLOADS_ROOT + path.sep;
  if (!candidate.startsWith(rootWithSep)) return null;

  if (!CONTENT_TYPES[path.extname(candidate).toLowerCase()]) return null;

  return candidate;
}

function notFound() {
  return NextResponse.json(
    { error: "File not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  const diskPath = resolveDiskPath(segments || []);

  if (!diskPath) return notFound();

  let stat;
  try {
    stat = await fs.stat(diskPath);
  } catch {
    return notFound();
  }

  if (!stat.isFile()) return notFound();

  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers: Record<string, string> = {
    "Content-Type": CONTENT_TYPES[path.extname(diskPath).toLowerCase()],
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  };

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  const webStream = Readable.toWeb(createReadStream(diskPath)) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
}
