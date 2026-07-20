import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    AUTH_HTTPS: process.env.AUTH_HTTPS,
  });
}
