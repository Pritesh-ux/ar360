import { randomUUID } from "crypto";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { hasClientManagementAccess } from "@/lib/billing/addons";

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

async function requireClientAccess(customerUid: string) {
  const ok = await hasClientManagementAccess(customerUid);
  if (!ok) {
    return NextResponse.json({ error: "Client Management addon required." }, { status: 403 });
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.customerUid) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    const gated = await requireClientAccess(customerUid);
    if (gated) return gated;

    const { id: clientUid } = await params;
    const owned = await query<{ client_uid: string }>(
      `SELECT client_uid FROM clients WHERE client_uid = ? AND customer_uid = ? LIMIT 1`,
      [clientUid, customerUid],
    );
    if (!owned[0]) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const form = await request.formData();
    const logo = form.get("logo") ?? form.get("file");
    if (!(logo instanceof File)) {
      return NextResponse.json({ error: "Image is required." }, { status: 400 });
    }

    const extension = IMAGE_EXTENSIONS[logo.type];
    if (!extension) {
      return NextResponse.json({ error: "Upload a PNG, JPG, or WebP image." }, { status: 400 });
    }
    if (!logo.size || logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Image must be smaller than 2 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await logo.arrayBuffer());
    if (!hasValidImageSignature(buffer, extension)) {
      return NextResponse.json({ error: "The uploaded file is not a valid image." }, { status: 400 });
    }

    const customerFolder = safeSegment(customerUid);
    const clientFolder = safeSegment(clientUid);
    const relativeDirectory = path.join("uploads", "clients", customerFolder, clientFolder);
    const filename = `logo-${randomUUID()}.${extension}`;

    // Write into every local public root PLUS durable shared uploads (VPS) so
    // deploys that swap the app tree cannot orphan freshly uploaded client logos.
    const roots = new Set<string>();
    for (const value of ["./", process.env.AR360_PROJECT_ROOT, process.env.AR360_SHARED_UPLOADS_ROOT]) {
      if (value?.trim()) roots.add(value.trim());
    }
    const sharedGuess = path.resolve("..", "shared");
    try {
      await access(sharedGuess);
      roots.add(sharedGuess);
    } catch {
      // no shared volume locally
    }

    await Promise.all(
      [...roots].map(async (root) => {
        const outputDirectory = path.join(root, "public", relativeDirectory);
        await mkdir(outputDirectory, { recursive: true });
        await writeFile(path.join(outputDirectory, filename), buffer);
      }),
    );

    const logoUrl = `/${relativeDirectory.replace(/\\/g, "/")}/${filename}`;
    await query(
      `UPDATE clients SET logo_url = ?, updated_at = NOW()
        WHERE client_uid = ? AND customer_uid = ?`,
      [logoUrl, clientUid, customerUid],
    );

    return NextResponse.json({ success: true, logoUrl });
  } catch (error) {
    console.error("POST /api/clients/[id]/logo error:", error);
    return NextResponse.json({ error: "Failed to upload logo." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.customerUid) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    const gated = await requireClientAccess(customerUid);
    if (gated) return gated;

    const { id: clientUid } = await params;
    const owned = await query<{ client_uid: string }>(
      `SELECT client_uid FROM clients WHERE client_uid = ? AND customer_uid = ? LIMIT 1`,
      [clientUid, customerUid],
    );
    if (!owned[0]) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    await query(
      `UPDATE clients SET logo_url = NULL, updated_at = NOW()
        WHERE client_uid = ? AND customer_uid = ?`,
      [clientUid, customerUid],
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/clients/[id]/logo error:", error);
    return NextResponse.json({ error: "Failed to remove logo." }, { status: 500 });
  }
}
