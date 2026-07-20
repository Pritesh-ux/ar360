import { NextResponse } from "next/server";
import {
  getCaptureJob,
  getCaptureSourceImage,
  readPrivateAsset,
} from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

export const runtime = "nodejs";
type Context = { params: Promise<{ jobId: string; asset: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await requireObjectCaptureUser({ subscription: false });
  if (isApiError(user)) return user;
  const { jobId, asset } = await context.params;
  const job = await getCaptureJob(jobId, user.customerUid);
  if (!job) return notFound();
  const source = asset.startsWith("source-")
    ? await getCaptureSourceImage(user.customerUid, jobId, asset.slice(7))
    : null;
  const storageKey = asset === "model"
    ? job.model_key
    : asset === "thumbnail"
      ? job.thumbnail_key
      : source?.storage_key || null;
  if (!storageKey) return notFound();
  try {
    const data = await readPrivateAsset(user.customerUid, storageKey);
    const imageType = storageKey.endsWith(".png")
      ? "image/png"
      : storageKey.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return new NextResponse(data, {
      headers: {
        "Content-Type": asset === "model" ? "model/gltf-binary" : source?.media_type || imageType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
