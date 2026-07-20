import { NextResponse } from "next/server";
import { createCaptureJob } from "@/lib/object-capture/production-service";
import { isApiError, requireObjectCaptureUser } from "@/lib/object-capture/api";

export async function POST() {
  const user = await requireObjectCaptureUser();
  if (isApiError(user)) return user;
  const job = await createCaptureJob(user.customerUid, Number(user.id));

  return NextResponse.json({ success: true, job });
}