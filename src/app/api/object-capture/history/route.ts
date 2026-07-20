import { NextResponse } from "next/server";
import { listCaptureJobs } from "@/lib/object-capture/production-service";
import { isApiError, requireObjectCaptureUser } from "@/lib/object-capture/api";

export async function GET() {
  try {
    const user = await requireObjectCaptureUser({ subscription: false });
    if (isApiError(user)) return user;
    const result = await listCaptureJobs(user.customerUid, { pageSize: 30 });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Object capture history error:", error);

    return NextResponse.json(
      { success: false, error: "Failed to load history" },
      { status: 500 }
    );
  }
}