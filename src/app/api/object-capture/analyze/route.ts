import { NextResponse } from "next/server";
import { analyzeCaptureJob } from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireObjectCaptureUser();
  if (isApiError(user)) return user;

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ success: false, error: "Job ID missing" }, { status: 400 });
    }

    const summary = await analyzeCaptureJob(user.customerUid, String(jobId));
    if (!summary) return notFound();

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("Object capture analysis error:", error);

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
