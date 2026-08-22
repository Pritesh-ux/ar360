import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { verifyWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

function envAccessOk(req: NextRequest): boolean {
  if (verifyWorkerRequest(req)) return true;

  const expected = process.env.AR360_INTERNAL_KEY;
  if (!expected) return false;

  const provided = req.headers.get("x-ar360-internal-key") || "";
  if (!provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !envAccessOk(req)) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    AUTH_HTTPS: process.env.AUTH_HTTPS,
  });
}
