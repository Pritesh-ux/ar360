import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enforcePermission } from "@/lib/billing/api-permission";
import { ensureAppSchema } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function hasValidImageSignature(buffer: Buffer, extension: string) {
  if (extension === "png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (extension === "jpg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (extension === "webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const permission = await enforcePermission(user.customerUid, "custom_branding");
  if (!permission.ok) return permission.response;

  const form = await request.formData();
  const workspaceUid = String(form.get("workspaceUid") || "").trim();
  const kind = String(form.get("kind") || "logo").trim().toLowerCase() === "favicon" ? "favicon" : "logo";
  const logo = form.get("logo") ?? form.get("file");
  if (!workspaceUid || !(logo instanceof File)) {
    return NextResponse.json({ error: "Workspace and image are required." }, { status: 400 });
  }

  const extension = IMAGE_EXTENSIONS[logo.type];
  if (!extension) {
    return NextResponse.json({ error: "Upload a PNG, JPG, or WebP image." }, { status: 400 });
  }
  if (!logo.size || logo.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Image must be smaller than 2 MB." }, { status: 400 });
  }

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "branding.manage");
  } catch (error) {
    return rbacErrorResponse(error);
  }

  const customerFolder = safeSegment(user.customerUid);
  const workspaceFolder = safeSegment(workspaceUid);
  if (!customerFolder || !workspaceFolder) {
    return NextResponse.json({ error: "Invalid workspace." }, { status: 400 });
  }

  const relativeDirectory = path.join("uploads", "branding", customerFolder);

  const buffer = Buffer.from(await logo.arrayBuffer());
  if (!hasValidImageSignature(buffer, extension)) {
    return NextResponse.json({ error: "The uploaded file is not a valid image." }, { status: 400 });
  }

  const prefix = kind === "favicon" ? "favicon" : "logo";
  const filename = `${workspaceFolder}-${prefix}-${randomUUID()}.${extension}`;
  const roots = new Set(
    ["./", process.env.AR360_PROJECT_ROOT].filter(
      (value): value is string => Boolean(value?.trim()),
    ),
  );
  await Promise.all(
    [...roots].map(async (root) => {
      const outputDirectory = path.join(root, "public", relativeDirectory);
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(path.join(outputDirectory, filename), buffer);
    }),
  );

  const assetUrl = `/${relativeDirectory.replace(/\\/g, "/")}/${filename}`;
  return NextResponse.json({
    success: true,
    kind,
    logoUrl: kind === "logo" ? assetUrl : undefined,
    faviconUrl: kind === "favicon" ? assetUrl : undefined,
  });
}
