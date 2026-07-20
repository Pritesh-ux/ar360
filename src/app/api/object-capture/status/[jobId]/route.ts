import { NextResponse } from "next/server";
import { getCaptureJob } from "@/lib/object-capture/production-service";
import { isApiError, requireObjectCaptureUser } from "@/lib/object-capture/api";
import { getCaptureJobForWorker } from "@/lib/object-capture/repository";
import { verifyWorkerRequest } from "@/lib/worker-auth";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const isWorker = verifyWorkerRequest(req);
    if (isWorker) {
      const workerJob = await getCaptureJobForWorker(params.jobId);
      return workerJob
        ? NextResponse.json({ success: true, job: workerJob })
        : NextResponse.json({ success: false, error: "Capture job not found" }, { status: 404 });
    }
    const user = await requireObjectCaptureUser({ subscription: false });
    if (isApiError(user)) return user;
    const job = await getCaptureJob(params.jobId, user.customerUid);
    if (!job) return NextResponse.json({ success: false, error: "Capture job not found" }, { status: 404 });

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("Object capture status error:", error);

    return NextResponse.json(
      { success: false, error: "Status check failed" },
      { status: 500 }
    );
  }
}
