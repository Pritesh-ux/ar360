import { NextResponse } from "next/server";
import {
  cancelCaptureJob,
  getCaptureJobDetail,
} from "@/lib/object-capture/production-service";
import { isApiError, notFound, requireObjectCaptureUser } from "@/lib/object-capture/api";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await requireObjectCaptureUser({ subscription: false });
  if (isApiError(user)) return user;
  const { jobId } = await context.params;
  const detail = await getCaptureJobDetail(user.customerUid, jobId);
  return detail ? NextResponse.json({ success: true, ...detail }) : notFound();
}

export async function DELETE(_request: Request, context: Context) {
  const user = await requireObjectCaptureUser();
  if (isApiError(user)) return user;
  const { jobId } = await context.params;
  const job = await cancelCaptureJob(user.customerUid, jobId);
  return job ? NextResponse.json({ success: true, job }) : notFound();
}
