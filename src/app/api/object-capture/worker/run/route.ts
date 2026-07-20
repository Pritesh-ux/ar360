import { NextResponse } from "next/server";
import { verifyWorkerRequest, workerUnauthorizedResponse } from "@/lib/worker-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!verifyWorkerRequest(req)) {
    return workerUnauthorizedResponse();
  }

  return NextResponse.json(
    {
      success: false,
      error: "HTTP reconstruction is disabled. Run `npm run worker:oc` on the reconstruction host.",
    },
    { status: 410 },
  );
}
