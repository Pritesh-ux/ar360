import { NextResponse } from "next/server";
import { cancelCaptureJob } from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

export async function POST(req: Request) {
  const user = await requireObjectCaptureUser();
  if (isApiError(user)) return user;

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Job ID missing" },
        { status: 400 }
      );
    }

    const job = await cancelCaptureJob(user.customerUid, String(jobId));
    if (!job) return notFound();

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("Cancel object capture error:", error);

    return NextResponse.json(
      { success: false, error: "Cancel failed" },
      { status: 500 }
    );
  }
}