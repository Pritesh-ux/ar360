import { NextResponse } from "next/server";
import { retryCaptureJob } from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const user = await requireObjectCaptureUser();
    if (isApiError(user)) return user;
    const { jobId } = await context.params;
    const job = await retryCaptureJob(user.customerUid, jobId);
    return job ? NextResponse.json({ success: true, job }) : notFound();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to retry this job." },
      { status: 409 },
    );
  }
}
