import { NextResponse } from "next/server";
import { captureException } from "@/lib/monitoring";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    digest?: string;
    stack?: string;
    source?: string;
  };

  const error = new Error(body.message || "Client error");
  if (body.stack) error.stack = body.stack;

  await captureException(error, {
    digest: body.digest,
    source: body.source || "client",
  });

  return NextResponse.json({ success: true });
}
