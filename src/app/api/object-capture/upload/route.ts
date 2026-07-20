import { NextResponse } from "next/server";
import { saveCaptureImages } from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireObjectCaptureUser();
  if (isApiError(user)) return user;

  let jobId = "";

  try {
    const formData = await req.formData();
    jobId = String(formData.get("jobId") || "");

    const files = formData
      .getAll("images")
      .filter((file): file is File => file instanceof File);

    if (!jobId) {
      return NextResponse.json({ success: false, error: "Job ID missing" }, { status: 400 });
    }

    const job = await saveCaptureImages(user.customerUid, jobId, files);
    if (!job) return notFound();
    return NextResponse.json({ success: true, uploaded: files.length, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("Object capture upload error:", error);

    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
