import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";

function loginRedirect(request: Request) {
  const url = new URL("/master-admin/login", request.url);
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (hostHeader) {
    url.host = hostHeader.split(",")[0].trim();
  }
  if (url.hostname === "0.0.0.0" || url.hostname === "[::]") {
    url.hostname = "localhost";
  }
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "http" || proto === "https") {
    url.protocol = `${proto}:`;
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  await clearAdminSession();
  return loginRedirect(request);
}
