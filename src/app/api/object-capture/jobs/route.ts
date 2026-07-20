import { NextResponse } from "next/server";
import { createCaptureJob, listCaptureJobs } from "@/lib/object-capture/production-service";
import { isApiError, requireObjectCaptureUser } from "@/lib/object-capture/api";
import { OBJECT_CAPTURE_STATUSES, type ObjectCaptureStatus } from "@/lib/object-capture/types";

export async function POST() {
  try {
    const user = await requireObjectCaptureUser();
    if (isApiError(user)) return user;
    const job = await createCaptureJob(user.customerUid, Number(user.id));
    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("Create object capture job error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create capture job" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const user = await requireObjectCaptureUser({ subscription: false });
  if (isApiError(user)) return user;
  const params = new URL(request.url).searchParams;
  const statusValue = params.get("status") || "";
  if (statusValue && !OBJECT_CAPTURE_STATUSES.includes(statusValue as ObjectCaptureStatus)) {
    return NextResponse.json({ success: false, error: "Invalid status filter." }, { status: 400 });
  }
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!validDate(from) || !validDate(to) || (from && to && from > to)) {
    return NextResponse.json({ success: false, error: "Choose a valid date range." }, { status: 400 });
  }
  const result = await listCaptureJobs(user.customerUid, {
    page: Number(params.get("page") || 1),
    pageSize: Number(params.get("pageSize") || 10),
    status: statusValue as ObjectCaptureStatus | "",
    search: params.get("search") || "",
    from,
    to,
  });
  return NextResponse.json({ success: true, ...result });
}
