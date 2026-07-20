import { NextResponse } from "next/server";
import { getCaptureAnalysis } from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const user = await requireObjectCaptureUser({ subscription: false });
    if (isApiError(user)) return user;
    const params = await Promise.resolve(context.params);
    const analysis = await getCaptureAnalysis(user.customerUid, params.jobId);
    if (!analysis) return notFound();

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("Get capture analysis error:", error);

    return NextResponse.json({ success: false, error: "Analysis load failed" }, { status: 500 });
  }
}
