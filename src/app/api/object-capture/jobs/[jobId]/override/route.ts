import { NextResponse } from "next/server";
import { overrideCaptureJob } from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireObjectCaptureUser();
    if (isApiError(user)) return user;
    const { jobId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const job = await overrideCaptureJob(
      user.customerUid,
      jobId,
      Number(user.id),
      typeof body.reason === "string" ? body.reason : "",
    );
    return job ? NextResponse.json({ success: true, job }) : notFound();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to override quality validation." },
      { status: 409 },
    );
  }
}
