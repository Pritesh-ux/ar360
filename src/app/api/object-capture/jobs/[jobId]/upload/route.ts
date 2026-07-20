import { NextResponse } from "next/server";
import { saveCaptureImages } from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

export const runtime = "nodejs";
type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const user = await requireObjectCaptureUser();
  if (isApiError(user)) return user;
  try {
    const { jobId } = await context.params;
    const form = await request.formData();
    const files = form.getAll("images").filter((value): value is File => value instanceof File);
    const job = await saveCaptureImages(user.customerUid, jobId, files);
    return job
      ? NextResponse.json({ success: true, uploaded: files.length, job })
      : notFound();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
