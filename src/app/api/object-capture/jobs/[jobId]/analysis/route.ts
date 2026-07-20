import { NextResponse } from "next/server";
import { analyzeCaptureJob, getCaptureAnalysis } from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await requireObjectCaptureUser({ subscription: false });
  if (isApiError(user)) return user;
  const { jobId } = await context.params;
  const analysis = await getCaptureAnalysis(user.customerUid, jobId);
  return analysis ? NextResponse.json({ success: true, analysis }) : notFound();
}

export async function POST(_request: Request, context: Context) {
  const user = await requireObjectCaptureUser();
  if (isApiError(user)) return user;
  const { jobId } = await context.params;
  const summary = await analyzeCaptureJob(user.customerUid, jobId);
  return summary ? NextResponse.json({ success: true, ...summary }) : notFound();
}
