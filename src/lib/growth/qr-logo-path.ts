import path from "path";
import fs from "fs/promises";

/** Relative URL prefixes permitted for QR center logos on disk. */
export const QR_LOGO_ALLOWED_URL_PREFIXES = ["/brand/", "/uploads/qr-logos/"] as const;

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

export type ContainedLogoPathResult =
  | { ok: true; absolutePath: string; publicUrlPath: string }
  | { ok: false; error: string };

function publicRoots(): string[] {
  const roots = [path.resolve(process.cwd(), "public")];
  const project = process.env["AR360_PROJECT_ROOT"]?.trim();
  if (project) {
    const extra = path.resolve(project, "public");
    if (!roots.includes(extra)) roots.push(extra);
  }
  return roots;
}

function allowedRootsForPublicRoot(publicRoot: string): string[] {
  return [
    path.resolve(publicRoot, "brand"),
    path.resolve(publicRoot, "uploads", "qr-logos"),
  ];
}

/**
 * Normalize a logo path/URL into a public-relative pathname (/brand/... or /uploads/qr-logos/...).
 * Rejects traversal, null bytes, and non-allowlisted prefixes.
 */
export function normalizeQrLogoPublicPath(input: string): string | null {
  const trimmed = String(input || "").trim();
  if (!trimmed || trimmed.includes("\0")) return null;

  let pathname = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  } else if (trimmed.startsWith("//")) {
    return null;
  }

  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  // Normalize to forward slashes; reject Windows absolute paths.
  decoded = decoded.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(decoded) || decoded.startsWith("//")) return null;
  if (!decoded.startsWith("/")) {
    decoded = `/${decoded}`;
  }

  // Collapse duplicate slashes; reject . / .. segments explicitly (before resolve).
  const segments = decoded.split("/").filter((s) => s.length > 0);
  if (segments.some((s) => s === "." || s === "..")) return null;

  const normalized = `/${segments.join("/")}`;
  const allowed = QR_LOGO_ALLOWED_URL_PREFIXES.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
  if (!allowed) return null;

  const ext = path.posix.extname(normalized).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return null;

  return normalized;
}

export function isSafeStoredQrLogoPath(input: string): boolean {
  return normalizeQrLogoPublicPath(input) != null && !/^https?:\/\//i.test(input.trim());
}

/**
 * Resolve a public logo URL path to a real file that stays inside allowed roots.
 * Uses realpath to block symlink escapes.
 */
export async function resolveContainedQrLogoFile(
  input: string,
): Promise<ContainedLogoPathResult> {
  const publicPath = normalizeQrLogoPublicPath(input);
  if (!publicPath) {
    return { ok: false, error: "Logo path is not allowed." };
  }

  const relative = publicPath.replace(/^\/+/, "");
  const roots = publicRoots();

  for (const publicRoot of roots) {
    const candidate = path.resolve(publicRoot, ...relative.split("/"));
    const allowedRoots = allowedRootsForPublicRoot(publicRoot);

    const underAllowed = allowedRoots.some(
      (root) => candidate === root || candidate.startsWith(root + path.sep),
    );
    if (!underAllowed) continue;

    let realFile: string;
    try {
      realFile = await fs.realpath(candidate);
    } catch {
      continue;
    }

    let escaped = true;
    for (const root of allowedRoots) {
      let realRoot = root;
      try {
        realRoot = await fs.realpath(root);
      } catch {
        // Root may not exist yet; use resolved path as-is for containment compare.
        realRoot = path.resolve(root);
      }
      if (realFile === realRoot || realFile.startsWith(realRoot + path.sep)) {
        escaped = false;
        break;
      }
    }
    if (escaped) continue;

    const ext = path.extname(realFile).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return { ok: false, error: "Unsupported logo image type." };
    }

    return { ok: true, absolutePath: realFile, publicUrlPath: publicPath };
  }

  return { ok: false, error: "Logo file was not found." };
}
