import { NextResponse } from "next/server";
import { verifyWorkerRequest, workerUnauthorizedResponse } from "@/lib/worker-auth";
import { runObjectCaptureCleanup } from "@/lib/object-capture/cleanup";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!verifyWorkerRequest(req)) return workerUnauthorizedResponse();
  const result = await runObjectCaptureCleanup(
    req.headers.get("x-worker-id")?.slice(0, 64) || "http-cleanup",
  );
  return NextResponse.json({ success: true, ...result });
}
